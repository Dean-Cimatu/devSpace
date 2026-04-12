const express = require('express');
const cors = require('cors');
const path = require('path');
const scoresRouter = require('./routes/scores');
const authRouter   = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Serve the entire client/ directory as static files
app.use(express.static(path.join(__dirname, '../client')));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// API routes
app.use('/api/auth',   authRouter);
app.use('/api/scores', scoresRouter);

module.exports = app;
