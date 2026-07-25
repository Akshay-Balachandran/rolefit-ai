import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resume.js';
import atsRoutes from './routes/ats.js';
import profileRoutes from './routes/profile.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Warn about missing environment variables, but do not crash on startup
const requiredEnv = ['MONGODB_URI', 'GEMINI_API_KEY', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(`\n[WARNING] Missing environment variables: ${missingEnv.join(', ')}`);
  console.warn('The server will start, but some features (Database, AI Resume Tailoring, Auth) may fail.\n');
}

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch((err) => {
      console.error('Failed to connect to MongoDB on startup. Check MONGODB_URI.');
      console.error(err.message);
    });
} else {
  console.warn('Skipping MongoDB connection because MONGODB_URI is not set.');
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/ats', atsRoutes);
app.use('/api/profile', profileRoutes);

// Public Health Check Route
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Wildcard API error handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`RoleFit AI Server running on port ${PORT}`);
});
