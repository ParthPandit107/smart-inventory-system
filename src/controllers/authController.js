/**
 * Authentication Controller
 */

const authService = require('../services/authService');
const { success, error } = require('../utils/responseHelper');

async function login(req, res, next) {
    try {
        const { username, email, password } = req.body;
        const identifier = username || email;
        const result = await authService.login(identifier, password);
        return success(res, result, 'Login successful');
    } catch (err) {
        next(err);
    }
}

async function getProfile(req, res, next) {
    try {
        const user = await authService.getUserById(req.user.id);
        if (!user) {
            return error(res, 'User not found', 404);
        }
        return success(res, user, 'User profile retrieved');
    } catch (err) {
        next(err);
    }
}

module.exports = {
    login,
    getProfile
};
