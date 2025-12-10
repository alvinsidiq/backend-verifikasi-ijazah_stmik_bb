// src/routes/programStudi.routes.js
const express = require('express');
const ProgramStudiController = require('../controllers/programStudi.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');


const router = express.Router();

// Semua endpoint program studi butuh login
router.use(authMiddleware);

// GET /program-studi (boleh diakses semua role yang sudah login)
router.get('/', ProgramStudiController.list);

// GET /program-studi/:id (boleh diakses semua role yang sudah login)
router.get('/:id', ProgramStudiController.detail);

// Hanya ADMIN yang boleh create/update/delete
router.post('/', roleMiddleware(['ADMIN']), ProgramStudiController.create);
router.put('/:id', roleMiddleware(['ADMIN']), ProgramStudiController.update);
router.delete('/:id', roleMiddleware(['ADMIN']), ProgramStudiController.remove);

module.exports = router;
