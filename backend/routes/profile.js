import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage and 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file extensions/mimetypes
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a PDF, Word (.docx), or text (.txt) file.'));
    }
  },
}).single('file');

// POST /api/profile/extract
router.post('/extract', authMiddleware, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. The limit is 5MB.' });
        }
        return res.status(400).json({ error: 'File upload failed. Please try again.' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please select a file to upload.' });
      }

      const buffer = req.file.buffer;
      const mimeType = req.file.mimetype;
      const originalName = req.file.originalname.toLowerCase();
      let extractedText = '';

      if (mimeType === 'application/pdf' || originalName.endsWith('.pdf')) {
        try {
          const parsed = await pdfParse(buffer);
          extractedText = parsed.text;
        } catch (pdfErr) {
          return res.status(400).json({ 
            error: 'Failed to read PDF. It might be password-protected or corrupted.' 
          });
        }
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        originalName.endsWith('.docx')
      ) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } catch (docxErr) {
          return res.status(400).json({ 
            error: 'Failed to read Word file. It might be corrupted.' 
          });
        }
      } else if (mimeType === 'text/plain' || originalName.endsWith('.txt')) {
        extractedText = buffer.toString('utf-8');
      } else {
        return res.status(400).json({ 
          error: 'Unsupported file format. Please upload PDF, Word (.docx), or text (.txt) files only.' 
        });
      }

      // Check for empty or scanned files
      const cleanText = extractedText.trim();
      if (!cleanText || cleanText.length < 10) {
        return res.status(400).json({
          error: 'We could not extract any meaningful text. If this is a scanned document, please paste your profile details manually.',
        });
      }

      return res.json({ text: cleanText });
    } catch (error) {
      return res.status(500).json({ error: 'An error occurred during text extraction. Please try again.' });
    }
  });
});

// POST /api/profile/extract-url - Extract Job Description from a URL
router.post('/extract-url', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Please enter a valid job posting URL.' });
    }

    let parsedUrl;
    try {
      const rawUrl = url.trim();
      parsedUrl = new URL(rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format. Please enter a valid website link.' });
    }

    let responseText = '';
    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(12000), // 12 second timeout
      });

      if (!response.ok) {
        return res.status(400).json({ error: `Could not access the webpage (Status: ${response.status}). Please check the link or paste the text manually.` });
      }

      responseText = await response.text();
    } catch (fetchErr) {
      return res.status(400).json({ error: 'Failed to fetch content from the URL. The website might block automated requests or require login. Please copy and paste the job description text manually.' });
    }

    // Clean HTML content to plain text
    let cleanText = responseText
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<(?:br|div|p|li|h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();

    if (!cleanText || cleanText.length < 40) {
      return res.status(400).json({ error: 'We could not extract readable job text from this link. Please copy and paste the job description text manually.' });
    }

    // Truncate to 15k chars for AI processing
    const truncatedRaw = cleanText.slice(0, 15000);

    // Use Gemini AI to extract only the Job Description if API Key exists
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `You are an expert HR recruitment specialist.
Extract ONLY the core Job Description (Job Title, Company Name if mentioned, Key Responsibilities, Required Skills, Qualifications, and Experience) from the following raw web text.
Filter out all website navigation menus, cookie policies, footers, advertisements, sidebars, or unrelated recommended jobs.
Return plain text formatted cleanly with section headings.

RAW WEB TEXT:
"""
${truncatedRaw}
"""`;

        const result = await model.generateContent(prompt);
        const aiText = result.response.text();
        if (aiText && aiText.trim().length > 50) {
          cleanText = aiText.trim();
        }
      } catch (aiErr) {
        console.warn('Gemini JD URL extraction fallback to cleaned HTML text:', aiErr.message);
      }
    }

    return res.json({ text: cleanText });
  } catch (err) {
    console.error('URL Extraction error:', err);
    return res.status(500).json({ error: 'An error occurred while processing the URL. Please try again.' });
  }
});

export default router;
