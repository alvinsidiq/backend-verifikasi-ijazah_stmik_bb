// scripts/seed-user.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Kredensial demo yang akan dibuat/di-update
  const email = 'admin@example.com';
  const passwordPlain = 'Admin123!';

  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Admin Demo',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      name: 'Admin Demo',
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('User ready:', {
    id: user.id,
    email,
    password: passwordPlain,
    role: user.role,
  });
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
