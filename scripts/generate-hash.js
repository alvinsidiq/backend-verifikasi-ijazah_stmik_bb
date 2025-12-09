// scripts/generate-hash.js
const bcrypt = require('bcryptjs');

async function main() {
  const password = 'admin123'; // ganti kalau mau
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:    ', hash);
}

main().catch(console.error);


