import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dns from 'dns/promises';
import User from '../models/User.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all fields (name, email, password).' });
    }

    const cleanEmail = email.toLowerCase().trim();
    
    // Simple email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Verify if email domain has valid MX records
    const domain = cleanEmail.split('@')[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return res.status(400).json({ error: 'The email domain does not exist or cannot receive emails.' });
      }
    } catch (dnsErr) {
      return res.status(400).json({ error: 'The email domain is invalid or does not exist.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create and save user
    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
    });
    await newUser.save();

    // Generate JWT token (valid for 7 days)
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_only';
    const token = jwt.sign({ id: newUser._id }, secret, { expiresIn: '7d' });

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to register. Please try again later.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    const loginFailMessage = "Invalid email or password. If you don't have an account yet, please register first.";

    if (!user) {
      return res.status(401).json({ error: loginFailMessage });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: loginFailMessage });
    }

    // Generate JWT token (valid for 7 days)
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_only';
    const token = jwt.sign({ id: user._id }, secret, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to log in. Please try again later.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Google ID Token is required.' });
    }

    // Verify ID Token with Google tokeninfo endpoint
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const payload = await response.json();

    if (!response.ok || payload.error_description) {
      return res.status(400).json({ error: payload.error_description || 'Invalid Google ID Token.' });
    }

    const { email, name } = payload;
    if (!email) {
      return res.status(400).json({ error: 'Google account is missing an email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Find or create user
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      // Create a user with a long random password for local schema compliance
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      user = new User({
        name: name || 'Google User',
        email: cleanEmail,
        passwordHash,
      });
      await user.save();
    }

    // Generate JWT token (valid for 7 days)
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_only';
    const token = jwt.sign({ id: user._id }, secret, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Google Auth Error:', error.message);
    return res.status(500).json({ error: 'Failed to authenticate with Google. Please try again.' });
  }
});

export default router;
