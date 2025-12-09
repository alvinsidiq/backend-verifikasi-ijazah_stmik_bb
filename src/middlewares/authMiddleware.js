// src/middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];

    // harus ada header Authorization bertipe Bearer 
    if (!authHeader || !authHeader.startsWith('Bearer ')) {

        return res.status(401).json({
        success: false,
        message: 'Authorization header tidak valid ', 
    
    });

    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

req.user ={

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