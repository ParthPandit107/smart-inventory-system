/**
 * Authentication Service
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

async function login(usernameOrEmail, password) {
    if (!usernameOrEmail || !password) {
        const err = new Error('Username/email and password are required.');
        err.statusCode = 400;
        throw err;
    }

    const [rows] = await db.query(
        'SELECT id, username, email, password_hash, full_name, role, is_active FROM users WHERE (username = ? OR email = ?) LIMIT 1',
        [usernameOrEmail.trim(), usernameOrEmail.trim()]
    );

    const user = rows[0];
    if (!user) {
        const err = new Error('Invalid username/email or password.');
        err.statusCode = 401;
        throw err;
    }

    if (!user.is_active) {
        const err = new Error('Your account has been deactivated. Please contact an administrator.');
        err.statusCode = 403;
        throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        const err = new Error('Invalid username/email or password.');
        err.statusCode = 401;
        throw err;
    }

    const payload = {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    return {
        user: payload,
        token
    };
}

async function getUserById(id) {
    const [rows] = await db.query(
        'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
        [id]
    );
    return rows[0] || null;
}

module.exports = {
    login,
    getUserById
};
