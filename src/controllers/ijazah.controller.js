// src/controllers/ijazah.controller.js
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const { keccak256, toUtf8Bytes } = require("ethers");
const { generateIjazahPdfBytes } = require("../services/ijazahPdf.service");
const {
  generateIjazahHash,
  storeIjazahDummy,
  publishIjazahToBlockchain,
} = require('../services/blockchain.service');
const STATUS_VALIDASI = {
  DRAFT: 'DRAFT',
  APPROVED_ADMIN: 'APPROVED_ADMIN',
  TERVALIDASI: 'TERVALIDASI',
  DITOLAK_ADMIN: 'DITOLAK_ADMIN',
  DITOLAK_VALIDATOR: 'DITOLAK_VALIDATOR',
};

const DEFAULT_TEMPLATE_PATH =
  process.env.IJAZAH_TEMPLATE_PATH ||
  path.join(__dirname, '..', '..', 'assets', 'templates', 'ijazah-template.pdf');

const CAMPUS_NAME = process.env.CAMPUS_NAME || 'STMIK Bandung Bali';
const DEFAULT_FAKULTAS =
  process.env.CAMPUS_FAKULTAS_NAME || 'Fakultas Teknik';

function buildPdfPublicUrl(ref) {
  const base =
    (process.env.PDF_PUBLIC_BASE_URL ||
      "http://localhost:3000/ijazah/pdf?ref={ref}").trim();

  if (!ref) return base;
  if (base.includes("{ref}")) return base.replace("{ref}", encodeURIComponent(ref));

  if (base.includes("?")) {
    const sep = base.endsWith("?") || base.endsWith("&") ? "" : "&";
    return `${base}${sep}ref=${encodeURIComponent(ref)}`;
  }
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(ref)}`;
}

function computeNomorIjazahHash(nomorIjazah) {
  const s = String(nomorIjazah || "").trim();
  if (!s) return null;
  return keccak256(toUtf8Bytes(s));
}

function withJudulTa(data) {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(withJudulTa);

  // sisipkan alias judul_ta agar konsisten dengan kebutuhan frontend
  return {
    ...data,
    judul_ta:
      data.judul_ta !== undefined
        ? data.judul_ta
        : data.judulTa !== undefined
          ? data.judulTa
          : null,
  };
}

function getJudulTaFromBody(body = {}) {
  const candidates = [
    body.judulTa,
    body.judul_ta,
    body.judulTA,
    body.judul_tugas_akhir,
    body.judulTugasAkhir,
  ];

  for (const val of candidates) {
    if (val !== undefined) return val;
  }

  return undefined;
}

function normalizeStatus(raw) {
  if (!raw) return null;
  const s = raw.toString().trim().toUpperCase();

  // alias untuk kompatibilitas (kalau FE lama masih pakai)
  if (s === "MENUNGGU") return "APPROVED_ADMIN";
  if (s === "PENDING") return "APPROVED_ADMIN";
  if (s === "MENUNGGU_VALIDASI") return "APPROVED_ADMIN";

  if (s === "DITOLAK") return "DITOLAK_VALIDATOR"; // fallback legacy
  return s;
}

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
    const normalizedStatus = finalStatus === "DITOLAK" ? "DITOLAK_VALIDATOR" : finalStatus;

    if (!finalStatus) {
      return res.status(400).json({
        success: false,
        message: 'statusValidasi wajib diisi',
      });
    }

    if (![STATUS_VALIDASI.TERVALIDASI, STATUS_VALIDASI.DITOLAK_VALIDATOR].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Status validasi harus ${STATUS_VALIDASI.TERVALIDASI} atau ${STATUS_VALIDASI.DITOLAK_VALIDATOR}`,
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

    if (ijazah.statusValidasi !== STATUS_VALIDASI.APPROVED_ADMIN) {
      return res.status(400).json({
        success: false,
        message: `Ijazah dengan status ${ijazah.statusValidasi} tidak dapat divalidasi`,
      });
    }

    const validatorId = req.user?.userId ? Number(req.user.userId) : null;

    const updated = await prisma.ijazah.update({
      where: { id },
      data: {
        statusValidasi: normalizedStatus,
        validatorId,
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
      message: `Ijazah berhasil diupdate ke status ${normalizedStatus}`,
      data: withJudulTa(updated),
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
  // GET /ijazah?status=APPROVED_ADMIN&nim=201801234
  async list(req, res) {
    try {
      const { nim } = req.query;

      const statusNorm = normalizeStatus(req.query.status);

      const VALID = new Set([
        "DRAFT",
        "APPROVED_ADMIN",
        "TERVALIDASI",
        "DITOLAK_ADMIN",
        "DITOLAK_VALIDATOR",
      ]);

      if (statusNorm && !VALID.has(statusNorm)) {
        return res.status(400).json({
          success: false,
          message: `Status filter tidak valid: ${statusNorm}`,
        });
      }

      const where = {};

      if (statusNorm) {
        where.statusValidasi = statusNorm;
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
          blockchainRecord: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        success: true,
        data: withJudulTa(ijazahList),
      });
    } catch (err) {
      console.error('Error list ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

  // GET /ijazah/hash-nomor?nomorIjazah=...
  async hashNomorIjazah(req, res) {
    try {
      const nomorIjazah =
        req.query.nomorIjazah ||
        req.query.nomor ||
        req.query.no ||
        req.body?.nomorIjazah;

      if (!nomorIjazah) {
        return res.status(400).json({
          success: false,
          message: "nomorIjazah wajib diisi",
        });
      }

      const hash = computeNomorIjazahHash(nomorIjazah);

      return res.json({
        success: true,
        data: {
          nomorIjazah: String(nomorIjazah),
          nomorIjazahHash: hash,
        },
      });
    } catch (err) {
      console.error("Error hashNomorIjazah:", err);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server",
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
          blockchainRecord: true,
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
        data: withJudulTa(ijazah),
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
        ipk,
        fileUrl,
      } = req.body;
      const judulTaInput = getJudulTaFromBody(req.body);

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

      const parsedIpk =
        ipk !== undefined && ipk !== ''
          ? Number.parseFloat(ipk)
          : null;

      const sanitizedIpk = Number.isFinite(parsedIpk) ? parsedIpk : null;
      const finalStatus = STATUS_VALIDASI.DRAFT;
      const nomorIjazahHash = computeNomorIjazahHash(nomorIjazah);

      const newIjazah = await prisma.ijazah.create({
        data: {
          mahasiswaId: Number(mahasiswaId),
          nomorIjazah,
          tanggalLulus: new Date(tanggalLulus),
          ipk: sanitizedIpk,
          judulTa:
            judulTaInput === undefined
              ? null
              : judulTaInput === ''
                ? null
                : judulTaInput,
          fileUrl: fileUrl || null,
          nomorIjazahHash,
          ipfsStatus: "NOT_UPLOADED",
          statusValidasi: finalStatus,
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
        data: withJudulTa(newIjazah),
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
        mahasiswaId,
        nomorIjazah,
        tanggalLulus,
        ipk,
        fileUrl,
      } = req.body;
      const judulTaInput = getJudulTaFromBody(req.body);

      const data = {};

      if (mahasiswaId) data.mahasiswaId = Number(mahasiswaId);
      if (nomorIjazah) data.nomorIjazah = nomorIjazah;
      if (tanggalLulus) data.tanggalLulus = new Date(tanggalLulus);
      if (nomorIjazah) {
        const h = computeNomorIjazahHash(nomorIjazah);
        data.nomorIjazahHash = h;
        data.ipfsCid = null;
        data.ipfsUri = null;
        data.ipfsGatewayUrl = null;
        data.ipfsStatus = "NOT_UPLOADED";
        data.ipfsUploadedAt = null;
        data.ipfsError = null;
        data.pdfSha256 = null;
        data.pdfSizeBytes = null;
      }

      if (judulTaInput !== undefined) {
        data.judulTa = judulTaInput === '' ? null : judulTaInput;
      }

      if (ipk !== undefined) {
        const parsedIpk =
          ipk === '' || ipk === null
            ? null
            : Number.parseFloat(ipk);

        data.ipk = Number.isFinite(parsedIpk) ? parsedIpk : null;
      }

      if (fileUrl !== undefined) {
        data.fileUrl = fileUrl || null;
      }

      const updated = await prisma.ijazah.update({
        where: { id },
        data,
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
        data: withJudulTa(updated),
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
        where: { statusValidasi: STATUS_VALIDASI.APPROVED_ADMIN },
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
        data: withJudulTa(ijazahList),
      });
    } catch (err) {
      console.error('Error getPendingForValidator:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat daftar ijazah untuk divalidasi',
      });
    }
  },

   // POST /ijazah/:id/kirim-validasi  (ADMIN) - reset ke DRAFT untuk validasi ulang
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

      const allowedStatuses = [
        STATUS_VALIDASI.DRAFT,
        STATUS_VALIDASI.DITOLAK_ADMIN,
        STATUS_VALIDASI.DITOLAK_VALIDATOR,
      ];

      if (!allowedStatuses.includes(ijazah.statusValidasi)) {
        return res.status(400).json({
          success: false,
          message: `Ijazah dengan status ${ijazah.statusValidasi} tidak bisa dikembalikan ke DRAFT`,
        });
      }

      const updated = await prisma.ijazah.update({
        where: { id },
        data: {
          statusValidasi: STATUS_VALIDASI.DRAFT,
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
        message: 'Ijazah dikembalikan ke status DRAFT untuk validasi ulang',
        data: withJudulTa(updated),
      });
    } catch (err) {
      console.error('Error kirimValidasi ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
   }
  },

  // Admin menyetujui ijazah -> lanjut ke validator
  async approveByAdmin(req, res) {
    try {
      const { id } = req.params;
      const { catatan } = req.body || {};

      const ijazah = await prisma.ijazah.findUnique({
        where: { id: Number(id) },
      });

      if (!ijazah) {
        return res
          .status(404)
          .json({ success: false, message: 'Ijazah tidak ditemukan' });
      }

      if (ijazah.statusValidasi !== STATUS_VALIDASI.DRAFT) {
        return res.status(400).json({
          success: false,
          message: 'Ijazah tidak berada pada status yang bisa divalidasi Admin (harus DRAFT).',
        });
      }

      const updated = await prisma.ijazah.update({
        where: { id: ijazah.id },
        data: {
          statusValidasi: STATUS_VALIDASI.APPROVED_ADMIN,
          catatanValidasi: catatan || ijazah.catatanValidasi,
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah disetujui Admin (1/2). Menunggu validasi Validator.',
        data: withJudulTa(updated),
      });
    } catch (err) {
      console.error('Error approveByAdmin:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses validasi Admin',
      });
    }
  },

  // Admin menolak ijazah
  async rejectByAdmin(req, res) {
    try {
      const { id } = req.params;
      const { catatan } = req.body || {};

      const ijazah = await prisma.ijazah.findUnique({
        where: { id: Number(id) },
      });

      if (!ijazah) {
        return res
          .status(404)
          .json({ success: false, message: 'Ijazah tidak ditemukan' });
      }

      const updated = await prisma.ijazah.update({
        where: { id: ijazah.id },
        data: {
          statusValidasi: STATUS_VALIDASI.DITOLAK_ADMIN,
          catatanValidasi: catatan || 'Ditolak oleh Admin',
          validatorId: null,
          validatedAt: null,
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah ditolak oleh Admin',
        data: withJudulTa(updated),
      });
    } catch (err) {
      console.error('Error rejectByAdmin:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses penolakan Admin',
      });
    }
  },

  // Validator menyetujui ijazah -> jadi TERVALIDASI
  async approveByValidator(req, res) {
    try {
      const { id } = req.params;
      const { catatan } = req.body || {};
      const user = req.user;
      const validatorId = user?.userId ? Number(user.userId) : null;

      const ijazah = await prisma.ijazah.findUnique({
        where: { id: Number(id) },
      });

      if (!ijazah) {
        return res
          .status(404)
          .json({ success: false, message: 'Ijazah tidak ditemukan' });
      }

      if (ijazah.statusValidasi !== STATUS_VALIDASI.APPROVED_ADMIN) {
        return res.status(400).json({
          success: false,
          message:
            'Ijazah belum disetujui Admin atau sudah diproses Validator',
        });
      }

      const updated = await prisma.ijazah.update({
        where: { id: ijazah.id },
        data: {
          statusValidasi: STATUS_VALIDASI.TERVALIDASI,
          validatorId,
          validatedAt: new Date(),
          catatanValidasi: catatan || ijazah.catatanValidasi,
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah dinyatakan TERVALIDASI oleh Validator',
        data: withJudulTa(updated),
      });
    } catch (err) {
      console.error('Error approveByValidator:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses validasi Validator',
      });
    }
  },

  // Validator menolak ijazah
  async rejectByValidator(req, res) {
    try {
      const { id } = req.params;
      const { catatan } = req.body || {};
      const user = req.user;
      const validatorId = user?.userId ? Number(user.userId) : null;

      const ijazah = await prisma.ijazah.findUnique({
        where: { id: Number(id) },
      });

      if (!ijazah) {
        return res
          .status(404)
          .json({ success: false, message: 'Ijazah tidak ditemukan' });
      }

      if (ijazah.statusValidasi !== STATUS_VALIDASI.APPROVED_ADMIN) {
        return res.status(400).json({
          success: false,
          message:
            'Ijazah belum disetujui Admin atau sudah diproses Validator',
        });
      }

      const updated = await prisma.ijazah.update({
        where: { id: ijazah.id },
        data: {
          statusValidasi: STATUS_VALIDASI.DITOLAK_VALIDATOR,
          validatorId,
          validatedAt: new Date(),
          catatanValidasi: catatan || 'Ditolak oleh Validator',
        },
      });

      return res.json({
        success: true,
        message: 'Ijazah ditolak oleh Validator',
        data: withJudulTa(updated),
      });
    } catch (err) {
      console.error('Error rejectByValidator:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal memproses penolakan Validator',
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
          blockchainRecord: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res.json({
        success: true,
        data: withJudulTa(ijazahList),
      });
    } catch (err) {
      console.error('Error listForMahasiswa ijazah:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan pada server',
      });
    }
  },

  // GET /ijazah/:id/download  (ADMIN/VALIDATOR/MHS - tapi mhs hanya miliknya)
  async downloadPdf(req, res) {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
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
              user: true,
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

      // Mahasiswa hanya boleh unduh ijazah miliknya
      if (
        req.user?.role === 'MAHASISWA' &&
        ijazah.mahasiswa?.userId !== Number(req.user.userId)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Mahasiswa hanya dapat mengunduh ijazah miliknya sendiri',
        });
      }

      const templatePath = process.env.IJAZAH_TEMPLATE_PATH || DEFAULT_TEMPLATE_PATH;

      if (!fs.existsSync(templatePath)) {
        return res.status(500).json({
          success: false,
          message: `Template ijazah tidak ditemukan di ${templatePath}. Upload file background di lokasi tersebut atau set IJAZAH_TEMPLATE_PATH.`,
        });
      }

      if (
        req.user?.role === "MAHASISWA" &&
        ijazah.statusValidasi !== STATUS_VALIDASI.TERVALIDASI
      ) {
        return res.status(403).json({
          success: false,
          message: "Ijazah belum TERVALIDASI, belum bisa diunduh oleh mahasiswa.",
        });
      }

      let nomorHash = ijazah.nomorIjazahHash;
      if (!nomorHash) {
        nomorHash = computeNomorIjazahHash(ijazah.nomorIjazah);
        if (nomorHash) {
          await prisma.ijazah.update({
            where: { id: ijazah.id },
            data: { nomorIjazahHash: nomorHash },
          });
          ijazah.nomorIjazahHash = nomorHash;
        }
      }

      const qrUrl = buildPdfPublicUrl(nomorHash);
      const refShort = nomorHash
        ? `Ref: ${nomorHash.slice(0, 10)}...${nomorHash.slice(-6)}`
        : null;

      const pdfBuffer = await generateIjazahPdfBytes({
        ijazah,
        templatePath,
        campusName: CAMPUS_NAME,
        fakultasName: DEFAULT_FAKULTAS,
        qrUrl,
        refText: refShort,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${ijazah.nomorIjazah}.pdf"`
      );

      return res.send(pdfBuffer);
    } catch (err) {
      console.error('Error download ijazah PDF:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal generate ijazah',
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
      if (ijazah.statusValidasi !== STATUS_VALIDASI.TERVALIDASI) {
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
      const ijazahHash = generateIjazahHash(ijazah, ijazah.mahasiswa);
      const nomorIjazahHash = keccak256(
        toUtf8Bytes(ijazah.nomorIjazah || "")
      );

      // Dummy kirim ke "blockchain"
      const bcResult = storeIjazahDummy(ijazahHash, ijazah.id);

      // Simpan ke tabel BlockchainRecord
      const blockchainRecord = await prisma.blockchainRecord.create({
        data: {
          ijazahId: ijazah.id,
          ijazahHash: bcResult.ijazahHash,
          nomorIjazahHash,
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
          nomorIjazahHash: blockchainRecord.nomorIjazahHash,
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
 
  async publishOnchain(req, res) {
    try {
      const rawId = req.params.id;

      if (!rawId) {
        return res.status(400).json({
          success: false,
          message: "Parameter id ijazah wajib diisi",
          error: "Parameter id ijazah wajib diisi",
        });
      }

      const id = parseInt(rawId, 10);

      if (Number.isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "ID ijazah tidak valid",
          error: "ID ijazah harus berupa angka",
        });
      }

      const ijazah = await prisma.ijazah.findUnique({
        where: { id },
        select: { id: true, statusValidasi: true },
      });

      if (!ijazah) {
        return res.status(404).json({
          success: false,
          message: "Ijazah tidak ditemukan",
          error: "Ijazah tidak ditemukan",
        });
      }

      if (ijazah.statusValidasi !== STATUS_VALIDASI.TERVALIDASI) {
        return res.status(400).json({
          success: false,
          message: "Ijazah harus TERVALIDASI sebelum publish on-chain",
          error: "StatusValidasi harus TERVALIDASI",
        });
      }

      const result = await publishIjazahToBlockchain(id);

      const responseData = {
        txHash: result.txHash,
        nomorIjazahHash: result.nomorIjazahHash,
        alreadyOnchain: result.alreadyOnchain,
        statusOnchain: result.statusOnchain,
        network: result.network,
        chainId: result.chainId,
        blockNumber: result.blockNumber,
        publishedAt: result.publishedAt,
      };

      return res.status(200).json({
        success: true,
        message: result.alreadyOnchain
          ? "Ijazah sudah pernah tercatat di blockchain sebelumnya"
          : "Ijazah berhasil dipublish ke blockchain dan disimpan di BlockchainRecord",
        data: responseData,
      });
    } catch (error) {
      console.error("Error publishOnchain Ijazah:", error);
      const isValidationError =
        error?.message &&
        error.message.toLowerCase().includes("tervalidasi");

      return res.status(isValidationError ? 400 : 500).json({
        success: false,
        message: isValidationError
          ? "Ijazah harus TERVALIDASI sebelum publish on-chain"
          : "Gagal publish on-chain",
        error:
          error?.message ||
          "Terjadi kesalahan saat mempublish ijazah ke blockchain",
      });
    }
  },

  async deleteIjazah(req, res) {
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
        select: { id: true, statusValidasi: true },
      });

      if (!ijazah) {
        return res.status(404).json({ success: false, message: "Ijazah tidak ditemukan" });
      }

      const st = (ijazah.statusValidasi || "").toString().toUpperCase();

      const bolehHapus = ["DRAFT", "DITOLAK_ADMIN", "DITOLAK_VALIDATOR"].includes(st);
      if (!bolehHapus) {
        return res.status(400).json({
          success: false,
          message: `Ijazah tidak bisa dihapus pada status: ${st}`,
        });
      }

      // Hapus record blockchain record kalau ada (biar tidak orphan)
      await prisma.blockchainRecord.deleteMany({ where: { ijazahId: id } });

      // Hapus ijazah (mahasiswa/prodi tidak dihapus karena relasi)
      await prisma.ijazah.delete({ where: { id } });

      return res.status(200).json({ success: true, data: { id } });
    } catch (err) {
      console.error("deleteIjazah error:", err);
      return res.status(500).json({ success: false, message: "Gagal menghapus ijazah" });
    }
  },
};

module.exports = IjazahController;
