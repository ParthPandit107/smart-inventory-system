/**
 * JWT Authentication & Role-Based Authorization Middleware
 */

const jwt = require('jsonwebtoken');
const { error } = require('../utils/responseHelper');

const JWT_SECRET = process.env.JWT_SECRET || 'inventory_management_secret_jwt_key_2026_secure';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return error(res, 'Access denied. Authentication token required.', 401);
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return error(res, 'Invalid or expired authentication token.', 403);
    }
}

function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return error(res, 'Authentication required.', 401);
        }

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        if (!roles.includes(req.user.role)) {
            return error(res, `Forbidden. This operation requires one of the following roles: [${roles.join(', ')}]`, 403);
        }

        next();
    };
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            // Ignore error for optional auth
        }
    }
    next();
}

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth,
    JWT_SECRET
};
