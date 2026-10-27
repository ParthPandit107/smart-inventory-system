/**
 * Inventory & Movement Controller
 */

const inventoryService = require('../services/inventoryService');
const { validateStockMovement } = require('../validators/schemas');
const { success, error } = require('../utils/responseHelper');

async function getLowStock(req, res, next) {
    try {
        const { search } = req.query;
        const lowStockItems = await inventoryService.getLowStockProducts(search);
        return success(res, lowStockItems, 'Low stock alerts retrieved successfully', 200, {
            total_alerts: lowStockItems.length
        });
    } catch (err) {
        next(err);
    }
}

async function getMovements(req, res, next) {
    try {
        const {
            page,
            limit,
            productId,
            movementType,
            startDate,
            endDate
        } = req.query;

        const result = await inventoryService.getMovements({
            page,
            limit,
            productId,
            movementType,
            startDate,
            endDate
        });

        return success(res, result.movements, 'Movements history retrieved', 200, result.pagination);
    } catch (err) {
        next(err);
    }
}

async function recordStockIn(req, res, next) {
    try {
        const validation = validateStockMovement(req.body, false);
        if (!validation.isValid) {
            return error(res, 'Validation failed for stock addition', 400, validation.errors);
        }

        const userId = req.user ? req.user.id : null;
        const result = await inventoryService.stockIn({
            productId: req.body.product_id,
            quantity: req.body.quantity,
            reason: req.body.reason,
            referenceNumber: req.body.reference_number,
            userId
        });

        return success(res, result, 'Stock added successfully', 201);
    } catch (err) {
        next(err);
    }
}

async function recordStockOut(req, res, next) {
    try {
        const validation = validateStockMovement(req.body, false);
        if (!validation.isValid) {
            return error(res, 'Validation failed for stock removal', 400, validation.errors);
        }

        const userId = req.user ? req.user.id : null;
        const result = await inventoryService.stockOut({
            productId: req.body.product_id,
            quantity: req.body.quantity,
            reason: req.body.reason,
            referenceNumber: req.body.reference_number,
            userId
        });

        return success(res, result, 'Stock removed successfully', 200);
    } catch (err) {
        next(err);
    }
}

async function recordAdjustment(req, res, next) {
    try {
        const validation = validateStockMovement(req.body, true);
        if (!validation.isValid) {
            return error(res, 'Validation failed for stock adjustment', 400, validation.errors);
        }

        const userId = req.user ? req.user.id : null;
        const result = await inventoryService.adjustStock({
            productId: req.body.product_id,
            newStock: req.body.new_stock,
            reason: req.body.reason,
            referenceNumber: req.body.reference_number,
            userId
        });

        return success(res, result, 'Stock adjustment completed', 200);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getLowStock,
    getMovements,
    recordStockIn,
    recordStockOut,
    recordAdjustment
};
