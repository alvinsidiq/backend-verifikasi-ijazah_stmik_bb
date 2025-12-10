// src/routes/mahasiswa.routes.js
const express = require('express');
const MahasiswaController = require('../controllers/mahasiswa.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();


// Semua route mahasiswa butuh login
router.use(authMiddleware);

// ADMIN & VALIDATOR: bisa lihat list dan detail
router.get(
  '/',
  roleMiddleware(['ADMIN', 'VALIDATOR']),
  MahasiswaController.list
);

router.get(
  '/:id',
  roleMiddleware(['ADMIN', 'VALIDATOR']),
  MahasiswaController.detail
);

// ADMIN: create, update, delete
router.post(
  '/',
  roleMiddleware(['ADMIN']),
  MahasiswaController.create
);

router.put(
  '/:id',
  roleMiddleware(['ADMIN']),
  MahasiswaController.update
);

router.delete(
  '/:id',
  roleMiddleware(['ADMIN']),
  MahasiswaController.remove
);

// MAHASISWA: lihat data dirinya sendiri
router.get(
  '/me',
  roleMiddleware(['MAHASISWA']),
  MahasiswaController.me
);  



module.exports = router; 