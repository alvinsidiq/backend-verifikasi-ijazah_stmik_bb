// src/services/blockchain.service.js
const crypto = require('crypto');
const { ethers } = require("ethers");
const prisma = require("../config/prisma");
const { ijazahRegistryContract } = require("../config/blockchain");

const NETWORK_NAME =
  process.env.BLOCKCHAIN_NETWORK_NAME || "LOCALHARDHAT";

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

/**
 * Hitung hash ijazah (bytes32) dari data penting ijazah.
 * Kalau di DB sudah ada ijazahHash, pakai itu saja.
 */
function computeIjazahHash(ijazah) {
  if (ijazah.ijazahHash) {
    return ijazah.ijazahHash;
  }

  const nomorIjazah = ijazah.nomorIjazah || "";
  const nim = ijazah.mahasiswa?.nim || "";
  const nama = ijazah.mahasiswa?.nama || "";
  const tglLulus = ijazah.tanggalLulus
    ? new Date(ijazah.tanggalLulus).toISOString().slice(0, 10)
    : "";

  const hash = ethers.keccak256(
    ethers.toUtf8Bytes(`${nomorIjazah}::${nim}::${nama}::${tglLulus}`)
  );

  return hash; // bentuk "0x...."
}

/**
 * Publish ijazah ke blockchain:
 * 1. Hitung / ambil ijazahHash
 * 2. Panggil kontrak registerIjazah(hash)
 * 3. Simpan / update BlockchainRecord di DB
 */
async function publishIjazahToBlockchain(ijazahId) {
  if (!ijazahRegistryContract) {
    throw new Error(
      "Kontrak IjazahRegistry belum terkonfigurasi (cek .env dan config/blockchain.js)"
    );
  }

  // Ambil ijazah + relasi yang diperlukan
  const ijazah = await prisma.ijazah.findUnique({
    where: { id: Number(ijazahId) },
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
    throw new Error("Ijazah tidak ditemukan");
  }

  // Kalau sudah pernah di-SUCCESS-kan, tidak usah kirim lagi
  if (
    ijazah.blockchainRecord &&
    ijazah.blockchainRecord.statusOnchain === "SUCCESS"
  ) {
    return {
      alreadyOnchain: true,
      ijazahHash: ijazah.blockchainRecord.ijazahHash,
      txHash: ijazah.blockchainRecord.txHash,
      blockNumber: ijazah.blockchainRecord.blockNumber,
    };
  }

  // Hitung hash
  const ijazahHash = computeIjazahHash(ijazah);

  console.log("[BLOCKCHAIN] registerIjazah hash:", ijazahHash);

  // Panggil kontrak
  let tx;
  try {
    tx = await ijazahRegistryContract.registerIjazah(ijazahHash);
  } catch (err) {
    console.error(
      "[BLOCKCHAIN] Error saat memanggil registerIjazah:",
      err
    );
    throw new Error(
      "Gagal mengirim transaksi ke blockchain. Detail: " +
        (err.reason || err.message)
    );
  }

  console.log("[BLOCKCHAIN] Tx sent:", tx.hash);

  // Simpan dulu record dengan status PENDING
  let bcRecord = await prisma.blockchainRecord.upsert({
    where: {
      ijazahId: ijazah.id,
    },
    update: {
      ijazahHash,
      contractAddress: ijazahRegistryContract.target,
      network: NETWORK_NAME,
      txHash: tx.hash,
      statusOnchain: "PENDING",
    },
    create: {
      ijazahId: ijazah.id,
      ijazahHash,
      contractAddress: ijazahRegistryContract.target,
      network: NETWORK_NAME,
      txHash: tx.hash,
      statusOnchain: "PENDING",
    },
  });

  // Tunggu transaksi di-mining
  const receipt = await tx.wait();

  console.log(
    "[BLOCKCHAIN] Tx confirmed, block:",
    receipt.blockNumber
  );

  // Update status menjadi SUCCESS
  bcRecord = await prisma.blockchainRecord.update({
    where: { id: bcRecord.id },
    data: {
      blockNumber: receipt.blockNumber,
      statusOnchain: "SUCCESS",
    },
  });

  return {
    alreadyOnchain: false,
    ijazahHash,
    txHash: bcRecord.txHash,
    blockNumber: bcRecord.blockNumber,
    network: bcRecord.network,
  };
}

module.exports = {
  generateIjazahHash,
  storeIjazahDummy,
  computeIjazahHash,
  publishIjazahToBlockchain,
};
