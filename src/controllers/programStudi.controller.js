// src/controllers/programStudi.controller.js
const prisma = require('../config/prisma');


const ProgramStudiController = {
  // GET /program-studi
  async list(req, res) {
    try {
      const prodiList = await prisma.programStudi.findMany({
        orderBy: { kodeProdi: 'asc' },
      });

      return res.json({
        success: true,
        data: prodiList,
      });
    } catch (err) {
      console.error('Error list program studi:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

  // GET /program-studi/:id
  async detail(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const prodi = await prisma.programStudi.findUnique({
        where: { id },
      });

      if (!prodi) {
        return res.status(404).json({
          success: false,
          message: 'Program studi tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        data: prodi,
      });
    } catch (err) {
      console.error('Error detail program studi:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },


    // POST /program-studi
  async create(req, res) {
    try {
      const { kodeProdi, namaProdi, jenjang } = req.body;

      if (!kodeProdi || !namaProdi || !jenjang) {
        return res.status(400).json({
          success: false,
          message: 'kodeProdi, namaProdi, dan jenjang wajib diisi',
        });
      }

      const newProdi = await prisma.programStudi.create({
        data: {
          kodeProdi,
          namaProdi,
          jenjang,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Program studi berhasil dibuat',
        data: newProdi,
      });
    } catch (err) {
      console.error('Error create program studi:', err);

      if (err.code === 'P2002') {
        // unique constraint (misal: kodeProdi duplikat)
        return res.status(409).json({
          success: false,
          message: 'Kode program studi sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },


   // PUT /program-studi/:id
  async update(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { kodeProdi, namaProdi, jenjang } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const existing = await prisma.programStudi.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Program studi tidak ditemukan',
        });
      }

      const updated = await prisma.programStudi.update({
        where: { id },
        data: {
          // kalau field tidak dikirim, pakai nilai lama
          kodeProdi: kodeProdi ?? existing.kodeProdi,
          namaProdi: namaProdi ?? existing.namaProdi,
          jenjang: jenjang ?? existing.jenjang,
        },
      });

      return res.json({
        success: true,
        message: 'Program studi berhasil diperbarui',
        data: updated,
      });
    } catch (err) {
      console.error('Error update program studi:', err);

      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Kode program studi sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },


   // DELETE /program-studi/:id
  async remove(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const existing = await prisma.programStudi.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Program studi tidak ditemukan',
        });
      }

      await prisma.programStudi.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: 'Program studi berhasil dihapus',
      });
    } catch (err) {
      console.error('Error delete program studi:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
};


module.exports = ProgramStudiController;