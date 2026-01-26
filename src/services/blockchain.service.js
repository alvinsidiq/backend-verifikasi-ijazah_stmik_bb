// src/services/blockchain.service.js
const crypto = require('crypto');
const { ethers } = require("ethers");
const prisma = require("../config/prisma");
const { provider, ijazahRegistryContract } = require("../config/blockchain");

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

  const id = Number(ijazahId);
  if (Number.isNaN(id)) {
    throw new Error("ID ijazah tidak valid");
  }

  // Ambil ijazah + relasi yang diperlukan
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
    throw new Error("Ijazah tidak ditemukan");
  }

  // Wajib tervalidasi penuh sebelum publish ke blockchain
  if (ijazah.statusValidasi !== "TERVALIDASI") {
    throw new Error(
      "Ijazah belum tervalidasi lengkap oleh Admin dan Validator. StatusValidasi harus TERVALIDASI sebelum publish ke blockchain."
    );
  }

  const nomorIjazah = ijazah.nomorIjazah || "";
  const nomorIjazahHash = ethers.keccak256(
    ethers.toUtf8Bytes(nomorIjazah)
  );

  const networkInfo = provider ? await provider.getNetwork() : null;
  const chainId = networkInfo?.chainId ?? null;
  const resolvedNetworkName =
    NETWORK_NAME || networkInfo?.name || "unknown";

  // Kalau sudah pernah di-SUCCESS-kan, tidak usah kirim lagi
  if (
    ijazah.blockchainRecord &&
    ijazah.blockchainRecord.statusOnchain === "SUCCESS"
  ) {
    if (!ijazah.blockchainRecord.nomorIjazahHash) {
      await prisma.blockchainRecord.update({
        where: { id: ijazah.blockchainRecord.id },
        data: { nomorIjazahHash },
      });
    }

    return {
      alreadyOnchain: true,
      txHash: ijazah.blockchainRecord.txHash,
      blockNumber: ijazah.blockchainRecord.blockNumber,
      statusOnchain: ijazah.blockchainRecord.statusOnchain,
      nomorIjazahHash:
        ijazah.blockchainRecord.nomorIjazahHash || nomorIjazahHash,
      network: ijazah.blockchainRecord.network,
      chainId: ijazah.blockchainRecord.chainId,
    };
  }

  // Hitung hash
  const ijazahHash = computeIjazahHash(ijazah);

  console.log("[BLOCKCHAIN] registerIjazah hash:", ijazahHash);

  const recordBase = {
    ijazahHash,
    nomorIjazahHash,
    contractAddress: ijazahRegistryContract.target,
    network: resolvedNetworkName,
    chainId,
    statusOnchain: "PENDING",
    errorMessage: null,
  };

  let bcRecord = await prisma.blockchainRecord.upsert({
    where: {
      ijazahId: ijazah.id,
    },
    update: {
      ...recordBase,
      txHash: null,
      blockNumber: null,
      publishedAt: null,
    },
    create: {
      ...recordBase,
      ijazahId: ijazah.id,
    },
  });

  const recordId = bcRecord.id;

  let tx;
  try {
    tx = await ijazahRegistryContract.registerIjazah(ijazahHash);
  } catch (err) {
    const reason =
      err?.reason || err?.message || "Tidak ada detail error";
    await prisma.blockchainRecord.update({
      where: { id: recordId },
      data: {
        statusOnchain: "FAILED",
        errorMessage: reason,
      },
    });
    console.error("[BLOCKCHAIN] Error saat memanggil registerIjazah:", err);
    throw new Error(
      "Gagal mengirim transaksi ke blockchain. " + reason
    );
  }

  console.log("[BLOCKCHAIN] Tx sent:", tx.hash);

  await prisma.blockchainRecord.update({
    where: { id: recordId },
    data: {
      txHash: tx.hash,
      statusOnchain: "PENDING",
      errorMessage: null,
    },
  });

  let receipt;
  try {
    receipt = await tx.wait();
  } catch (err) {
    const reason =
      err?.reason || err?.message || "Transaksi tidak dikonfirmasi";
    await prisma.blockchainRecord.update({
      where: { id: recordId },
      data: {
        statusOnchain: "FAILED",
        errorMessage: reason,
      },
    });
    console.error(
      "[BLOCKCHAIN] Error menunggu konfirmasi transaksi:",
      err
    );
    throw new Error("Transaksi gagal dikonfirmasi. " + reason);
  }

  const finalBlockNumber =
    receipt?.blockNumber != null
      ? Number(receipt.blockNumber)
      : null;

  console.log(
    "[BLOCKCHAIN] Tx confirmed, block:",
    finalBlockNumber
  );

  bcRecord = await prisma.blockchainRecord.update({
    where: { id: recordId },
    data: {
      blockNumber: finalBlockNumber,
      statusOnchain: "SUCCESS",
      publishedAt: new Date(),
      errorMessage: null,
    },
  });

  return {
    alreadyOnchain: false,
    txHash: bcRecord.txHash,
    blockNumber: bcRecord.blockNumber,
    statusOnchain: bcRecord.statusOnchain,
    nomorIjazahHash: bcRecord.nomorIjazahHash,
    network: bcRecord.network,
    chainId: bcRecord.chainId,
    publishedAt: bcRecord.publishedAt,
  };
}

module.exports = {
  generateIjazahHash,
  storeIjazahDummy,
  computeIjazahHash,
  publishIjazahToBlockchain,
};
