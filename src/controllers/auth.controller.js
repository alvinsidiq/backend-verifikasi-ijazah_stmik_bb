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

