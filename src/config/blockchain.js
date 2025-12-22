// src/config/blockchain.js
const { ethers } = require("ethers");

const RPC_URL =
  process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.IJAZAH_REGISTRY_ADDRESS;

if (!PRIVATE_KEY) {
  console.warn(
    "[BLOCKCHAIN] Warning: BLOCKCHAIN_PRIVATE_KEY belum diset di .env"
  );
}

if (!CONTRACT_ADDRESS) {
  console.warn(
    "[BLOCKCHAIN] Warning: IJAZAH_REGISTRY_ADDRESS belum diset di .env"
  );
}

// ABI minimal untuk IjazahRegistry
const IJAZAH_REGISTRY_ABI = [
  "function registerIjazah(bytes32 ijazahHash) external",
  "function isRegistered(bytes32 ijazahHash) external view returns (bool)",
  "function getIjazah(bytes32 ijazahHash) external view returns (bool exists, address issuer, uint256 createdAt)",
  "function owner() external view returns (address)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);

const wallet = PRIVATE_KEY
  ? new ethers.Wallet(PRIVATE_KEY, provider)
  : null;

const ijazahRegistryContract =
  CONTRACT_ADDRESS && wallet
    ? new ethers.Contract(
        CONTRACT_ADDRESS,
        IJAZAH_REGISTRY_ABI,
        wallet
      )
    : null;

module.exports = {
  provider,
  wallet,
  ijazahRegistryContract,
};
