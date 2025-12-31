// src/controllers/mahasiswa.controller.js
const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');


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
      console.log("BODY CREATE /mahasiswa:", req.body);

      let {
        email,       // 👈 wajib: untuk akun user
        password,    // 👈 wajib: password awal akun
        nim,
        nama,
        prodiId,
        tahunMasuk,
        tahunLulus,
        tempatLahir,
        tanggalLahir,
        alamat,
        noTelepon,
        foto,
        status,
      } = req.body;

      const fotoPath = req.file
        ? `/uploads/mahasiswa/${req.file.filename}`
        : null;

      prodiId = prodiId ? Number(prodiId) : null;
      tahunMasuk = tahunMasuk ? Number(tahunMasuk) : null;
      tahunLulus = tahunLulus ? Number(tahunLulus) : null;

      const mahasiswaEmail =
        req.body.mahasiswaEmail ??
        req.body.emailMahasiswa ??
        req.body.emailKontak ??
        req.body.email;

      // ✅ VALIDASI WAJIB
      if (!email || !password || !nim || !nama || !prodiId || !tahunMasuk) {
        return res.status(400).json({
          success: false,
          message:
            "email, password, nim, nama, prodiId, dan tahunMasuk wajib diisi",
        });
      }

      // 🔍 Cek: email sudah dipakai user lain?
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message:
            "Email sudah digunakan oleh user lain. Gunakan email lain untuk akun mahasiswa ini.",
        });
      }

      // 🔐 Hash password (samakan dengan di auth.controller)
      const hashedPassword = await bcrypt.hash(password, 10);

      // 👤 Buat akun user MAHASISWA
      const user = await prisma.user.create({
        data: {
          name: nama,
          email,
          passwordHash: hashedPassword,
          role: "MAHASISWA",
        },
      });

      // 🔁 Cek (opsional, mestinya belum ada): apakah user ini sudah punya mahasiswa?
      const existingMahasiswa = await prisma.mahasiswa.findUnique({
        where: { userId: user.id },
      });

      if (existingMahasiswa) {
        return res.status(400).json({
          success: false,
          message:
            "Mahasiswa untuk user ini sudah terdaftar. (Ini seharusnya jarang terjadi)",
        });
      }

      console.log("FINAL USER ID (baru dibuat):", user.id);

      // 🎓 Buat data Mahasiswa
      const mahasiswa = await prisma.mahasiswa.create({
        data: {
          userId: user.id,
          nim,
          nama,
          prodi: { connect: { id: prodiId } },
          tahunMasuk,
          tahunLulus: tahunLulus || null,
          tempatLahir: tempatLahir || null,
          tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null,
          alamat: alamat || null,
          email: mahasiswaEmail || null,
          noTelepon: noTelepon || null,
          foto: fotoPath ?? (foto || null),
          status: status || 'AKTIF',
        },
        include: {
          prodi: true,
        },
      });

      return res.status(201).json({
        success: true,
        message:
          "Akun user MAHASISWA dan data mahasiswa berhasil dibuat.",
        data: mahasiswa,
      });
    } catch (error) {
      console.error("Error create mahasiswa:", error);

      if (error.code === "P2002") {
        // unique constraint (misal NIM sudah dipakai)
        return res.status(400).json({
          success: false,
          message:
            "Data mahasiswa melanggar unique constraint (misalnya NIM sudah dipakai).",
        });
      }

      if (error.code === "P2003" && error.meta?.field_name?.includes("userId")) {
        return res.status(400).json({
          success: false,
          message:
            "Gagal membuat data mahasiswa karena userId tidak valid.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat membuat data mahasiswa",
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
        alamat,
        email,
        noTelepon,
        foto,
        status,
      } = req.body;

      const fotoPath = req.file
        ? `/uploads/mahasiswa/${req.file.filename}`
        : undefined;

      const prodiIdNumber = prodiId ? Number(prodiId) : null;

      const dataToUpdate = {
        nim: nim ?? existing.nim,
        nama: nama ?? existing.nama,
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
        alamat: alamat !== undefined ? (alamat || null) : existing.alamat,
        email: email !== undefined ? (email || null) : existing.email,
        noTelepon: noTelepon !== undefined ? (noTelepon || null) : existing.noTelepon,
        status: status !== undefined ? (status || null) : existing.status,
      };

      if (prodiIdNumber) {
        dataToUpdate.prodi = { connect: { id: prodiIdNumber } };
      }

      if (fotoPath !== undefined) {
        dataToUpdate.foto = fotoPath;
      } else if (foto !== undefined) {
        dataToUpdate.foto = foto || null;
      } else {
        dataToUpdate.foto = existing.foto;
      }

      const updated = await prisma.mahasiswa.update({
        where: { id },
        data: dataToUpdate,
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
