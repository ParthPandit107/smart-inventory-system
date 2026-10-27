/**
 * Purchase Order Controller
 */

const purchaseOrderService = require('../services/purchaseOrderService');
const { validatePurchaseOrder } = require('../validators/schemas');
const { success, error } = require('../utils/responseHelper');

async function getPurchaseOrders(req, res, next) {
    try {
        const { page, limit, status, supplierId } = req.query;
        const result = await purchaseOrderService.getPurchaseOrders({ page, limit, status, supplierId });
        return success(res, result.orders, 'Purchase orders retrieved', 200, result.pagination);
    } catch (err) {
        next(err);
    }
}

async function getPurchaseOrderById(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid purchase order ID', 400);
        }

        const po = await purchaseOrderService.getPurchaseOrderById(id);
        if (!po) {
            return error(res, `Purchase order with ID ${id} not found`, 404);
        }

        return success(res, po, 'Purchase order details retrieved');
    } catch (err) {
        next(err);
    }
}

async function createPurchaseOrder(req, res, next) {
    try {
        const validation = validatePurchaseOrder(req.body);
        if (!validation.isValid) {
            return error(res, 'Validation failed for purchase order', 400, validation.errors);
        }

        const userId = req.user ? req.user.id : null;
        const po = await purchaseOrderService.createPurchaseOrder({
            ...req.body,
            userId
        });

        return success(res, po, 'Purchase order created successfully', 201);
    } catch (err) {
        next(err);
    }
}

async function receivePurchaseOrder(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid purchase order ID', 400);
        }

        const userId = req.user ? req.user.id : null;
        const receivedPo = await purchaseOrderService.receivePurchaseOrder(id, userId);
        return success(res, receivedPo, `Purchase order ${receivedPo.po_number} received and inventory updated successfully`);
    } catch (err) {
        next(err);
    }
}

async function cancelPurchaseOrder(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid purchase order ID', 400);
        }

        const cancelledPo = await purchaseOrderService.cancelPurchaseOrder(id);
        return success(res, cancelledPo, `Purchase order ${cancelledPo.po_number} cancelled successfully`);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getPurchaseOrders,
    getPurchaseOrderById,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder
};
