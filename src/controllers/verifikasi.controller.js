// src/controllers/verifikasi.controller.js
const prisma = require('../config/prisma');

const ALLOWED_VERIFIER_TYPES = ['MAHASISWA', 'PERUSAHAAN', 'ADMIN', 'SYSTEM'];

function normalizeBytes32Hex(input) {
  if (!input) return null;
  let h = input.toString().trim();
  if (!h) return null;

  // kalau user kirim tanpa 0x, tambahkan
  if (!h.startsWith('0x')) h = '0x' + h;

  // validasi: 0x + 64 hex
  const ok = /^0x[0-9a-fA-F]{64}$/.test(h);
  return ok ? h.toLowerCase() : null;
}

function derivePredikat(ipk) {
  if (ipk === null || ipk === undefined) return '-';
  const num = Number(ipk);
  if (!Number.isFinite(num)) return '-';
  if (num >= 3.51) return 'Dengan Pujian';
  if (num >= 3.01) return 'Sangat Memuaskan';
  if (num >= 2.76) return 'Memuaskan';
  return 'Lulus';
}

const VerifikasiController = {
  // GET /verifikasi?hash=0x...
  async byHash(req, res) {
    try {
      const rawHash = req.query.hash;
      const hash = normalizeBytes32Hex(rawHash);

      if (!hash) {
        return res.status(200).json({
          success: true,
          data: {
            valid: false,
            reason: 'INVALID_HASH_FORMAT',
            hashInput: rawHash || '',
          },
        });
      }

      // Cari record blockchain berdasarkan hash
      const bcRecord = await prisma.blockchainRecord.findUnique({
        where: { ijazahHash: hash },
        include: {
          ijazah: {
            include: {
              mahasiswa: { include: { prodi: true } },
            },
          },
        },
      });

      if (!bcRecord) {
        // (opsional) catat log verifikasi walau tidak ketemu
        // await prisma.verificationLog.create({ data: { ijazahHash: hash, hasil: "HASH_NOT_FOUND" } });

        return res.status(200).json({
          success: true,
          data: {
            valid: false,
            reason: 'HASH_NOT_FOUND',
            hashInput: hash,
          },
        });
      }

      // Guard data
      if (!bcRecord.ijazah || !bcRecord.ijazah.mahasiswa) {
        return res.status(200).json({
          success: true,
          data: {
            valid: false,
            reason: 'DATA_INCOMPLETE',
            hashInput: hash,
          },
        });
      }

      const ijazah = bcRecord.ijazah;
      const mahasiswa = ijazah.mahasiswa;

      // Response “siap migrasi on-chain”
      return res.status(200).json({
        success: true,
        data: {
          valid: true,
          source: 'db', // nanti bisa "chain"
          hashInput: hash,

          ijazah: {
            id: ijazah.id,
            nomorIjazah: ijazah.nomorIjazah,
            tanggalTerbit: ijazah.tanggalLulus, // Sesuai schema: tanggalLulus
            ipk: ijazah.ipk,
            predikat: derivePredikat(ijazah.ipk),
            judulSkripsi: ijazah.judulTa, // Sesuai schema: judulTa
            statusValidasi: ijazah.statusValidasi,
            fileUrl: ijazah.fileUrl || null,
          },

          mahasiswa: {
            id: mahasiswa.id,
            nama: mahasiswa.nama,
            nim: mahasiswa.nim,
            prodi: mahasiswa.prodi
              ? { id: mahasiswa.prodi.id, nama: mahasiswa.prodi.namaProdi, jenjang: mahasiswa.prodi.jenjang }
              : null,
          },

          blockchain: {
            ijazahHash: bcRecord.ijazahHash,
            txHash: bcRecord.txHash || null,
            blockNumber: bcRecord.blockNumber ?? null,
            network: bcRecord.network || null,
            statusOnchain: bcRecord.statusOnchain || null,
            publishedAt: bcRecord.createdAt || null, // Sesuai schema: createdAt
          },
        },
      });
    } catch (err) {
      console.error('verifikasiByHash error:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat verifikasi',
      });
    }
  },
};

module.exports = VerifikasiController;
