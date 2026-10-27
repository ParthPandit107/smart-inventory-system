/**
 * Centralized Error Handling Middleware
 */

const { error } = require('../utils/responseHelper');

function errorHandler(err, req, res, next) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

    // SQLite / MySQL Duplicate Key Errors
    if (
        err.code === 'ER_DUP_ENTRY' ||
        err.errno === 1062 ||
        (err.message && err.message.includes('UNIQUE constraint failed'))
    ) {
        let field = 'record';
        if (err.message.includes('sku') || err.message.includes('products.sku')) field = 'SKU';
        else if (err.message.includes('email') || err.message.includes('users.email')) field = 'Email';
        else if (err.message.includes('name') || err.message.includes('categories.name')) field = 'Category name';
        else if (err.message.includes('po_number')) field = 'Purchase Order Number';

        return error(res, `A duplicate record already exists with this ${field}.`, 409, {
            field,
            details: err.message
        });
    }

    // Foreign Key Constraint Failures
    if (
        err.code === 'ER_ROW_IS_REFERENCED_2' ||
        err.code === 'ER_NO_REFERENCED_ROW_2' ||
        err.errno === 1451 ||
        err.errno === 1452 ||
        (err.message && err.message.includes('FOREIGN KEY constraint failed'))
    ) {
        return error(res, 'Database foreign key constraint violated. Ensure referenced records exist and are not in use.', 409, {
            details: err.message
        });
    }

    // Check Constraint Violations
    if (err.message && err.message.includes('CHECK constraint failed')) {
        return error(res, 'Database validation check constraint failed (e.g., negative stock or price).', 400, {
            details: err.message
        });
    }

    // JSON Parse Error
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return error(res, 'Malformed JSON payload.', 400);
    }

    // Generic Internal Error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected server error occurred.';
    return error(res, message, statusCode);
}

module.exports = errorHandler;
