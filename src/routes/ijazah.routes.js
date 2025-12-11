// src/routes/ijazah.routes.js
const express = require('express');
const IjazahController = require('../controllers/ijazah.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

// Semua butuh login
router.use(authMiddleware);

// MAHASISWA: lihat ijazah milik sendiri
router.get(
  '/me',
  roleMiddleware(['MAHASISWA']),
  IjazahController.listForMahasiswa
);

// ADMIN & VALIDATOR: list dan detail
router.get(
  '/',
  roleMiddleware(['ADMIN', 'VALIDATOR']),
  IjazahController.list
);

router.get(
  '/:id',
  roleMiddleware(['ADMIN', 'VALIDATOR']),
  IjazahController.detail
);

// ADMIN: buat & update ijazah, kirim untuk validasi
router.post(
  '/',
  roleMiddleware(['ADMIN']),
  IjazahController.create
);

router.put(
  '/:id',
  roleMiddleware(['ADMIN']),
  IjazahController.update
);

router.post(
  '/:id/kirim-validasi',
  roleMiddleware(['ADMIN']),
  IjazahController.kirimValidasi
);

// VALIDATOR & ADMIN: melakukan validasi (setujui / tolak)
router.post(
  '/:id/validasi',
  roleMiddleware(['VALIDATOR', 'ADMIN']),
  IjazahController.validasi
);

module.exports = router;
