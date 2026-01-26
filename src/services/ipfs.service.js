const axios = require("axios");
const FormData = require("form-data");

/**
 * Upload PDF buffer ke Pinata (pinFileToIPFS).
 */
async function uploadBufferToIpfs({ buffer, filename }) {
  const provider = (process.env.IPFS_PROVIDER || "pinata").toLowerCase();
  if (provider !== "pinata") {
    throw new Error(`IPFS_PROVIDER '${provider}' tidak didukung di mode ini`);
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT belum di-set di .env");

  const gatewayBase =
    process.env.IPFS_GATEWAY_BASE || "https://gateway.pinata.cloud";

  const form = new FormData();
  form.append("file", buffer, {
    filename: filename || "ijazah.pdf",
    contentType: "application/pdf",
  });

  form.append(
    "pinataMetadata",
    JSON.stringify({ name: filename || "ijazah.pdf" })
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const resp = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${jwt}`,
      },
      maxBodyLength: Infinity,
    }
  );

  const cid = resp.data.IpfsHash;
  const uri = `ipfs://${cid}`;
  const gatewayUrl = `${gatewayBase.replace(/\/$/, "")}/ipfs/${cid}`;

  return { cid, uri, gatewayUrl };
}

module.exports = { uploadBufferToIpfs };
