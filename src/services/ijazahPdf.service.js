const fs = require("fs");
const dayjs = require("dayjs");
require("dayjs/locale/id");
const QRCode = require("qrcode");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

dayjs.locale("id");

function derivePredikat(ipk) {
  if (ipk === null || ipk === undefined) return "-";
  const num = Number(ipk);
  if (!Number.isFinite(num)) return "-";
  if (num >= 3.51) return "Dengan Pujian";
  if (num >= 3.01) return "Sangat Memuaskan";
  if (num >= 2.76) return "Memuaskan";
  return "Lulus";
}

/**
 * generateIjazahPdfBytes
 * - ijazah harus sudah include mahasiswa + prodi
 * - qrUrl = URL stabil (nanti redirect ke IPFS gateway)
 */
async function generateIjazahPdfBytes({
  ijazah,
  templatePath,
  campusName,
  fakultasName,
  qrUrl,
  refText,
}) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template ijazah tidak ditemukan di ${templatePath}`);
  }

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const [page] = pdfDoc.getPages();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const mahasiswa = ijazah.mahasiswa;
  const prodi = mahasiswa?.prodi;

  const jenjang = prodi?.jenjang ? prodi.jenjang.toUpperCase() : "";
  const prodiFull = prodi
    ? `${prodi.namaProdi}${prodi.jenjang ? ` (${prodi.jenjang})` : ""}`
    : "-";

  const nama = mahasiswa?.nama || "-";
  const nim = mahasiswa?.nim || "-";

  const ipkText =
    ijazah.ipk === null || ijazah.ipk === undefined
      ? "-"
      : Number(ijazah.ipk).toFixed(2);
  const predikat = derivePredikat(ijazah.ipk);

  const tanggalLulusText = ijazah.tanggalLulus
    ? dayjs(ijazah.tanggalLulus).format("DD MMMM YYYY")
    : "-";
  const tahunLulus =
    mahasiswa?.tahunLulus ||
    (ijazah.tanggalLulus ? dayjs(ijazah.tanggalLulus).year() : null);

  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 0.8, scale: 6 });
  const qrBytes = Buffer.from(qrDataUrl.split(",")[1], "base64");
  const qrImg = await pdfDoc.embedPng(qrBytes);

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  const left = 90;
  const headerY = pageHeight - 110;
  const bodyStartY = headerY - 60;
  const lineHeight = 18;

  const textColor = rgb(0.15, 0.15, 0.17);
  const mutedColor = rgb(0.35, 0.35, 0.4);

  const ijazahTitle = jenjang ? `IJAZAH ${jenjang}` : "IJAZAH";

  page.drawText((campusName || "").toUpperCase(), {
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

  page.drawText("Dengan ini menyatakan bahwa:", {
    x: left,
    y: currentY,
    size: 12,
    font: fontRegular,
    color: textColor,
  });

  currentY -= 28;

  const labelX = left;
  const valueX = left + 130;

  const drawRow = (label, value) => {
    page.drawText(label, {
      x: labelX,
      y: currentY,
      size: 12,
      font: fontBold,
      color: textColor,
    });
    page.drawText(String(value ?? "-"), {
      x: valueX,
      y: currentY,
      size: 12,
      font: fontRegular,
      color: textColor,
    });
    currentY -= lineHeight;
  };

  drawRow("Nama", nama.toUpperCase());
  drawRow("NIM", nim);
  drawRow("Program Studi", prodiFull);
  drawRow("Fakultas", fakultasName || "-");
  drawRow("IPK", ipkText);
  drawRow("Predikat", predikat);
  drawRow("Tanggal Lulus", tanggalLulusText);
  drawRow("Tahun Lulus", tahunLulus || "-");

  const qrWidth = 120;
  const qrHeight = 120;
  const qrX = pageWidth - 190;
  const qrY = 140;

  page.drawText("DOKUMEN (IPFS)", {
    x: qrX,
    y: qrY + qrHeight + 18,
    size: 10,
    font: fontBold,
    color: textColor,
  });

  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrWidth, height: qrHeight });

  page.drawText("Scan untuk membuka dokumen", {
    x: qrX - 6,
    y: qrY - 12,
    size: 9,
    font: fontRegular,
    color: mutedColor,
  });

  if (refText) {
    page.drawText(refText, {
      x: qrX,
      y: qrY - 26,
      size: 8.5,
      font: fontRegular,
      color: mutedColor,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

module.exports = { generateIjazahPdfBytes };
