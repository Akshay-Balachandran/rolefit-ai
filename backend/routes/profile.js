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

export default router;
