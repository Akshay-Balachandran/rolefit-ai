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
  'nltk', 'spacy', 'ml', 'ai', 'nlp', 'llm', 'llms', 'large language models', 'generative ai', 'machine learning',
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

        const prompt = `You are an expert ATS (Applicant Tracking System) keyword and skills auditor.
Given a Job Description and a Candidate's Resume, extract key skills and evaluate candidate alignment.

Job Description:
"""
${jobDescription}
"""

Candidate Resume:
"""
${resumeText}
"""

INSTRUCTIONS:
1. Extract 12 to 25 core skills, tools, domain competencies, and methodologies from the Job Description.
   - Ignore company names (e.g. "InnovateAI Labs"), metadata ("Job Title", "Location", "Hybrid"), and generic English verbs ("drive", "closely", "help").
   - Prefer meaningful technical/domain terms (e.g., "LLMs", "Machine Learning", "REST APIs", "Agile/Scrum", "Product Analytics", "GTM Strategy", "User Research", "B2B SaaS", "Roadmap").
2. Evaluate each extracted skill against the candidate's resume:
   - "matched": Skills/tools/competencies clearly demonstrated in the resume (using semantic synonyms e.g. "user interviews" matches "User Research", "REST APIs" matches "APIs", "APM/PM" matches "Product Management").
   - "missingSkills": Real technical/hard skills, tools, frameworks, or domain methodologies required in the JD that are NOT present in the resume (e.g., "LLMs", "Machine Learning", "GTM Strategy").
   - "missingGeneric": Business context or general domain terms in the JD missing from the resume.

Return STRICT JSON format:
{
  "matched": ["Skill1", "Skill2"],
  "missingSkills": ["Skill3", "Skill4"],
  "missingGeneric": ["Term1"]
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
          if (Array.isArray(parsed.matched) && (Array.isArray(parsed.missingSkills) || Array.isArray(parsed.missing))) {
            matched = parsed.matched || [];
            missingSkills = parsed.missingSkills || [];
            missingGeneric = parsed.missingGeneric || parsed.missing || [];
            isSemantic = true;

            const totalExtracted = matched.length + missingSkills.length + missingGeneric.length;
            if (totalExtracted > 0) {
              score = Math.round((matched.length / totalExtracted) * 100);
            }
          }
        }
      } catch (aiErr) {
        console.warn('Gemini semantic ATS check failed, falling back to deterministic matching:', aiErr.message);
      }
    }

    // Fallback: Deterministic String & Skill Taxonomy Matcher
    if (!isSemantic) {
      const sortedKeywords = extractKeywords(jobDescription, 25);
      const resumeLower = resumeText.toLowerCase();
      const rawMatched = [];
      const rawMissing = [];

      for (const keyword of sortedKeywords) {
        if (resumeLower.includes(keyword)) {
          rawMatched.push(keyword);
        } else {
          rawMissing.push(keyword);
        }
      }

      matched = rawMatched;
      missingSkills = rawMissing.filter((k) => SKILL_KEYWORDS.has(k.toLowerCase()));
      missingGeneric = rawMissing.filter((k) => !SKILL_KEYWORDS.has(k.toLowerCase()));
      
      const totalExtracted = matched.length + rawMissing.length;
      score = totalExtracted > 0 ? Math.round((matched.length / totalExtracted) * 100) : 0;
    }

    const missing = [...missingSkills, ...missingGeneric];

    // Generate plain-English verdict
    let verdict = '';
    if (score >= 80) {
      verdict = 'Excellent alignment! Your resume strongly matches the core requirements and skills of this job description.';
    } else if (score >= 50) {
      verdict = 'Moderate alignment. Your resume has good foundational matches, but is missing critical skills or domain terms listed below.';
    } else {
      verdict = 'Low alignment. Your resume is missing several key technical skills and requirements for this role. We recommend tailoring your profile to include the missing skills.';
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