// src/controllers/mahasiswa.controller.js
const prisma = require('../config/prisma');


const MahasiswaController = {
  // GET /mahasiswa  (ADMIN & VALIDATOR)
  async list(req, res) {
    try {
      const mahasiswaList = await prisma.mahasiswa.findMany({
        include: {
          user: true,
          prodi: true,
        },
        orderBy: {
          nim: 'asc',
        },
      });

      return res.json({
        success: true,
        data: mahasiswaList,
      });
    } catch (err) {
      console.error('Error list mahasiswa:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },


   // GET /mahasiswa/:id  (ADMIN & VALIDATOR)
  async detail(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { id },
        include: {
          user: true,
          prodi: true,
        },
      });

      if (!mahasiswa) {
        return res.status(404).json({
          success: false,
          message: 'Mahasiswa tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        data: mahasiswa,
      });
    } catch (err) {
      console.error('Error detail mahasiswa:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  }, 


  // POST /mahasiswa  (ADMIN)
  async create(req, res) {
    try {
      const {
        userId,
        nim,
        nama,
        prodiId,
        tahunMasuk,
        tahunLulus,
        tempatLahir,
        tanggalLahir,
      } = req.body;

      if (!userId || !nim || !nama || !prodiId || !tahunMasuk) {
        return res.status(400).json({
          success: false,
          message: 'userId, nim, nama, prodiId, dan tahunMasuk wajib diisi',
        });
      }

      // Pastikan user ada dan rolenya MAHASISWA
      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan',
        });
      }

      if (user.role !== 'MAHASISWA') {
        return res.status(400).json({
          success: false,
          message: 'Role user harus MAHASISWA untuk dibuatkan data mahasiswa',
        });
      }

      // Cek apakah user sudah punya data mahasiswa
      const existingMahasiswaByUser = await prisma.mahasiswa.findUnique({
        where: { userId: Number(userId) },
      });

      if (existingMahasiswaByUser) {
        return res.status(409).json({
          success: false,
          message: 'User ini sudah memiliki data mahasiswa',
        });
      }

      // Buat mahasiswa
      const newMahasiswa = await prisma.mahasiswa.create({
        data: {
          userId: Number(userId),
          nim,
          nama,
          prodiId: Number(prodiId),
          tahunMasuk: Number(tahunMasuk),
          tahunLulus: tahunLulus ? Number(tahunLulus) : null,
          tempatLahir: tempatLahir || null,
          tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null,
        },
        include: {
          user: true,
          prodi: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Data mahasiswa berhasil dibuat',
        data: newMahasiswa,
      });
    } catch (err) {
      console.error('Error create mahasiswa:', err);

      if (err.code === 'P2002') {
        // unique constraint (nim atau userId)
        return res.status(409).json({
          success: false,
          message: 'NIM atau userId sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
 // PUT /mahasiswa/:id  (ADMIN)
  async update(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const existing = await prisma.mahasiswa.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Mahasiswa tidak ditemukan',
        });
      }

      const {
        nim,
        nama,
        prodiId,
        tahunMasuk,
        tahunLulus,
        tempatLahir,
        tanggalLahir,
      } = req.body;

      const updated = await prisma.mahasiswa.update({
        where: { id },
        data: {
          nim: nim ?? existing.nim,
          nama: nama ?? existing.nama,
          prodiId: prodiId ? Number(prodiId) : existing.prodiId,
          tahunMasuk: tahunMasuk ? Number(tahunMasuk) : existing.tahunMasuk,
          tahunLulus: tahunLulus !== undefined
            ? (tahunLulus ? Number(tahunLulus) : null)
            : existing.tahunLulus,
          tempatLahir: tempatLahir !== undefined
            ? (tempatLahir || null)
            : existing.tempatLahir,
          tanggalLahir: tanggalLahir !== undefined
            ? (tanggalLahir ? new Date(tanggalLahir) : null)
            : existing.tanggalLahir,
        },
        include: {
          user: true,
          prodi: true,
        },
      });

      return res.json({
        success: true,
        message: 'Data mahasiswa berhasil diperbarui',
        data: updated,
      });
    } catch (err) {
      console.error('Error update mahasiswa:', err);

      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'NIM sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
 // DELETE /mahasiswa/:id  (ADMIN)
  async remove(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const existing = await prisma.mahasiswa.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Mahasiswa tidak ditemukan',
        });
      }

      await prisma.mahasiswa.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: 'Data mahasiswa berhasil dihapus',
      });
    } catch (err) {
      console.error('Error delete mahasiswa:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
 // GET /mahasiswa/me  (MAHASISWA)
  async me(req, res) {
    try {
      const userId = req.user.userId;

      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { userId: Number(userId) },
        include: {
          user: true,
          prodi: true,
        },
      });

      if (!mahasiswa) {
        return res.status(404).json({
          success: false,
          message: 'Data mahasiswa untuk user ini belum ditemukan',
        });
      }

      return res.json({
        success: true,
        data: mahasiswa,
      });
    } catch (err) {
      console.error('Error mahasiswa me:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
};


module.exports = MahasiswaController;