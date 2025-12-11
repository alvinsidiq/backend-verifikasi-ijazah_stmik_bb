// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const programStudiRoutes = require('./routes/programStudi.routes');
const mahasiswaRoutes = require('./routes/mahasiswa.routes');
const ijazahRoutes = require('./routes/ijazah.routes');

require('dotenv').config();


const authRoutes = require('./routes/auth.routes');

const app = express();


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


module.exports = app;