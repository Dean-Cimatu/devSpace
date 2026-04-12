const express = require('express');
const cors = require('cors');
const path = require('path');
const scoresRouter = require('./routes/scores');

const app = express();

app.use(cors());
app.use(express.json());

// Serve the entire client/ directory as static files
app.use(express.static(path.join(__dirname, '../client')));

// API routes
app.use('/api/scores', scoresRouter);

module.exports = app;
