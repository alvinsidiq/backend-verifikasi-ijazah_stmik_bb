// src/config/prisma.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  // ini optional, tapi sekaligus bantu debug kalau ada masalah query
  log: ['query', 'error', 'warn'],
});

module.exports = prisma;
