const express  = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const User      = require('../models/User');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { username, email, password, dateOfBirth } = req.body || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
        return res.status(400).json({ error: 'Username must be 3–20 characters.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (!dateOfBirth) {
        return res.status(400).json({ error: 'Date of birth is required.' });
    }
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
        return res.status(400).json({ error: 'Invalid date of birth.' });
    }
    const today     = new Date();
    const threshold = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    if (dob > threshold) {
        return res.status(400).json({ error: 'You must be at least 13 years old to register.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({
            username: username.trim(),
            email:    email.toLowerCase().trim(),
            passwordHash,
            dateOfBirth: dob
        });

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({ token, username: user.username });
    } catch (err) {
        if (err.code === 11000) {
            const field = err.keyValue && Object.keys(err.keyValue)[0];
            const msg   = field === 'email' ? 'Email already registered.' : 'Username already taken.';
            return res.status(409).json({ error: msg });
        }
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const user = await User.findOne({
            $or: [
                { username: { $regex: new RegExp(`^${username.trim()}$`, 'i') } },
                { email: username.trim().toLowerCase() }
            ]
        });

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid username/email or password.' });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ token, username: user.username });
    } catch {
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// GET /api/auth/me — returns the authenticated user's profile
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-passwordHash')
            .lean();

        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch {
        res.status(500).json({ error: 'Could not fetch profile.' });
    }
});

module.exports = router;
