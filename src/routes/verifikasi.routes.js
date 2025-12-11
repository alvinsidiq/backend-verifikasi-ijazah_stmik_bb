// src/routes/verifikasi.routes.js
const express = require('express');
const VerifikasiController = require('../controllers/verifikasi.controller');

const router = express.Router();

// Publik: verifikasi ijazah berdasarkan hash
router.get('/', VerifikasiController.byHash);

module.exports = router;
