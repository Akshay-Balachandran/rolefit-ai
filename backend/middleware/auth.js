import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in.' });
    }

    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_only';
    const decoded = jwt.verify(token, secret);
    
    // Attach the user ID to the request object
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in.' });
  }
};
