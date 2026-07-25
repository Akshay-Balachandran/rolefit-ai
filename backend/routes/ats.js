import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// A robust set of English stop words + common resume filler words to exclude
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
  // Common job description / filler words
  'experience', 'skills', 'work', 'job', 'ability', 'role', 'team', 'years', 'candidate', 'position',
  'requirements', 'duties', 'responsibilities', 'qualified', 'successful', 'ideal', 'key', 'strong',
  'preferred', 'required', 'minimum', 'plus', 'join', 'company', 'looking', 'description', 'opportunity',
  'support', 'build', 'develop', 'manage', 'help', 'design', 'lead', 'deliver', 'create', 'working'
]);

// Extracts the most frequent meaningful keywords from a job description.
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

// Curated skills taxonomy — tokens that represent a genuine, learnable skill
export const SKILL_KEYWORDS = new Set([
  'java', 'javascript', 'js', 'typescript', 'ts', 'python', 'csharp', 'golang', 'go', 'ruby',
  'php', 'kotlin', 'swift', 'scala', 'rust', 'perl', 'matlab', 'sql', 'plsql', 'bash',
  'powershell', 'html', 'css', 'sass', 'scss', 'xml', 'json', 'yaml',
  'react', 'reactjs', 'angular', 'angularjs', 'vue', 'vuejs', 'svelte', 'node', 'nodejs',
  'express', 'expressjs', 'nestjs', 'spring', 'springboot', 'boot', 'hibernate', 'struts',
  'django', 'flask', 'fastapi', 'laravel', 'symfony', 'rails', 'dotnet', 'asp', 'jquery',
  'bootstrap', 'tailwind', 'redux', 'next', 'nextjs', 'nuxt', 'flutter', 'xamarin', 'ionic',
  'jest', 'mocha', 'chai', 'cypress', 'selenium', 'junit', 'testng', 'pytest', 'cucumber',
  'playwright', 'jasmine', 'karma', 'postman',
  'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scipy', 'scikit', 'sklearn', 'opencv',
  'nltk', 'spacy', 'ml', 'ai', 'nlp', 'llm', 'tableau', 'powerbi', 'looker', 'statistics',
  'statistical', 'regression', 'classification', 'clustering', 'etl', 'elt', 'spark', 'hadoop',
  'hive', 'kafka', 'airflow', 'databricks', 'snowflake', 'bigquery', 'dbt', 'analytics',
  'visualization', 'modeling', 'forecasting',
  'aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'k8s', 'openshift', 'terraform',
  'ansible', 'puppet', 'chef', 'jenkins', 'gitlab', 'github', 'circleci', 'travis', 'ci', 'cd',
  'cicd', 'devops', 'sre', 'linux', 'unix', 'nginx', 'apache', 'tomcat', 'serverless', 'lambda',
  'ec2', 's3', 'iam', 'cloudformation', 'helm', 'prometheus', 'grafana', 'datadog', 'splunk',
  'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'oracle', 'sqlserver',
  'sqlite', 'mariadb', 'cassandra', 'dynamodb', 'elasticsearch', 'firebase', 'couchbase',
  'neo4j', 'nosql', 'rdbms',
  'rest', 'restful', 'api', 'apis', 'graphql', 'grpc', 'soap', 'microservices', 'websocket',
  'oauth', 'jwt', 'mvc', 'oop', 'soa', 'webpack', 'vite', 'babel', 'npm', 'yarn',
  'agile', 'scrum', 'kanban', 'waterfall', 'jira', 'confluence', 'git', 'svn', 'bitbucket',
  'tdd', 'bdd', 'ddd', 'uml', 'figma', 'sketch', 'photoshop', 'illustrator', 'invision',
  'wireframing', 'prototyping',
  'cybersecurity', 'security', 'pentesting', 'cryptography', 'networking', 'blockchain',
  'solidity', 'iot', 'embedded', 'firmware', 'automation', 'rpa', 'qa', 'sdet', 'salesforce',
  'sap', 'servicenow', 'dynamics', 'wordpress', 'shopify', 'magento', 'seo',
  'excel', 'powerpoint', 'vba', 'macros', 'ssis', 'ssrs', 'informatica', 'talend', 'qlik',
  'sas', 'spss',
]);

// POST /api/ats/check
router.post('/check', authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: 'Please provide both the resume text and the job description.' });
    }

    // Extract the top keywords from the Job Description
    const sortedKeywords = extractKeywords(jobDescription, 25);

    if (sortedKeywords.length === 0) {
      return res.json({
        score: 0,
        matched: [],
        missing: [],
        missingSkills: [],
        missingGeneric: [],
        verdict: 'The job description seems to contain no identifiable skills or keywords. Please add more details to the job description.',
      });
    }

    let matched = [];
    let missing = [];
    let isSemantic = false;

    // Try AI Semantic Keyword Matching via Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `You are an ATS (Applicant Tracking System) keyword auditor.
Analyze a candidate's resume against a list of key terms extracted from a job description.

Target Keywords from Job Description:
${JSON.stringify(sortedKeywords)}

Candidate Resume Text:
"""
${resumeText}
"""

INSTRUCTIONS:
1. For each keyword in the target list, evaluate if the resume demonstrates knowledge or experience in that skill.
2. Use SEMANTIC MATCHING. Count synonyms, abbreviations, acronyms, or word stem variations as MATCHES.
   Examples of valid semantic matches:
   - "AWS" matches "Amazon Web Services" or "Amazon Cloud"
   - "K8s" matches "Kubernetes"
   - "React" matches "React.js" or "ReactJS"
   - "JS" matches "JavaScript"
   - "ML" matches "Machine Learning"
   - "developing" matches "develop" or "developer"
3. Categorize every single target keyword from the input list into either "matched" or "missing". Do not omit keywords or invent new ones.

Return STRICT JSON format:
{
  "matched": ["keyword1", "keyword2"],
  "missing": ["keyword3"]
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
          if (Array.isArray(parsed.matched) && Array.isArray(parsed.missing)) {
            matched = parsed.matched;
            missing = parsed.missing;
            isSemantic = true;
          }
        }
      } catch (aiErr) {
        console.warn('Gemini semantic ATS check failed, falling back to deterministic string matching:', aiErr.message);
      }
    }

    // Fallback: Deterministic String Matching (if Gemini is unavailable or failed)
    if (!isSemantic) {
      const resumeLower = resumeText.toLowerCase();
      matched = [];
      missing = [];

      for (const keyword of sortedKeywords) {
        if (resumeLower.includes(keyword)) {
          matched.push(keyword);
        } else {
          missing.push(keyword);
        }
      }
    }

    // Calculate ATS alignment score
    const score = Math.round((matched.length / sortedKeywords.length) * 100);

    // Generate plain-English verdict
    let verdict = '';
    if (score >= 80) {
      verdict = 'Excellent! Your resume is highly aligned with this job description (using semantic ATS verification). It contains a strong percentage of core keywords.';
    } else if (score >= 50) {
      verdict = 'Good alignment, but can be improved. Consider editing your resume/profile to naturally integrate some of the missing keywords below.';
    } else {
      verdict = 'Weak alignment. Your resume is missing more than half of the critical keywords from this job description. We highly recommend modifying your profile and regenerating the resume.';
    }

    // Split missing keywords: genuine skills vs generic terms
    const missingSkills = missing.filter((k) => SKILL_KEYWORDS.has(k.toLowerCase()));
    const missingGeneric = missing.filter((k) => !SKILL_KEYWORDS.has(k.toLowerCase()));

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