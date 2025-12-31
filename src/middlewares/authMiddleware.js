// src/middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');

function extractToken(req) {
  const rawAuth = req.headers['authorization'];
  const authHeader = typeof rawAuth === 'string' ? rawAuth.trim() : '';

  // header Bearer (case-insensitive)
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)/i);
  if (bearerMatch) {
    return bearerMatch[1].trim();
  }

  // header alternatif
  if (req.headers['x-access-token']) {
    return String(req.headers['x-access-token']).trim();
  }
  if (req.headers['x-token']) {
    return String(req.headers['x-token']).trim();
  }

  // fallback query param ?token= or ?access_token= (berguna untuk link download langsung)
  if (req.query?.token) return String(req.query.token).trim();
  if (req.query?.access_token) return String(req.query.access_token).trim();
  if (req.query?.jwt) return String(req.query.jwt).trim();
  if (req.query?.auth) return String(req.query.auth).trim();

  // fallback cookie sederhana (token=... atau access_token=...)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';').map((s) => s.trim());
    for (const part of parts) {
      if (part.startsWith('token=')) return decodeURIComponent(part.slice(6));
      if (part.startsWith('access_token=')) return decodeURIComponent(part.slice(13));
      if (part.startsWith('jwt=')) return decodeURIComponent(part.slice(4));
      if (part.startsWith('auth=')) return decodeURIComponent(part.slice(5));
    }
  }

  return null;
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message:
        'Authorization header tidak valid (gunakan: Bearer <token> atau query ?token=...)',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error('JWT error:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = authMiddleware;
