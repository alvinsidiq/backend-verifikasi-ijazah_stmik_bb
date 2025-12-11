// src/services/blockchain.service.js
const crypto = require('crypto');

/**
 * Generate hash ijazah berbasis data penting ijazah + mahasiswa.
 * HANYA menyimpan hash di blockchain (bukan file pdf).
 *
 * Format string yang di-hash (harus konsisten):
 *   nim|nama|kodeProdi|nomorIjazah|tanggalLulus(YYYY-MM-DD)
 */
function generateIjazahHash(ijazah, mahasiswa) {
  if (!ijazah || !mahasiswa || !mahasiswa.prodi) {
    throw new Error('Data ijazah/mahasiswa/prodi tidak lengkap untuk generate hash');
  }

  const tanggalLulusDate = new Date(ijazah.tanggalLulus);
  const tanggalLulusStr = tanggalLulusDate.toISOString().slice(0, 10); // YYYY-MM-DD

  const dataString = [
    mahasiswa.nim,
    mahasiswa.nama,
    mahasiswa.prodi.kodeProdi,
    ijazah.nomorIjazah,
    tanggalLulusStr,
  ]
    .map((v) => String(v).trim().toLowerCase())
    .join('|');

  const hash = crypto.createHash('sha256').update(dataString).digest('hex');

  // tambahkan prefix 0x supaya mirip hash di blockchain
  return '0x' + hash;
}

/**
 * Dummy store ke "blockchain"
 * Di tahap ini, kita hanya membuat data palsu (tidak benar-benar ke Polygon).
 */
function storeIjazahDummy(ijazahHash, ijazahId) {
  const now = Date.now().toString(16);

  const txHash = '0xDUMMYTX_' + ijazahId + '_' + now;
  const contractAddress = '0xDUMMYCONTRACT_' + ijazahId;
  const blockNumber = 0;
  const network = 'polygon-mumbai';
  const explorerUrl = `https://dummy-explorer/polygon-mumbai/tx/${txHash}`;

  return {
    ijazahHash,
    txHash,
    contractAddress,
    blockNumber,
    network,
    explorerUrl,
    statusOnchain: 'DUMMY',
  };
}

module.exports = {
  generateIjazahHash,
  storeIjazahDummy,
};
