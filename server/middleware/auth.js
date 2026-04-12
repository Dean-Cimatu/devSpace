const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

function decodeToken(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// Attaches req.user if a valid JWT is present; never blocks the request
function optionalAuth(req, res, next) {
    req.user = decodeToken(req);
    next();
}

// Blocks the request with 401 if no valid JWT is present
function requireAuth(req, res, next) {
    const payload = decodeToken(req);
    if (!payload) return res.status(401).json({ error: 'Authentication required' });
    req.user = payload;
    next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };
