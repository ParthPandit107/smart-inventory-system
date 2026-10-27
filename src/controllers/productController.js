/**
 * Product Controller
 */

const productService = require('../services/productService');
const { validateProduct } = require('../validators/schemas');
const { success, error } = require('../utils/responseHelper');

async function getProducts(req, res, next) {
    try {
        const {
            page,
            limit,
            search,
            category_id,
            supplier_id,
            stock_status,
            sortBy,
            order,
            includeInactive
        } = req.query;

        const result = await productService.getProducts({
            page,
            limit,
            search,
            category_id,
            supplier_id,
            stock_status,
            sortBy,
            order,
            includeInactive: includeInactive === 'true'
        });

        return success(res, result.items, 'Products retrieved successfully', 200, result.pagination);
    } catch (err) {
        next(err);
    }
}

async function getProductById(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid product ID supplied', 400);
        }

        const product = await productService.getProductById(id);
        if (!product) {
            return error(res, `Product with ID ${id} not found`, 404);
        }

        return success(res, product, 'Product details retrieved successfully');
    } catch (err) {
        next(err);
    }
}

async function createProduct(req, res, next) {
    try {
        const validation = validateProduct(req.body, false);
        if (!validation.isValid) {
            return error(res, 'Validation failed for product creation', 400, validation.errors);
        }

        const userId = req.user ? req.user.id : null;
        const newProduct = await productService.createProduct(req.body, userId);
        return success(res, newProduct, 'Product created successfully', 201);
    } catch (err) {
        next(err);
    }
}

async function updateProduct(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid product ID supplied', 400);
        }

        const validation = validateProduct(req.body, true);
        if (!validation.isValid) {
            return error(res, 'Validation failed for product update', 400, validation.errors);
        }

        const updated = await productService.updateProduct(id, req.body);
        return success(res, updated, 'Product updated successfully');
    } catch (err) {
        next(err);
    }
}

async function toggleStatus(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid product ID supplied', 400);
        }

        const { is_active } = req.body;
        if (is_active === undefined) {
            return error(res, 'is_active boolean field is required', 400);
        }

        const updated = await productService.toggleStatus(id, Boolean(is_active));
        const statusText = updated.is_active ? 'activated' : 'deactivated';
        return success(res, updated, `Product successfully ${statusText}`);
    } catch (err) {
        next(err);
    }
}

async function deleteProduct(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid product ID supplied', 400);
        }

        const result = await productService.deleteProduct(id);
        return success(res, result, result.message);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    toggleStatus,
    deleteProduct
};
