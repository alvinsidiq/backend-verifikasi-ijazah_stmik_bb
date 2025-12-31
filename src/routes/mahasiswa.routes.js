// src/routes/mahasiswa.routes.js
const express = require('express');
const MahasiswaController = require('../controllers/mahasiswa.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const uploadFotoMahasiswa = require('../middlewares/uploadFotoMahasiswa.middleware');

const router = express.Router();


// Semua route mahasiswa butuh login
router.use(authMiddleware);


// MAHASISWA: lihat data dirinya sendiri
// PENTING: letakkan sebelum '/:id' agar tidak tertangkap sebagai param id
router.get(
  '/me',
  roleMiddleware(['MAHASISWA']),
  MahasiswaController.me
);  


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
  uploadFotoMahasiswa.single('foto'),
  MahasiswaController.create
);

router.put(
  '/:id',
  roleMiddleware(['ADMIN']),
  uploadFotoMahasiswa.single('foto'),
  MahasiswaController.update
);

router.delete(
  '/:id',
  roleMiddleware(['ADMIN']),
  MahasiswaController.remove
);


module.exports = router; 
