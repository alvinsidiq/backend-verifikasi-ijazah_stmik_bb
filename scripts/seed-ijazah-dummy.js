// scripts/seed-ijazah-dummy.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient, StatusValidasi } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'mahasiswa.demo@example.com';
  const passwordPlain = 'Mahasiswa123!';
  const nim = '202000001';
  const nomorIjazah = 'IJZ/DEMO/2024/001';

  const prodi = await prisma.programStudi.upsert({
    where: { kodeProdi: 'TI-S1' },
    update: {
      namaProdi: 'Teknik Informatika',
      jenjang: 'S1',
    },
    create: {
      kodeProdi: 'TI-S1',
      namaProdi: 'Teknik Informatika',
      jenjang: 'S1',
    },
  });

  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const mahasiswaUser = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Mahasiswa Demo',
      passwordHash,
      role: 'MAHASISWA',
      isActive: true,
    },
    create: {
      name: 'Mahasiswa Demo',
      email,
      passwordHash,
      role: 'MAHASISWA',
      isActive: true,
    },
  });

  const mahasiswa = await prisma.mahasiswa.upsert({
    where: { nim },
    update: {
      userId: mahasiswaUser.id,
      nama: 'Mahasiswa Demo',
      prodiId: prodi.id,
      tahunMasuk: 2020,
      tahunLulus: null,
      tempatLahir: 'Denpasar',
      tanggalLahir: new Date('2002-05-10'),
    },
    create: {
      userId: mahasiswaUser.id,
      nim,
      nama: 'Mahasiswa Demo',
      prodiId: prodi.id,
      tahunMasuk: 2020,
      tahunLulus: null,
      tempatLahir: 'Denpasar',
      tanggalLahir: new Date('2002-05-10'),
    },
  });

  const ijazah = await prisma.ijazah.upsert({
    where: { nomorIjazah },
    update: {
      mahasiswaId: mahasiswa.id,
      tanggalLulus: new Date('2024-08-15'),
      fileUrl: '/uploads/ijazah/demo-2024.pdf',
      statusValidasi: StatusValidasi.MENUNGGU,
      validatorId: null,
      catatanValidasi: null,
      validatedAt: null,
    },
    create: {
      mahasiswaId: mahasiswa.id,
      nomorIjazah,
      tanggalLulus: new Date('2024-08-15'),
      fileUrl: '/uploads/ijazah/demo-2024.pdf',
      statusValidasi: StatusValidasi.MENUNGGU,
      validatorId: null,
      catatanValidasi: null,
      validatedAt: null,
    },
  });

  console.log('Dummy ijazah siap untuk divalidasi:', {
    prodi: prodi.kodeProdi,
    user: { email, password: passwordPlain },
    mahasiswa: { id: mahasiswa.id, nim },
    ijazah: { id: ijazah.id, nomorIjazah: ijazah.nomorIjazah, status: ijazah.statusValidasi },
  });
}

main()
  .catch((err) => {
    console.error('Seed dummy ijazah gagal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
