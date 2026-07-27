import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// A comprehensive set of English stop words + job posting metadata / filler words to exclude
export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could',
  'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes',
  'her', 'here', 'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im',
  'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt',
  'so', 'some', 'such', 'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
  'what', 'whats', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'wont', 'would', 'wouldnt',
  'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves',
  // Common job posting metadata & structural filler words
  'experience', 'skills', 'work', 'job', 'ability', 'role', 'team', 'years', 'candidate', 'position',
  'requirements', 'duties', 'responsibilities', 'qualified', 'successful', 'ideal', 'key', 'strong',
  'preferred', 'required', 'minimum', 'plus', 'join', 'company', 'looking', 'description', 'opportunity',
  'support', 'build', 'develop', 'manage', 'help', 'design', 'lead', 'deliver', 'create', 'working',
  'title', 'location', 'hybrid', 'remote', 'full-time', 'part-time', 'seeking', 'ambitious', 'labs',
  'inc', 'llc', 'corp', 'corporation', 'closely', 'drive', 'driving', 'solutions', 'overview', 'summary'
]);

// Taxonomy of recognized technical skills, frameworks, tools, and methodologies
export const SKILL_KEYWORDS = new Set([
  'java', 'javascript', 'js', 'typescript', 'ts', 'python', 'csharp', 'golang', 'go', 'ruby',
  'php', 'kotlin', 'swift', 'scala', 'rust', 'perl', 'matlab', 'sql', 'plsql', 'bash',
  'powershell', 'html', 'css', 'sass', 'scss', 'xml', 'json', 'yaml',
  'react', 'reactjs', 'angular', 'angularjs', 'vue', 'vuejs', 'svelte', 'node', 'nodejs',
  'express', 'expressjs', 'nestjs', 'spring', 'springboot', 'boot', 'hibernate',
  'django', 'flask', 'fastapi', 'laravel', 'rails', 'dotnet', 'asp', 'jquery',
  'bootstrap', 'tailwind', 'redux', 'next', 'nextjs', 'nuxt', 'flutter',
  'jest', 'mocha', 'cypress', 'selenium', 'junit', 'pytest', 'cucumber', 'playwright', 'postman',
  'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scipy', 'scikit', 'sklearn', 'opencv',
  'nltk', 'spacy', 'ml', 'nlp', 'llm', 'llms', 'large language models', 'generative ai', 'machine learning',
  'tableau', 'powerbi', 'looker', 'statistics', 'statistical', 'etl', 'elt', 'spark', 'hadoop',
  'kafka', 'airflow', 'databricks', 'snowflake', 'bigquery', 'dbt', 'analytics', 'product analytics',
  'visualization', 'modeling', 'forecasting',
  'aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'k8s', 'terraform',
  'ansible', 'jenkins', 'gitlab', 'github', 'ci/cd', 'devops', 'sre', 'linux', 'unix', 'nginx',
  'serverless', 'lambda', 'ec2', 's3', 'iam', 'prometheus', 'grafana', 'datadog', 'splunk',
  'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'oracle', 'dynamodb',
  'elasticsearch', 'firebase', 'nosql', 'rdbms',
  'rest', 'restful', 'api', 'apis', 'graphql', 'grpc', 'microservices', 'websocket',
  'oauth', 'jwt', 'mvc', 'oop', 'vite', 'npm', 'yarn',
  'agile', 'scrum', 'kanban', 'waterfall', 'jira', 'confluence', 'git', 'bitbucket',
  'tdd', 'bdd', 'figma', 'sketch', 'wireframing', 'prototyping',
  'cybersecurity', 'security', 'pentesting', 'automation', 'qa', 'sdet', 'salesforce',
  'excel', 'powerpoint', 'vba', 'gtm', 'go-to-market', 'product strategy', 'roadmap',
  'a/b testing', 'kpis', 'okrs', 'saas', 'b2b', 'user research', 'user stories', 'acceptance criteria'
]);

// Fallback frequency-based keyword extractor
export const extractKeywords = (jobDescription, limit = 25) => {
  const jdClean = (jobDescription || '').toLowerCase().replace(/[^\w\s-]/g, ' ');
  const jdBits = jdClean.split(/\s+/);
  const freqMap = {};
  for (const word of jdBits) {
    const cleanWord = word.trim();
    if (cleanWord.length >= 2 && !STOP_WORDS.has(cleanWord) && isNaN(cleanWord)) {
      freqMap[cleanWord] = (freqMap[cleanWord] || 0) + 1;
    }
  }
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])
    .slice(0, limit);
};

// Helper: Verifies if a term or word boundary exists within the candidate's resume text
const isTermInResume = (term, resumeText) => {
  if (!term || !resumeText) return false;
  const cleanTerm = term.toLowerCase().trim();
  const resumeLower = resumeText.toLowerCase();

  if (cleanTerm.length <= 3) {
    // Word boundary check for short terms like "AI", "ML", "Git", "Jira", "AWS"
    const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
    return regex.test(resumeText);
  }

  // Check full string match
  if (resumeLower.includes(cleanTerm)) return true;

  // Check if all main words of a multi-word term are in resume (e.g. "manual testing" -> resume has "manual" and "testing")
  const words = cleanTerm.split(/[\s-]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length >= 2) {
    return words.every(w => resumeLower.includes(w));
  }

  return false;
};

// Helper: Filters out redundant sub-variations of already matched concepts
const filterRedundantMissingSkills = (missingList, matchedList) => {
  const matchedLowers = matchedList.map(m => m.toLowerCase().trim());
  
  return missingList.filter(skill => {
    const sLower = skill.toLowerCase().trim();
    
    for (const m of matchedLowers) {
      if (m === sLower) return false;
      // If matched has "copilot" and missing has "copilot features"
      if (sLower.startsWith(m) || sLower.endsWith(m)) return false;
      // If matched has "ai-powered applications" or "ai" and missing is an AI phrase variation
      if (sLower.startsWith('ai ') || sLower.startsWith('ai-') || sLower.endsWith(' ai') || sLower.includes('ai ')) {
        if (m.includes('ai') || m.includes('ai-powered')) return false;
      }
    }
    return true;
  });
};

// POST /api/ats/check
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: 'Please provide both the resume text and the job description.' });
    }

    let matched = [];
    let missingSkills = [];
    let missingGeneric = [];
    let score = 0;
    let isSemantic = false;

    // AI Semantic Keyword & Skill Extractor & Matcher via Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `You are an expert ATS (Applicant Tracking System) keyword auditor.
Analyze a candidate's resume against a job description and categorize key terms into EXACTLY THREE distinct groups:

Job Description:
"""
${jobDescription}
"""

Candidate Resume:
"""
${resumeText}
"""

INSTRUCTIONS:
1. "matched": Distinct, unique key skills, tools, or domain terms from the JD that ARE ALREADY present or clearly demonstrated in the candidate's resume.
2. "missingGeneric" (SAFE TO ADD): General domain terms, industry buzzwords, or soft methodologies present in the JD but TRULY MISSING from the candidate's resume.
3. "missingSkills" (SKILL GAPS): Distinct, unique technical skills, heavy frameworks, or specialized tools present in the JD but TRULY MISSING from the candidate's resume. Avoid generating multiple repetitive variations of the same root term (e.g. do NOT generate "AI agents", "AI features", "AI Validation" if AI is already covered; pick 1 primary term).

Return STRICT JSON format:
{
  "matched": ["Term1", "Term2"],
  "missingGeneric": ["SafeToAdd1", "SafeToAdd2"],
  "missingSkills": ["HardSkill1", "HardSkill2"]
}`;

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        });

        const responseText = result.response.text();
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(responseText.slice(start, end + 1));
          if (Array.isArray(parsed.matched)) {
            matched = parsed.matched || [];
            missingSkills = parsed.missingSkills || [];
            missingGeneric = parsed.missingGeneric || [];
            isSemantic = true;
          }
        }
      } catch (aiErr) {
        console.warn('Gemini semantic ATS check failed, falling back to deterministic matching:', aiErr.message);
      }
    }

    // Fallback: Deterministic String & Skill Taxonomy Matcher
    if (!isSemantic) {
      const sortedKeywords = extractKeywords(jobDescription, 25);
      const rawMatched = [];
      const rawMissing = [];

      for (const keyword of sortedKeywords) {
        if (isTermInResume(keyword, resumeText)) {
          rawMatched.push(keyword);
        } else {
          rawMissing.push(keyword);
        }
      }

      matched = rawMatched;
      missingSkills = rawMissing.filter((k) => SKILL_KEYWORDS.has(k.toLowerCase()));
      missingGeneric = rawMissing.filter((k) => !SKILL_KEYWORDS.has(k.toLowerCase()));
    }

    // ── RIGOROUS POST-PROCESSING & DEDUPLICATION ──
    // 1. Verify missing terms against resumeText: if ANY term or its root words are present in resume, MOVE TO MATCHED!
    const verifiedMissingGeneric = [];
    for (const term of missingGeneric) {
      if (isTermInResume(term, resumeText)) {
        if (!matched.some(m => m.toLowerCase() === term.toLowerCase())) {
          matched.push(term);
        }
      } else {
        verifiedMissingGeneric.push(term);
      }
    }
    missingGeneric = verifiedMissingGeneric;

    const verifiedMissingSkills = [];
    for (const term of missingSkills) {
      if (isTermInResume(term, resumeText)) {
        if (!matched.some(m => m.toLowerCase() === term.toLowerCase())) {
          matched.push(term);
        }
      } else {
        verifiedMissingSkills.push(term);
      }
    }

    // 2. Filter out redundant sub-variations of already matched concepts (e.g. "AI agents", "Copilot features")
    missingSkills = filterRedundantMissingSkills(verifiedMissingSkills, matched);
    missingGeneric = filterRedundantMissingSkills(missingGeneric, matched);

    // 3. Deduplicate exact duplicate items inside lists
    matched = [...new Set(matched)];
    missingSkills = [...new Set(missingSkills)];
    missingGeneric = [...new Set(missingGeneric)];

    // Calculate exact ATS alignment score BEFORE capping output lists
    const totalExtracted = matched.length + missingSkills.length + missingGeneric.length;
    score = totalExtracted > 0 ? Math.round((matched.length / totalExtracted) * 100) : 0;

    // Cap output suggestions to prevent overwhelming lists (Max 10 skill gaps, Max 6 generic terms)
    missingSkills = missingSkills.slice(0, 10);
    missingGeneric = missingGeneric.slice(0, 6);
    matched = matched.slice(0, 25);

    const missing = [...missingSkills, ...missingGeneric];

    // Generate plain-English verdict with graceful role unsuitability message for low scores
    let verdict = '';
    if (score >= 75) {
      verdict = 'Excellent alignment! Your resume strongly matches the core requirements and skills of this job description.';
    } else if (score >= 45) {
      verdict = 'Moderate alignment. Your profile matches several foundational requirements, but is missing core technical skills or domain terms listed below.';
    } else {
      verdict = `Domain Mismatch Warning (${score}% match): Your current profile shows low alignment with this target position. You appear to be applying outside your primary skill domain. We gracefully advise building foundational domain experience or targeting roles closer to your core expertise before applying.`;
    }

    return res.json({
      score,
      matched,
      missing,
      missingSkills,
      missingGeneric,
      verdict,
      isSemantic,
    });
  } catch (error) {
    return res.status(500).json({ error: 'An error occurred during the ATS analysis. Please try again.' });
  }
});

export default router;