// src/controllers/validator.controller.js
const prisma = require('../config/prisma');

const ValidatorController = {
  async getMe(req, res) {
    try {
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan',
        });
      }

      if (user.role !== 'VALIDATOR') {
        return res.status(403).json({
          success: false,
          message: 'Akun ini bukan validator',
        });
      }

      const totalValidasi = await prisma.ijazah.count({
        where: {
          validatorId: user.id,
          statusValidasi: 'TERVALIDASI',
        },
      });

      return res.json({
        success: true,
        message: 'Berhasil mengambil profil validator',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          totalValidasi,
        },
      });
    } catch (error) {
      console.error('Error getMe validator:', error);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data validator',
      });
    }
  },
};

module.exports = ValidatorController;
