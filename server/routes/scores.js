const express = require('express');
const router  = express.Router();
const Score   = require('../models/Score');
const User    = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

// GET /api/scores — top 20 by score descending
router.get('/', async (req, res) => {
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
router.post('/', optionalAuth, async (req, res) => {
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
        const finalScore = Math.floor(score);
        const finalWave  = Math.max(1, Math.floor(wave));
        const userId     = req.user ? req.user.userId : null;

        await Score.create({
            name:  name.trim().slice(0, 16),
            score: finalScore,
            wave:  finalWave,
            userId
        });

        // Update the user's stats if they were authenticated
        if (userId) {
            await User.findByIdAndUpdate(userId, {
                $inc: { gamesPlayed: 1 },
                $max: { highScore: finalScore }
            });
        }

        res.status(201).json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Failed to save score' });
    }
});

module.exports = router;
