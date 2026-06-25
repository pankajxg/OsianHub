const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'No token provided, authorization denied.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');
        req.user = decoded.user;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token is not valid or has expired.' });
    }
};

const adminOnly = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    next();
};

const superAdminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied. Superadmin role required.' });
    }
    next();
};

// Optional auth - attach user if token present, but don't block if not
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-development');
            req.user = decoded.user;
        } catch (_) {
            // Token invalid - proceed without user
        }
    }
    next();
};

module.exports = { protect, adminOnly, superAdminOnly, optionalAuth };
