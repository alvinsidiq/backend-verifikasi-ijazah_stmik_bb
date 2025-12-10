// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const programStudiRoutes = require('./routes/programStudi.routes');
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
app.use('/program-studi', programStudiRoutes);

module.exports = app;