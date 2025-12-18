// scripts/seed-mahasiswa-users.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient, Role } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const passwordPlain = 'Mahasiswa123!';
  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const users = [
    { name: 'Mahasiswa Satu', email: 'mhs1@example.com' },
    { name: 'Mahasiswa Dua', email: 'mhs2@example.com' },
    { name: 'Mahasiswa Tiga', email: 'mhs3@example.com' },
    { name: 'Mahasiswa Empat', email: 'mhs4@example.com' },
    { name: 'Mahasiswa Lima', email: 'mhs5@example.com' },
  ];

  for (const user of users) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: Role.MAHASISWA,
        isActive: true,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: Role.MAHASISWA,
        isActive: true,
      },
    });

    console.log(`User siap: ${saved.email} / ${passwordPlain}`);
  }
}

main()
  .catch((err) => {
    console.error('Seed dummy mahasiswa gagal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
