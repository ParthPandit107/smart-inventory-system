/**
 * Supplier Controller
 */

const supplierService = require('../services/supplierService');
const { validateSupplier } = require('../validators/schemas');
const { success, error } = require('../utils/responseHelper');

async function getSuppliers(req, res, next) {
    try {
        const { search, includeInactive } = req.query;
        const suppliers = await supplierService.getSuppliers(search, includeInactive === 'true');
        return success(res, suppliers, 'Suppliers retrieved successfully');
    } catch (err) {
        next(err);
    }
}

async function getSupplierById(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid supplier ID', 400);
        }

        const supplier = await supplierService.getSupplierById(id);
        if (!supplier) {
            return error(res, `Supplier with ID ${id} not found`, 404);
        }

        return success(res, supplier, 'Supplier details retrieved successfully');
    } catch (err) {
        next(err);
    }
}

async function createSupplier(req, res, next) {
    try {
        const validation = validateSupplier(req.body);
        if (!validation.isValid) {
            return error(res, 'Validation failed for supplier creation', 400, validation.errors);
        }

        const newSupplier = await supplierService.createSupplier(req.body);
        return success(res, newSupplier, 'Supplier created successfully', 201);
    } catch (err) {
        next(err);
    }
}

async function updateSupplier(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid supplier ID', 400);
        }

        const validation = validateSupplier(req.body);
        if (!validation.isValid) {
            return error(res, 'Validation failed for supplier update', 400, validation.errors);
        }

        const updated = await supplierService.updateSupplier(id, req.body);
        return success(res, updated, 'Supplier updated successfully');
    } catch (err) {
        next(err);
    }
}

async function toggleStatus(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid supplier ID', 400);
        }

        const { is_active } = req.body;
        if (is_active === undefined) {
            return error(res, 'is_active boolean field is required', 400);
        }

        const updated = await supplierService.toggleStatus(id, Boolean(is_active));
        const statusText = updated.is_active ? 'activated' : 'deactivated';
        return success(res, updated, `Supplier successfully ${statusText}`);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    toggleStatus
};
