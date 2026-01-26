// src/controllers/auth.controller.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    }
  );
}


const AuthController = {
  // POST /auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email dan password wajib diisi',
        });
      }


      // Cari user berdasarkan email
      const user = await prisma.user.findUnique({
        where: { email },
      });


      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password salah',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Akun tidak aktif, hubungi admin',
        });
      }

      // Cocokkan password dengan passwordHash
      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password salah',
        });
      }

      // Generate JWT
      const token = generateToken(user);

      return res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      });
    } catch (err) {
      console.error('Error login:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
  

  // POST /auth/register  (hanya ADMIN)
  async register(req, res) {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, dan password wajib diisi',
        });
      }

      //Role yang diijinkan (harus sama dengan enum Role di Prisma)
      const allowedRoles = ['ADMIN', 'VALIDATOR', 'MAHASISWA'];

      const finalRole = role && allowedRoles.includes(role)
        ? role
        : 'MAHASISWA'; // default kalau role kosong / tidak valid

      // cek user sudah ada belum
      const existing = await prisma.user.findUnique({
        where: { email },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Email sudah terdaftar',
        });
      }

      // hash password
      const passwordHash = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: finalRole,
          isActive: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'User berhasil didaftarkan',
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (err) {
      console.error('Error register:', err);

      // Tangani error unik email (Prisma P2002)
      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Email sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },



  // GET /auth/me
  async me(req, res) {
    try {
      // req.user sudah di-set oleh authMiddleware
      return res.json({
        success: true,
        data: req.user,
      });
    } catch (err) {
      console.error('Error me:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
};


module.exports = AuthController;

