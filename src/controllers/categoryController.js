/**
 * Category Controller
 */

const categoryService = require('../services/categoryService');
const { validateCategory } = require('../validators/schemas');
const { success, error } = require('../utils/responseHelper');

async function getCategories(req, res, next) {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const categories = await categoryService.getCategories(includeInactive);
        return success(res, categories, 'Categories retrieved successfully');
    } catch (err) {
        next(err);
    }
}

async function getCategoryById(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid category ID', 400);
        }

        const category = await categoryService.getCategoryById(id);
        if (!category) {
            return error(res, `Category with ID ${id} not found`, 404);
        }

        return success(res, category, 'Category details retrieved successfully');
    } catch (err) {
        next(err);
    }
}

async function createCategory(req, res, next) {
    try {
        const validation = validateCategory(req.body);
        if (!validation.isValid) {
            return error(res, 'Validation failed for category creation', 400, validation.errors);
        }

        const newCategory = await categoryService.createCategory(req.body);
        return success(res, newCategory, 'Category created successfully', 201);
    } catch (err) {
        next(err);
    }
}

async function updateCategory(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid category ID', 400);
        }

        const validation = validateCategory(req.body);
        if (!validation.isValid) {
            return error(res, 'Validation failed for category update', 400, validation.errors);
        }

        const updated = await categoryService.updateCategory(id, req.body);
        return success(res, updated, 'Category updated successfully');
    } catch (err) {
        next(err);
    }
}

async function toggleStatus(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return error(res, 'Invalid category ID', 400);
        }

        const { is_active } = req.body;
        if (is_active === undefined) {
            return error(res, 'is_active boolean field is required', 400);
        }

        const updated = await categoryService.toggleStatus(id, Boolean(is_active));
        const statusText = updated.is_active ? 'activated' : 'deactivated';
        return success(res, updated, `Category successfully ${statusText}`);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    toggleStatus
};
