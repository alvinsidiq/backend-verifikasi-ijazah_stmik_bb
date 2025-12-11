// src/controllers/verifikasi.controller.js
const prisma = require('../config/prisma');

const ALLOWED_VERIFIER_TYPES = ['MAHASISWA', 'PERUSAHAAN', 'ADMIN', 'SYSTEM'];

const VerifikasiController = {
  // GET /verifikasi?hash=0x...
  async byHash(req, res) {
    try {
      const { hash, verifierType, verifierInfo } = req.query;

      if (!hash) {
        return res.status(400).json({
          success: false,
          message: 'Parameter "hash" wajib diisi',
        });
      }

      // Cari record blockchain berdasarkan ijazahHash
     const bcRecord = await prisma.blockchainRecord.findFirst({
  where: {
    ijazahHash: String(hash),
  },
  include: {
    ijazah: {
      include: {
        mahasiswa: {
          include: {
            prodi: true,
          },
        },
        validator: true,
      },
    },
  },
});


      const ijazah = bcRecord.ijazah;
      const mhs = ijazah.mahasiswa;

      // Tentukan verifierType untuk log
      let vt = 'SYSTEM';
      if (verifierType) {
        const upper = String(verifierType).toUpperCase();
        if (ALLOWED_VERIFIER_TYPES.includes(upper)) {
          vt = upper;
        }
      }

      // Kumpulkan info tambahan (IP, user agent, dll) untuk log
      const infoParts = [];
      if (verifierInfo) {
        infoParts.push(`info=${verifierInfo}`);
      }
      if (req.ip) {
        infoParts.push(`ip=${req.ip}`);
      }
      if (req.headers['user-agent']) {
        infoParts.push(`ua=${req.headers['user-agent']}`);
      }
      const infoString = infoParts.join(' | ') || null;

      // Simpan log verifikasi
      await prisma.verificationLog.create({
        data: {
          ijazahId: ijazah.id,
          verifierType: vt,
          verifierInfo: infoString,
        },
      });

      // Bentuk respons yang aman (tanpa password, tanpa fileUrl kalau mau dibatasi)
      return res.json({
        success: true,
        data: {
          valid: true,
          ijazah: {
            id: ijazah.id,
            nomorIjazah: ijazah.nomorIjazah,
            tanggalLulus: ijazah.tanggalLulus,
            statusValidasi: ijazah.statusValidasi,
            catatanValidasi: ijazah.catatanValidasi,
          },
          mahasiswa: {
            id: mhs.id,
            nim: mhs.nim,
            nama: mhs.nama,
            prodi: {
              kodeProdi: mhs.prodi.kodeProdi,
              namaProdi: mhs.prodi.namaProdi,
              jenjang: mhs.prodi.jenjang,
            },
          },
          blockchain: {
            ijazahHash: bcRecord.ijazahHash,
            network: bcRecord.network,
            txHash: bcRecord.txHash,
            contractAddress: bcRecord.contractAddress,
            blockNumber: bcRecord.blockNumber,
            statusOnchain: bcRecord.statusOnchain,
            explorerUrl: bcRecord.explorerUrl,
          },
        },
      });
    } catch (err) {
      console.error('Error verifikasi byHash:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },
};

module.exports = VerifikasiController;
