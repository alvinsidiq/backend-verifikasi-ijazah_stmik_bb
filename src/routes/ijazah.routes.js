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

// VALIDATOR: lihat ijazah yang menunggu validasi
router.get(
  '/validasi/pending',
  roleMiddleware(['VALIDATOR']),
  IjazahController.getPendingForValidator
);

// ADMIN & VALIDATOR: list dan detail
router.get(
  '/',
  roleMiddleware(['ADMIN', 'VALIDATOR']),
  IjazahController.list
);

router.get(
  '/:id/download',
  roleMiddleware(['ADMIN', 'VALIDATOR', 'MAHASISWA']),
  IjazahController.downloadPdf
);

router.post(
  '/:id/ipfs',
  roleMiddleware(['ADMIN', 'VALIDATOR']),
  IjazahController.uploadIjazahToIpfs
);

router.get(
  '/hash-nomor',
  roleMiddleware(['ADMIN']),
  IjazahController.hashNomorIjazah
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

router.delete(
  '/:id',
  roleMiddleware(['ADMIN']),
  IjazahController.deleteIjazah
);

router.post(
  '/:id/kirim-validasi',
  roleMiddleware(['ADMIN']),
  IjazahController.kirimValidasi
);

// Admin validasi
router.post(
  '/:id/validasi/admin-approve',
  roleMiddleware(['ADMIN']),
  IjazahController.approveByAdmin
);

router.post(
  '/:id/validasi/admin-reject',
  roleMiddleware(['ADMIN']),
  IjazahController.rejectByAdmin
);

// Validator validasi
router.post(
  '/:id/validasi/validator-approve',
  roleMiddleware(['VALIDATOR']),
  IjazahController.approveByValidator
);

router.post(
  '/:id/validasi/validator-reject',
  roleMiddleware(['VALIDATOR']),
  IjazahController.rejectByValidator
);

// VALIDATOR & ADMIN: melakukan validasi (setujui / tolak)
router.post(
  '/:id/validasi',
  roleMiddleware(['VALIDATOR', 'ADMIN']),
  IjazahController.validasi
);

router.put(
  '/:id/validasi',
  roleMiddleware(['VALIDATOR']),
  IjazahController.updateValidasi
);

// Admin publish ijazah ke blockchain
router.post(
  '/:id/publish-onchain',
  roleMiddleware(['ADMIN']),
  IjazahController.publishOnchain
);

// VALIDATOR & ADMIN: mint dummy ke "blockchain"
router.post(
  '/:id/mint',
  roleMiddleware(['VALIDATOR', 'ADMIN']),
  IjazahController.mintDummy
);

module.exports = router;
