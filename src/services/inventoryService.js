/**
 * Inventory & Stock Movement Service
 * Core business engine guaranteeing transactional integrity,
 * row locking against race conditions, and complete audit history.
 */

const db = require('../config/database');

/**
 * Get Low Stock Products with dynamic reorder suggestions
 */
async function getLowStockProducts(search = '') {
    const params = [];
    let searchClause = '';

    if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        searchClause = 'AND (LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ?)';
        params.push(term, term);
    }

    const [rows] = await db.query(`
        SELECT 
            p.id,
            p.sku,
            p.name,
            p.current_stock,
            p.min_stock_threshold,
            p.unit_cost,
            p.selling_price,
            c.id as category_id,
            c.name as category_name,
            s.id as supplier_id,
            s.name as supplier_name,
            s.email as supplier_email,
            s.phone as supplier_phone,
            (p.min_stock_threshold * 2) as target_stock_level,
            MAX(0, (p.min_stock_threshold * 2) - p.current_stock) as suggested_reorder_qty,
            (MAX(0, (p.min_stock_threshold * 2) - p.current_stock) * p.unit_cost) as estimated_reorder_cost,
            CASE 
                WHEN p.current_stock = 0 THEN 'OUT_OF_STOCK'
                ELSE 'CRITICAL_LOW'
            END as severity
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.is_active = 1 
          AND p.current_stock <= p.min_stock_threshold
          ${searchClause}
        ORDER BY p.current_stock ASC, p.min_stock_threshold DESC
    `, params);

    return rows;
}

/**
 * Get Filtered Inventory Movements History with Pagination
 */
async function getMovements({
    page = 1,
    limit = 20,
    productId,
    movementType,
    startDate,
    endDate
}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const params = [];

    if (productId) {
        whereClauses.push('m.product_id = ?');
        params.push(Number(productId));
    }

    if (movementType && ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT'].includes(movementType)) {
        whereClauses.push('m.movement_type = ?');
        params.push(movementType);
    }

    if (startDate) {
        whereClauses.push('m.created_at >= ?');
        params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
        whereClauses.push('m.created_at <= ?');
        params.push(`${endDate} 23:59:59`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total Count
    const [countRows] = await db.query(`
        SELECT COUNT(*) as total 
        FROM inventory_movements m 
        ${whereSql}
    `, params);

    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    // Movement rows with product and user details
    const [movements] = await db.query(`
        SELECT 
            m.id,
            m.product_id,
            p.name as product_name,
            p.sku as product_sku,
            c.name as category_name,
            m.movement_type,
            m.quantity,
            m.previous_stock,
            m.new_stock,
            m.reason,
            m.reference_number,
            m.created_by,
            u.full_name as created_by_name,
            u.username as created_by_username,
            m.created_at
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN users u ON m.created_by = u.id
        ${whereSql}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    return {
        movements,
        pagination: {
            totalItems,
            totalPages,
            currentPage: pageNum,
            limit: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
        }
    };
}

/**
 * Record Stock Addition (STOCK_IN)
 * Atomically updates product stock and inserts audit movement in a single database transaction.
 */
async function stockIn({ productId, quantity, reason, referenceNumber, userId }) {
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
        const err = new Error('Stock-in quantity must be greater than zero.');
        err.statusCode = 400;
        throw err;
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Row-level lock on product row (SELECT ... FOR UPDATE prevents race conditions)
        const [products] = await conn.query(
            'SELECT id, sku, name, current_stock, is_active FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        const product = products[0];
        if (!product) {
            const err = new Error(`Product with ID ${productId} does not exist.`);
            err.statusCode = 404;
            throw err;
        }

        if (!product.is_active) {
            const err = new Error(`Cannot add stock to deactivated product '${product.name}'.`);
            err.statusCode = 400;
            throw err;
        }

        const previousStock = product.current_stock;
        const newStock = previousStock + qty;

        // 1. Update product stock
        await conn.query(
            'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStock, productId]
        );

        // 2. Insert movement audit record
        const [movResult] = await conn.query(`
            INSERT INTO inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_number, created_by
            ) VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            qty,
            previousStock,
            newStock,
            reason ? reason.trim() : 'Stock receipt',
            referenceNumber ? referenceNumber.trim() : 'MANUAL_IN',
            userId || null
        ]);

        await conn.commit();

        return {
            movement_id: movResult.insertId,
            product_id: productId,
            product_name: product.name,
            sku: product.sku,
            movement_type: 'STOCK_IN',
            quantity: qty,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_number: referenceNumber || 'MANUAL_IN'
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Record Stock Removal (STOCK_OUT)
 * Atomically verifies available stock, prevents negative inventory, updates stock,
 * and creates movement audit record.
 */
async function stockOut({ productId, quantity, reason, referenceNumber, userId }) {
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
        const err = new Error('Stock-out quantity must be greater than zero.');
        err.statusCode = 400;
        throw err;
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Row-level lock on product row
        const [products] = await conn.query(
            'SELECT id, sku, name, current_stock, is_active FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        const product = products[0];
        if (!product) {
            const err = new Error(`Product with ID ${productId} does not exist.`);
            err.statusCode = 404;
            throw err;
        }

        if (!product.is_active) {
            const err = new Error(`Cannot remove stock from deactivated product '${product.name}'.`);
            err.statusCode = 400;
            throw err;
        }

        const previousStock = product.current_stock;

        // CRITICAL BUSINESS RULE: Prevent negative stock
        if (previousStock < qty) {
            const err = new Error(
                `Insufficient inventory for product '${product.name}' (SKU: ${product.sku}). ` +
                `Available stock: ${previousStock}, Requested removal: ${qty}. Stock cannot be negative.`
            );
            err.statusCode = 400;
            throw err;
        }

        const newStock = previousStock - qty;

        // 1. Update product stock
        await conn.query(
            'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStock, productId]
        );

        // 2. Insert movement audit record
        const [movResult] = await conn.query(`
            INSERT INTO inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_number, created_by
            ) VALUES (?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            qty,
            previousStock,
            newStock,
            reason ? reason.trim() : 'Stock dispatch / consumption',
            referenceNumber ? referenceNumber.trim() : 'MANUAL_OUT',
            userId || null
        ]);

        await conn.commit();

        return {
            movement_id: movResult.insertId,
            product_id: productId,
            product_name: product.name,
            sku: product.sku,
            movement_type: 'STOCK_OUT',
            quantity: qty,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_number: referenceNumber || 'MANUAL_OUT'
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Record Manual Stock Adjustment (ADJUSTMENT)
 * Used for cycle counts, damaged goods write-offs, or physical audit reconciliations.
 */
async function adjustStock({ productId, newStock, reason, referenceNumber, userId }) {
    const targetStock = parseInt(newStock, 10);
    if (isNaN(targetStock) || targetStock < 0) {
        const err = new Error('Target stock quantity must be a non-negative integer.');
        err.statusCode = 400;
        throw err;
    }

    if (!reason || reason.trim().length < 3) {
        const err = new Error('A detailed reason is required for manual stock adjustments (minimum 3 characters).');
        err.statusCode = 400;
        throw err;
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [products] = await conn.query(
            'SELECT id, sku, name, current_stock, is_active FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        const product = products[0];
        if (!product) {
            const err = new Error(`Product with ID ${productId} does not exist.`);
            err.statusCode = 404;
            throw err;
        }

        const previousStock = product.current_stock;
        const diffQuantity = Math.abs(targetStock - previousStock);

        if (diffQuantity === 0) {
            await conn.rollback();
            return {
                message: 'No adjustment needed. Target stock matches current stock.',
                product_id: productId,
                previous_stock: previousStock,
                new_stock: previousStock
            };
        }

        // 1. Update product stock
        await conn.query(
            'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [targetStock, productId]
        );

        // 2. Insert movement record
        const [movResult] = await conn.query(`
            INSERT INTO inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_number, created_by
            ) VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            diffQuantity,
            previousStock,
            targetStock,
            reason.trim(),
            referenceNumber ? referenceNumber.trim() : 'PHYSICAL_AUDIT',
            userId || null
        ]);

        await conn.commit();

        return {
            movement_id: movResult.insertId,
            product_id: productId,
            product_name: product.name,
            sku: product.sku,
            movement_type: 'ADJUSTMENT',
            quantity: diffQuantity,
            previous_stock: previousStock,
            new_stock: targetStock,
            reason: reason.trim()
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    getLowStockProducts,
    getMovements,
    stockIn,
    stockOut,
    adjustStock
};
