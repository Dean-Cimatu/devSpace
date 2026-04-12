require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/colosseum';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const scoreSchema = new mongoose.Schema({
    name:  { type: String, required: true, maxlength: 16, trim: true },
    score: { type: Number, required: true, min: 0 },
    wave:  { type: Number, required: true, min: 1 },
    date:  { type: Date,   default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err.message));

// GET /api/scores — top 20 by score descending
app.get('/api/scores', async (req, res) => {
    try {
        const scores = await Score.find()
            .sort({ score: -1 })
            .limit(20)
            .select('name score wave date -_id')
            .lean();
        res.json(scores);
    } catch {
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

// POST /api/scores — save a new score entry
app.post('/api/scores', async (req, res) => {
    const { name, score, wave } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name is required' });
    }
    if (typeof score !== 'number' || score < 0 || !isFinite(score)) {
        return res.status(400).json({ error: 'score must be a non-negative number' });
    }
    if (typeof wave !== 'number' || wave < 1 || !Number.isInteger(wave)) {
        return res.status(400).json({ error: 'wave must be a positive integer' });
    }

    try {
        await Score.create({
            name:  name.trim().slice(0, 16),
            score: Math.floor(score),
            wave:  Math.max(1, Math.floor(wave))
        });
        res.status(201).json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Failed to save score' });
    }
});

app.listen(PORT, () => {
    console.log(`Colosseum Fighters running on port ${PORT}`);
});
