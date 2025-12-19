// src/controllers/ijazah.controller.js
const prisma = require('../config/prisma');
const blockchainService = require('../services/blockchain.service');
const STATUS = {
  DRAFT: 'DRAFT',
  MENUNGGU: 'MENUNGGU',
  TERVALIDASI: 'TERVALIDASI',
  DITOLAK: 'DITOLAK',
};

async function handleValidasiUpdate(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    let { statusValidasi, status, catatan } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID tidak valid',
      });
    }

    const finalStatus = (statusValidasi || status || '').toString().toUpperCase();

    if (!finalStatus) {
      return res.status(400).json({
        success: false,
        message: 'statusValidasi wajib diisi',
      });
    }

    if (![STATUS.TERVALIDASI, STATUS.DITOLAK].includes(finalStatus)) {
      return res.status(400).json({
        success: false,
        message: `Status validasi harus ${STATUS.TERVALIDASI} atau ${STATUS.DITOLAK}`,
      });
    }

    const ijazah = await prisma.ijazah.findUnique({
      where: { id },
    });

    if (!ijazah) {
      return res.status(404).json({
        success: false,
        message: 'Ijazah tidak ditemukan',
      });
    }

    if (ijazah.statusValidasi !== STATUS.MENUNGGU) {
      return res.status(400).json({
        success: false,
        message: `Ijazah dengan status ${ijazah.statusValidasi} tidak dapat divalidasi`,
      });
    }

    const updated = await prisma.ijazah.update({
      where: { id },
      data: {
        statusValidasi: finalStatus,
        validatorId: req.user.userId,
        catatanValidasi: catatan || null,
        validatedAt: new Date(),
      },
      include: {
        mahasiswa: {
          include: {
            prodi: true,
          },
        },
        validator: true,
      },
    });

    return res.json({
      success: true,
      message: `Ijazah berhasil diupdate ke status ${finalStatus}`,
      data: updated,
    });
  } catch (err) {
    console.error('Error validasi ijazah:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
  }
}


const IjazahController = {
  // GET /ijazah?status=MENUNGGU&nim=201801234
  async list(req, res) {
    try {
      const { status, nim } = req.query;

      const where = {};

      if (status) {
        where.statusValidasi = status;
      }

      if (nim) {
        where.mahasiswa = {
          nim: String(nim),
        };
      }

      const ijazahList = await prisma.ijazah.findMany({
        where,
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
          validator: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        success: true,
        data: ijazahList,
      });
    } catch (err) {
      console.error('Error list ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

  // GET /ijazah/:id
  async detail(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const ijazah = await prisma.ijazah.findUnique({
        where: { id },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
          validator: true,
        },
      });

      if (!ijazah) {
        return res.status(404).json({
          success: false,
          message: 'Ijazah tidak ditemukan',
        });
      }

      return res.json({
        success: true,
        data: ijazah,
      });
    } catch (err) {
      console.error('Error detail ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

  // POST /ijazah  (ADMIN) - buat ijazah baru dengan status DRAFT
  async create(req, res) {
    try {
      const {
        mahasiswaId,
        nomorIjazah,
        tanggalLulus,
        fileUrl,
      } = req.body;

      if (!mahasiswaId || !nomorIjazah || !tanggalLulus) {
        return res.status(400).json({
          success: false,
          message: 'mahasiswaId, nomorIjazah, dan tanggalLulus wajib diisi',
        });
      }

      // cek mahasiswa ada
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { id: Number(mahasiswaId) },
      });

      if (!mahasiswa) {
        return res.status(404).json({
          success: false,
          message: 'Mahasiswa tidak ditemukan',
        });
      }

      const newIjazah = await prisma.ijazah.create({
        data: {
          mahasiswaId: Number(mahasiswaId),
          nomorIjazah,
          tanggalLulus: new Date(tanggalLulus),
          fileUrl: fileUrl || null,
          statusValidasi: STATUS.DRAFT,
        },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Ijazah berhasil dibuat (status DRAFT)',
        data: newIjazah,
      });
    } catch (err) {
      console.error('Error create ijazah:', err);

      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Nomor ijazah sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

   // PUT /ijazah/:id  (ADMIN) - update data dasar ijazah
  async update(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const existing = await prisma.ijazah.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Ijazah tidak ditemukan',
        });
      }

      const {
        nomorIjazah,
        tanggalLulus,
        fileUrl,
      } = req.body;

      const updated = await prisma.ijazah.update({
        where: { id },
        data: {
          nomorIjazah: nomorIjazah ?? existing.nomorIjazah,
          tanggalLulus: tanggalLulus
            ? new Date(tanggalLulus)
            : existing.tanggalLulus,
          fileUrl: fileUrl !== undefined
            ? (fileUrl || null)
            : existing.fileUrl,
        },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
          validator: true,
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah berhasil diperbarui',
        data: updated,
      });
    } catch (err) {
      console.error('Error update ijazah:', err);

      if (err.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Nomor ijazah sudah digunakan',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

  // GET /ijazah/validasi/pending  (VALIDATOR)
  async getPendingForValidator(req, res) {
    try {
      const ijazahList = await prisma.ijazah.findMany({
        where: { statusValidasi: STATUS.MENUNGGU },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
          validator: true,
          blockchainRecord: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        success: true,
        message: 'Berhasil mengambil ijazah yang menunggu validasi',
        data: ijazahList,
      });
    } catch (err) {
      console.error('Error getPendingForValidator:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat daftar ijazah untuk divalidasi',
      });
    }
  },

   // POST /ijazah/:id/kirim-validasi  (ADMIN) - ubah status ke MENUNGGU
  async kirimValidasi(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      const ijazah = await prisma.ijazah.findUnique({
        where: { id },
      });

      if (!ijazah) {
        return res.status(404).json({
          success: false,
          message: 'Ijazah tidak ditemukan',
        });
      }

      if (ijazah.statusValidasi !== STATUS.DRAFT && ijazah.statusValidasi !== STATUS.DITOLAK) {
        return res.status(400).json({
          success: false,
          message: `Ijazah dengan status ${ijazah.statusValidasi} tidak bisa dikirim untuk validasi`,
        });
      }

      const updated = await prisma.ijazah.update({
        where: { id },
        data: {
          statusValidasi: STATUS.MENUNGGU,
          validatorId: null,
          catatanValidasi: null,
          validatedAt: null,
        },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah berhasil dikirim untuk validasi (status MENUNGGU)',
        data: updated,
      });
    } catch (err) {
      console.error('Error kirimValidasi ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
   }
  },

   // POST /ijazah/:id/validasi  (VALIDATOR/ADMIN)
  async validasi(req, res) {
    return handleValidasiUpdate(req, res);
  },

  // PUT /ijazah/:id/validasi  (VALIDATOR)
  async updateValidasi(req, res) {
    return handleValidasiUpdate(req, res);
  },

  // GET /ijazah/me  (MAHASISWA) - lihat ijazah miliknya sendiri
  async listForMahasiswa(req, res) {
    try {
      const userId = req.user.userId;

      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { userId: Number(userId) },
      });

      if (!mahasiswa) {
        return res.status(404).json({
          success: false,
          message: 'Data mahasiswa untuk user ini belum ditemukan',
        });
      }

      const ijazahList = await prisma.ijazah.findMany({
        where: { mahasiswaId: mahasiswa.id },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
          validator: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        success: true,
        data: ijazahList,
      });
    } catch (err) {
      console.error('Error listForMahasiswa ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },


    // POST /ijazah/:id/mint  (ADMIN / VALIDATOR) - dummy mint ke "blockchain"
  async mintDummy(req, res) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID tidak valid',
        });
      }

      // Ambil ijazah + mahasiswa + prodi
      const ijazah = await prisma.ijazah.findUnique({
        where: { id },
        include: {
          mahasiswa: {
            include: {
              prodi: true,
            },
          },
          blockchainRecord: true,
        },
      });

      if (!ijazah) {
        return res.status(404).json({
          success: false,
          message: 'Ijazah tidak ditemukan',
        });
      }

      // Hanya ijazah yang sudah TERVALIDASI yang boleh di-mint
      if (ijazah.statusValidasi !== 'TERVALIDASI') {
        return res.status(400).json({
          success: false,
          message: `Ijazah dengan status ${ijazah.statusValidasi} belum bisa di-mint ke blockchain. Harus TERVALIDASI dulu.`,
        });
      }

      // Cek apakah sudah pernah di-mint
      if (ijazah.blockchainRecord) {
        return res.status(400).json({
          success: false,
          message: 'Ijazah ini sudah memiliki record blockchain',
          data: ijazah.blockchainRecord,
        });
      }

      // Generate hash ijazah dari data mahasiswa + prodi + ijazah
      const ijazahHash = blockchainService.generateIjazahHash(
        ijazah,
        ijazah.mahasiswa
      );

      // Dummy kirim ke "blockchain"
      const bcResult = blockchainService.storeIjazahDummy(ijazahHash, ijazah.id);

      // Simpan ke tabel BlockchainRecord
      const blockchainRecord = await prisma.blockchainRecord.create({
        data: {
          ijazahId: ijazah.id,
          ijazahHash: bcResult.ijazahHash,
          contractAddress: bcResult.contractAddress,
          network: bcResult.network,
          txHash: bcResult.txHash,
          blockNumber: bcResult.blockNumber,
          statusOnchain: 'DUMMY', // sesuai enum
          explorerUrl: bcResult.explorerUrl,
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah berhasil di-mint (dummy) ke blockchain',
        data: {
          ijazahId: ijazah.id,
          ijazahHash: blockchainRecord.ijazahHash,
          txHash: blockchainRecord.txHash,
          contractAddress: blockchainRecord.contractAddress,
          network: blockchainRecord.network,
          blockNumber: blockchainRecord.blockNumber,
          statusOnchain: blockchainRecord.statusOnchain,
          explorerUrl: blockchainRecord.explorerUrl,
        },
      });
    } catch (err) {
      console.error('Error mintDummy ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
 
};

module.exports = IjazahController;
