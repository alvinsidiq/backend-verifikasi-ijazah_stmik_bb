// src/controllers/ijazah.controller.js
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
require('dayjs/locale/id');
const QRCode = require('qrcode');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const prisma = require('../config/prisma');
const {
  generateIjazahHash,
  storeIjazahDummy,
  publishIjazahToBlockchain,
  computeIjazahHash,
} = require('../services/blockchain.service');
const STATUS_VALIDASI = {
  DRAFT: 'DRAFT',
  APPROVED_ADMIN: 'APPROVED_ADMIN',
  TERVALIDASI: 'TERVALIDASI',
  DITOLAK_ADMIN: 'DITOLAK_ADMIN',
  DITOLAK_VALIDATOR: 'DITOLAK_VALIDATOR',
};

dayjs.locale('id');

const DEFAULT_TEMPLATE_PATH =
  process.env.IJAZAH_TEMPLATE_PATH ||
  path.join(__dirname, '..', '..', 'assets', 'templates', 'ijazah-template.pdf');

const CAMPUS_NAME = process.env.CAMPUS_NAME || 'STMIK Bandung Bali';
const DEFAULT_FAKULTAS =
  process.env.CAMPUS_FAKULTAS_NAME || 'Fakultas Teknik';

function buildVerificationUrl(hash) {
  const base =
    (process.env.VERIFICATION_PUBLIC_BASE_URL ||
      'http://localhost:3000/verifikasi').trim();

  if (!hash) {
    return base;
  }

  if (base.includes('{hash}')) {
    return base.replace('{hash}', encodeURIComponent(hash));
  }

  if (/[?&]hash=/.test(base)) {
    if (base.trim().endsWith('hash=')) {
      return `${base}${encodeURIComponent(hash)}`;
    }
    return base;
  }

  if (base.includes('?')) {
    const separator = base.endsWith('?') || base.endsWith('&') ? '' : '&';
    return `${base}${separator}hash=${encodeURIComponent(hash)}`;
  }

  return `${base.replace(/\/$/, '')}/${encodeURIComponent(hash)}`;
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

    if (![STATUS_VALIDASI.TERVALIDASI, STATUS_VALIDASI.DITOLAK_VALIDATOR].includes(finalStatus)) {
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
        statusValidasi: finalStatus,
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
      message: `Ijazah berhasil diupdate ke status ${finalStatus}`,
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

      const templateBytes = fs.readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(templateBytes);
      const [page] = pdfDoc.getPages();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const mahasiswa = ijazah.mahasiswa;
      const prodi = mahasiswa?.prodi;
      const jenjang = prodi?.jenjang ? prodi.jenjang.toUpperCase() : '';
      const prodiFull = prodi
        ? `${prodi.namaProdi}${prodi.jenjang ? ` (${prodi.jenjang})` : ''}`
        : '-';

      const nama = mahasiswa?.nama || '-';
      const nim = mahasiswa?.nim || '-';
      const fakultas = DEFAULT_FAKULTAS;

      const ipkText =
        ijazah.ipk === null || ijazah.ipk === undefined
          ? '-'
          : Number(ijazah.ipk).toFixed(2);
      const predikat = derivePredikat(ijazah.ipk);

      const tanggalLulusText = ijazah.tanggalLulus
        ? dayjs(ijazah.tanggalLulus).format('DD MMMM YYYY')
        : '-';
      const tahunLulus =
        mahasiswa?.tahunLulus ||
        (ijazah.tanggalLulus ? dayjs(ijazah.tanggalLulus).year() : null);

      const ijazahHash =
        ijazah.blockchainRecord?.ijazahHash || computeIjazahHash(ijazah);
      const verifyUrl = buildVerificationUrl(ijazahHash);

      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0.8, scale: 6 });
      const qrBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      const qrImg = await pdfDoc.embedPng(qrBytes);

      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const left = 90;
      const headerY = pageHeight - 110;
      const bodyStartY = headerY - 60;
      const lineHeight = 18;
      const labelX = left;
      const valueX = left + 130;
      const textColor = rgb(0.15, 0.15, 0.17);
      const mutedColor = rgb(0.35, 0.35, 0.4);

      const ijazahTitle = jenjang
        ? `IJAZAH ${jenjang}`
        : 'IJAZAH SARJANA';

      page.drawText(CAMPUS_NAME.toUpperCase(), {
        x: left,
        y: headerY,
        size: 12,
        font: fontBold,
        color: textColor,
      });

      page.drawText(ijazahTitle, {
        x: left,
        y: headerY - 18,
        size: 16,
        font: fontBold,
        color: textColor,
      });

      page.drawText(`Nomor: ${ijazah.nomorIjazah}`, {
        x: left,
        y: headerY - 36,
        size: 10,
        font: fontRegular,
        color: mutedColor,
      });

      let currentY = bodyStartY;

      page.drawText('Dengan ini menyatakan bahwa:', {
        x: left,
        y: currentY,
        size: 12,
        font: fontRegular,
        color: textColor,
      });

      currentY -= 28;

      const drawRow = (label, value) => {
        page.drawText(label, {
          x: labelX,
          y: currentY,
          size: 12,
          font: fontBold,
          color: textColor,
        });
        page.drawText(String(value ?? '-'), {
          x: valueX,
          y: currentY,
          size: 12,
          font: fontRegular,
          color: textColor,
        });
        currentY -= lineHeight;
      };

      drawRow('Nama', nama.toUpperCase());
      drawRow('NIM', nim);
      drawRow('Program Studi', prodiFull);
      drawRow('Fakultas', fakultas);
      drawRow('IPK', ipkText);
      drawRow('Predikat', predikat);
      drawRow('Tanggal Lulus', tanggalLulusText);
      drawRow('Tahun Lulus', tahunLulus || '-');

      currentY -= 8;
      page.drawText(
        'Berhak memperoleh ijazah sesuai ketentuan akademik.',
        {
          x: left,
          y: currentY,
          size: 10,
          font: fontRegular,
          color: mutedColor,
        }
      );

      const qrWidth = 120;
      const qrHeight = 120;
      const qrX = pageWidth - 190;
      const qrY = 140;

      page.drawText('VERIFIKASI', {
        x: qrX,
        y: qrY + qrHeight + 18,
        size: 10,
        font: fontBold,
        color: textColor,
      });

      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrWidth, height: qrHeight });

      page.drawText('Scan untuk verifikasi', {
        x: qrX - 2,
        y: qrY - 12,
        size: 9,
        font: fontRegular,
        color: mutedColor,
      });

      const hashShort = ijazahHash
        ? `${ijazahHash.slice(0, 10)}...${ijazahHash.slice(-6)}`
        : '-';

      page.drawText(`Hash: ${hashShort}`, {
        x: qrX,
        y: qrY - 26,
        size: 8.5,
        font: fontRegular,
        color: mutedColor,
      });

      const pdfBytes = await pdfDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${ijazah.nomorIjazah}.pdf"`
      );

      return res.send(Buffer.from(pdfBytes));
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

      // Dummy kirim ke "blockchain"
      const bcResult = storeIjazahDummy(ijazahHash, ijazah.id);

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
 
  async publishOnchain(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Parameter id ijazah wajib diisi",
        });
      }

      const result = await publishIjazahToBlockchain(id);

      if (result.alreadyOnchain) {
        return res.status(200).json({
          success: true,
          message:
            "Ijazah sudah pernah tercatat di blockchain sebelumnya",
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Ijazah berhasil dipublish ke blockchain dan disimpan di BlockchainRecord",
        data: result,
      });
    } catch (error) {
      console.error("Error publishOnchain Ijazah:", error);
      const isValidationError =
        error?.message &&
        error.message.toLowerCase().includes('belum tervalidasi');

      return res.status(isValidationError ? 400 : 500).json({
        success: false,
        message:
          error.message ||
          "Terjadi kesalahan saat mempublish ijazah ke blockchain",
      });
    }
  },
};

module.exports = IjazahController;
