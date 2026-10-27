/**
 * API Response Standardization Utility
 */

function success(res, data = null, message = 'Operation successful', statusCode = 200, meta = null) {
    const payload = {
        success: true,
        message,
        data
    };
    if (meta) {
        payload.meta = meta;
    }
    return res.status(statusCode).json(payload);
}

function error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    const payload = {
        success: false,
        message
    };
    if (errors) {
        payload.errors = errors;
    }
    return res.status(statusCode).json(payload);
}

module.exports = {
    success,
    error
};
