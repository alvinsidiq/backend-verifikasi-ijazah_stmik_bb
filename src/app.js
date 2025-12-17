// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const programStudiRoutes = require('./routes/programStudi.routes');
const mahasiswaRoutes = require('./routes/mahasiswa.routes');
const ijazahRoutes = require('./routes/ijazah.routes');
const verifikasiRoutes = require('./routes/verifikasi.routes');


require('dotenv').config();


const authRoutes = require('./routes/auth.routes');

const app = express();

// Disable HTTP caching/ETag so API responses always return the body (avoid 304)
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});


// middleware dasar
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());


// routes
app.get('/health', (req, res) => {
  res.json({
      status: 'ok',
      message: 'backend verifikasi ijazah berjalan',
  });
});

// route auth
app.use('/auth', authRoutes);

// route program studi
app.use('/program-studi', programStudiRoutes);


// route mahasiswa
app.use('/mahasiswa', mahasiswaRoutes);


// route ijazah
app.use('/ijazah', ijazahRoutes);


// route verifikasi publik
app.use('/verifikasi', verifikasiRoutes);

module.exports = app;
