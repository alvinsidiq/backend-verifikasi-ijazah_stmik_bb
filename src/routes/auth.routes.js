// src/routes/auth.routes.js
const express = require('express');
const AuthController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// POST /auth/login
router.post('/login', AuthController.login);


// GET /auth/me (butuh token)
router.get('/me', authMiddleware, AuthController.me);

module.exports = router;