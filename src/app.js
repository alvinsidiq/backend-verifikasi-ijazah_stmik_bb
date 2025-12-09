// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();



// middleware
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

module.exports = app;