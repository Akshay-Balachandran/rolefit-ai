import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Resume from '../models/Resume.js';
import { authMiddleware } from '../middleware/auth.js';
import { extractKeywords } from './ats.js';

const router = express.Router();

// Initialize Gemini
const initGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables.');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

// Detects transient corporate-network / proxy failures that are worth retrying
const isTransientNetworkError = (err) => {
  const code = err?.cause?.code || '';
  const msg = err?.message || '';
  return (
    msg.includes('fetch failed') ||
    [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT',
    ].includes(code)
  );
};

// Calls Gemini with automatic retries so one dropped connection doesn't fail the request
const generateWithRetry = async (model, request, attempts = 3) => {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (err) {
      lastErr = err;
      console.error(
        `Gemini attempt ${attempt}/${attempts} failed: ${err.message} (cause: ${err?.cause?.code || 'n/a'})`
      );
      if (!isTransientNetworkError(err) || attempt === attempts) break;
      // Linear backoff: 0.8s, then 1.6s, before the next try
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastErr;
};

// POST /api/resume/generate
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { profile, jobDescription } = req.body;

    if (!profile || !jobDescription) {
      return res.status(400).json({ error: 'Please provide both your profile details and the target job description.' });
    }

    const genAI = initGemini();
    if (!genAI) {
      return res.status(503).json({ 
        error: 'Resume generation is currently unavailable. Please check backend server configuration (GEMINI_API_KEY is missing).' 
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName }, { timeout: 30000 });
    const jdKeywords = extractKeywords(jobDescription, 15);

    const systemPrompt = `You are an expert resume writer and recruiter specializing in ATS-aligned, professional resumes.
Your task is to take a candidate's "Profile" (their experience, skills, education) and a target "Job Description" (JD), and write a tailored, professional resume.

CRITICAL INSTRUCTIONS:
1. DO NOT invent or fabricate any experiences, credentials, job titles, companies, dates, certifications, or projects. Stick strictly to the information provided in the user's Profile.
2. If there are missing gaps (e.g. no education mentioned, or missing dates), present the information cleanly without creating fake entries.
3. Tailor the phrasing, bullet points, and keywords of their profile to align with the language and requirements of the Job Description. Highlight relevant skills and achievements that map directly to the JD.
4. Format the resumeText as clean, single-column PLAIN TEXT with NO markdown symbols — never use #, *, or ** anywhere. Structure it exactly like this: the first line is the candidate's full name; the second line is the target-role headline; the third line is the contact details separated by " | ". After that, each section begins with its heading on its own line in Title Case, chosen from: Summary, Professional Experience, Education, Skills, Certifications, Projects, Languages. Put every bullet point on its own line beginning with "- " (a hyphen followed by a space). Do not use tables or multi-column layouts.
5. In the "tailoringNotes" array, outline 2-4 specific modifications you made (e.g., "Emphasized your React.js and state management skills to match the Frontend Engineer requirement" or "Phrased your project management experience to highlight Agile methodologies").
6. KEYWORD ALIGNMENT (important): You will be given a list of PRIORITY KEYWORDS extracted from the Job Description. Naturally incorporate as many of these as are genuinely supported by the Profile, using the job description's exact wording, across the summary, experience bullets, and skills. Never invent experience just to fit a keyword — if one is not truthfully supported, leave it out.
7. TARGET ROLE: Directly beneath the candidate's name, add a one-line professional headline naming the target role from the Job Description (e.g. "Data Analyst"). This is the role being applied for, so stating it is always truthful and is not fabrication. Also reference the target role in the Summary's objective.

Return STRICT JSON format:
{
  "resumeText": "The full plain-text resume here (no markdown symbols)...",
  "tailoringNotes": [
    "Detail about what was tailored",
    "Another detail about the tailoring decisions"
  ]
}`;

    const prompt = `
=== Candidate Profile ===
${profile}

=== Target Job Description ===
${jobDescription}

=== Priority Keywords (extracted from the Job Description — weave in the ones the Profile genuinely supports, using this exact wording) ===
${jdKeywords.join(', ')}

Generate the tailored resume and the tailoring notes. Return STRICT JSON conforming to the schema:
{
  "resumeText": "string",
  "tailoringNotes": ["string"]
}
`;

    // Call Gemini API with JSON response mime type
    const result = await generateWithRetry(model, {
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n' + prompt }] }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();
    
    // Defensive parsing
    let parsedData;
    try {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new Error('No valid JSON block found in response');
      }
      const slicedJson = responseText.slice(start, end + 1);
      parsedData = JSON.parse(slicedJson);
    } catch (parseErr) {
      console.error('Gemini output failed to parse:', responseText);
      return res.status(502).json({ 
        error: 'Failed to tailor the resume. The AI model output was malformed. Please try again.' 
      });
    }

    if (!parsedData.resumeText) {
      return res.status(502).json({ 
        error: 'Resume generation returned an empty result. Please refine your inputs and try again.' 
      });
    }

    return res.json({
      resumeText: parsedData.resumeText,
      tailoringNotes: parsedData.tailoringNotes || [],
    });
  } catch (error) {
    console.error('Resume generation error:', error.message, '| cause:', error?.cause?.code || 'n/a');
    const networkIssue = isTransientNetworkError(error);
    return res.status(networkIssue ? 503 : 500).json({
      error: networkIssue
        ? 'Could not reach the AI service after several tries — this looks like a temporary network or proxy hiccup. Please wait a moment and try again.'
        : 'An unexpected error occurred while generating your resume. Please try again.',
    });
  }
});

// POST /api/resume : Save a tailored resume
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, profile, jobDescription, resumeText, atsScore } = req.body;

    if (!title || !profile || !jobDescription || !resumeText) {
      return res.status(400).json({ error: 'Please provide all required fields (title, profile, jobDescription, resumeText).' });
    }

    const newResume = new Resume({
      user: req.user.id,
      title: title.trim(),
      profile,
      jobDescription,
      resumeText,
      atsScore: typeof atsScore === 'number' ? atsScore : 0,
    });

    await newResume.save();
    return res.status(201).json(newResume);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save the resume. Please try again.' });
  }
});

// GET /api/resume : List the user's saved resumes (newest first; title, atsScore, updatedAt)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user.id })
      .select('title atsScore updatedAt')
      .sort({ updatedAt: -1 });

    return res.json(resumes);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve saved resumes. Please try again.' });
  }
});

// GET /api/resume/:id : Load one of the user's resumes in full
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found.' });
    }

    // Verify ownership
    if (resume.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to access this resume.' });
    }

    return res.json(resume);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load the resume. Please try again.' });
  }
});

// DELETE /api/resume/:id : Delete one of the user's resumes
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found.' });
    }

    // Verify ownership
    if (resume.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this resume.' });
    }

    await Resume.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Resume deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete the resume. Please try again.' });
  }
});

export default router;