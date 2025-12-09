// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
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


module.exports = app;