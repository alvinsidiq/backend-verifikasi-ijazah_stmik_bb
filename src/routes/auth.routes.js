// src/routes/auth.routes.js
const express = require('express');
const AuthController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const router = express.Router();

// POST /auth/login
router.post('/login', AuthController.login);


// POST /auth/register  (hanya ADMIN yang sudah login)
router.post(
  '/register',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  AuthController.register
);

// GET /auth/me (butuh token)
router.get('/me', authMiddleware, AuthController.me);

module.exports = router;