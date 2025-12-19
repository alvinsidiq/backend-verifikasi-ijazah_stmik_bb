// src/routes/validator.routes.js
const express = require('express');
const ValidatorController = require('../controllers/validator.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// GET /validator/me → profil validator
router.get(
  '/me',
  authMiddleware,
  roleMiddleware(['VALIDATOR']),
  ValidatorController.getMe
);

module.exports = router;
