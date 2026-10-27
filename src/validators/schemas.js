/**
 * Request Validation Schemas & Helpers
 */

function validateProduct(body, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
        if (!body.sku || typeof body.sku !== 'string' || body.sku.trim().length === 0) {
            errors.push('SKU is required and must be a non-empty string');
        }
    }

    if (body.name !== undefined) {
        if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
            errors.push('Product name is required');
        }
    } else if (!isUpdate) {
        errors.push('Product name is required');
    }

    if (body.category_id !== undefined) {
        const catId = Number(body.category_id);
        if (!Number.isInteger(catId) || catId <= 0) {
            errors.push('Valid Category ID is required');
        }
    } else if (!isUpdate) {
        errors.push('Category ID is required');
    }

    if (body.supplier_id !== undefined) {
        const supId = Number(body.supplier_id);
        if (!Number.isInteger(supId) || supId <= 0) {
            errors.push('Valid Supplier ID is required');
        }
    } else if (!isUpdate) {
        errors.push('Supplier ID is required');
    }

    if (body.unit_cost !== undefined) {
        const cost = Number(body.unit_cost);
        if (isNaN(cost) || cost < 0) {
            errors.push('Unit cost must be a non-negative number');
        }
    }

    if (body.selling_price !== undefined) {
        const price = Number(body.selling_price);
        if (isNaN(price) || price < 0) {
            errors.push('Selling price must be a non-negative number');
        }
    }

    if (body.min_stock_threshold !== undefined) {
        const thresh = Number(body.min_stock_threshold);
        if (!Number.isInteger(thresh) || thresh < 0) {
            errors.push('Minimum stock threshold must be a non-negative integer');
        }
    }

    if (!isUpdate && body.current_stock !== undefined) {
        const stock = Number(body.current_stock);
        if (!Number.isInteger(stock) || stock < 0) {
            errors.push('Current stock must be a non-negative integer');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateCategory(body) {
    const errors = [];
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        errors.push('Category name is required');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateSupplier(body) {
    const errors = [];
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        errors.push('Supplier name is required');
    }
    if (!body.email || typeof body.email !== 'string' || !/^\S+@\S+\.\S+$/.test(body.email)) {
        errors.push('A valid email address is required');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateStockMovement(body, isAdjustment = false) {
    const errors = [];
    const productId = Number(body.product_id);
    if (!Number.isInteger(productId) || productId <= 0) {
        errors.push('Valid Product ID is required');
    }

    if (isAdjustment) {
        const newStock = Number(body.new_stock);
        if (!Number.isInteger(newStock) || newStock < 0) {
            errors.push('New stock quantity must be a non-negative integer');
        }
        if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length < 3) {
            errors.push('A descriptive reason is mandatory for manual adjustments (minimum 3 characters)');
        }
    } else {
        const qty = Number(body.quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
            errors.push('Quantity must be an integer greater than 0');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

function validatePurchaseOrder(body) {
    const errors = [];
    const supId = Number(body.supplier_id);
    if (!Number.isInteger(supId) || supId <= 0) {
        errors.push('Valid Supplier ID is required');
    }
    if (!body.order_date) {
        errors.push('Order date is required');
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
        errors.push('Purchase order must contain at least one item');
    } else {
        body.items.forEach((item, idx) => {
            const pId = Number(item.product_id);
            const qty = Number(item.quantity_ordered);
            const cost = Number(item.unit_cost);
            if (!Number.isInteger(pId) || pId <= 0) {
                errors.push(`Item #${idx + 1}: Valid product_id is required`);
            }
            if (!Number.isInteger(qty) || qty <= 0) {
                errors.push(`Item #${idx + 1}: Quantity ordered must be greater than 0`);
            }
            if (isNaN(cost) || cost < 0) {
                errors.push(`Item #${idx + 1}: Unit cost must be a non-negative number`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateProduct,
    validateCategory,
    validateSupplier,
    validateStockMovement,
    validatePurchaseOrder
};
