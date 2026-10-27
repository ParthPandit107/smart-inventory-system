/**
 * Product Management Service
 * Handles CRUD operations, filtering, pagination, sorting, and safe status toggles.
 */

const db = require('../config/database');

async function getProducts({
    page = 1,
    limit = 10,
    search = '',
    category_id,
    supplier_id,
    stock_status,
    sortBy = 'created_at',
    order = 'desc',
    includeInactive = false
}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const params = [];

    if (!includeInactive) {
        whereClauses.push('p.is_active = 1');
    }

    if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        whereClauses.push('(LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ?)');
        params.push(term, term);
    }

    if (category_id) {
        whereClauses.push('p.category_id = ?');
        params.push(Number(category_id));
    }

    if (supplier_id) {
        whereClauses.push('p.supplier_id = ?');
        params.push(Number(supplier_id));
    }

    if (stock_status) {
        if (stock_status === 'in_stock') {
            whereClauses.push('p.current_stock > p.min_stock_threshold');
        } else if (stock_status === 'low_stock') {
            whereClauses.push('p.current_stock <= p.min_stock_threshold AND p.current_stock > 0');
        } else if (stock_status === 'out_of_stock') {
            whereClauses.push('p.current_stock = 0');
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Whitelist sort fields to prevent SQL injection
    const allowedSort = {
        name: 'p.name',
        sku: 'p.sku',
        current_stock: 'p.current_stock',
        unit_cost: 'p.unit_cost',
        selling_price: 'p.selling_price',
        created_at: 'p.created_at'
    };
    const sortCol = allowedSort[sortBy] || 'p.created_at';
    const sortDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 1. Get Total Count
    const countSql = `
        SELECT COUNT(*) as total 
        FROM products p 
        ${whereSql}
    `;
    const [countRows] = await db.query(countSql, params);
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    // 2. Fetch Paginated Records with Joined Names
    const querySql = `
        SELECT 
            p.id,
            p.sku,
            p.name,
            p.description,
            p.category_id,
            c.name as category_name,
            p.supplier_id,
            s.name as supplier_name,
            p.unit_cost,
            p.selling_price,
            p.current_stock,
            p.min_stock_threshold,
            p.is_active,
            p.created_at,
            p.updated_at,
            (p.current_stock * p.unit_cost) as total_value,
            CASE 
                WHEN p.current_stock = 0 THEN 'OUT_OF_STOCK'
                WHEN p.current_stock <= p.min_stock_threshold THEN 'LOW_STOCK'
                ELSE 'IN_STOCK'
            END as stock_status,
            CASE 
                WHEN p.current_stock <= p.min_stock_threshold THEN MAX(0, (p.min_stock_threshold * 2) - p.current_stock)
                ELSE 0
            END as suggested_reorder_qty
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN suppliers s ON p.supplier_id = s.id
        ${whereSql}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ? OFFSET ?
    `;

    const [items] = await db.query(querySql, [...params, limitNum, offset]);

    return {
        items,
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

async function getProductById(id) {
    const [rows] = await db.query(`
        SELECT 
            p.*,
            c.name as category_name,
            s.name as supplier_name,
            s.email as supplier_email,
            (p.current_stock * p.unit_cost) as inventory_valuation,
            CASE 
                WHEN p.current_stock = 0 THEN 'OUT_OF_STOCK'
                WHEN p.current_stock <= p.min_stock_threshold THEN 'LOW_STOCK'
                ELSE 'IN_STOCK'
            END as stock_status,
            MAX(0, (p.min_stock_threshold * 2) - p.current_stock) as suggested_reorder_qty
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
    `, [id]);

    const product = rows[0];
    if (!product) return null;

    // Fetch recent movement history for this product
    const [movements] = await db.query(`
        SELECT 
            m.id,
            m.movement_type,
            m.quantity,
            m.previous_stock,
            m.new_stock,
            m.reason,
            m.reference_number,
            m.created_at,
            u.full_name as created_by_name
        FROM inventory_movements m
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.product_id = ?
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 10
    `, [id]);

    product.recent_movements = movements;
    return product;
}

async function createProduct(data, userId = null) {
    const sku = data.sku.trim().toUpperCase();
    
    // Check SKU uniqueness
    const [existing] = await db.query('SELECT id FROM products WHERE UPPER(sku) = ?', [sku]);
    if (existing && existing.length > 0) {
        const err = new Error(`A product with SKU '${sku}' already exists.`);
        err.statusCode = 409;
        throw err;
    }

    const currentStock = parseInt(data.current_stock, 10) || 0;
    const minThreshold = data.min_stock_threshold !== undefined ? parseInt(data.min_stock_threshold, 10) : 10;
    const unitCost = parseFloat(data.unit_cost) || 0.00;
    const sellingPrice = parseFloat(data.selling_price) || 0.00;

    // Insert Product
    const [result] = await db.query(`
        INSERT INTO products (
            sku, name, description, category_id, supplier_id,
            unit_cost, selling_price, current_stock, min_stock_threshold, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
        sku,
        data.name.trim(),
        data.description ? data.description.trim() : null,
        data.category_id,
        data.supplier_id,
        unitCost,
        sellingPrice,
        currentStock,
        minThreshold
    ]);

    const newProductId = result.insertId;

    // If an initial stock was specified > 0, log an initial inventory movement
    if (currentStock > 0) {
        await db.query(`
            INSERT INTO inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_number, created_by
            ) VALUES (?, 'STOCK_IN', ?, 0, ?, 'Initial opening stock upon product creation', 'OPENING_STOCK', ?)
        `, [newProductId, currentStock, currentStock, userId]);
    }

    return getProductById(newProductId);
}

async function updateProduct(id, data) {
    const product = await getProductById(id);
    if (!product) {
        const err = new Error(`Product with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    // Business Rule: Direct overwriting of current_stock is rejected!
    if (data.current_stock !== undefined && data.current_stock !== product.current_stock) {
        const err = new Error(
            'Direct modification of current_stock is not permitted via product update. ' +
            'Stock adjustments must be recorded through the Inventory Movement Service (/api/inventory/stock-in, stock-out, or adjustments) to ensure audit trail integrity.'
        );
        err.statusCode = 400;
        throw err;
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name.trim());
    }

    if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description ? data.description.trim() : null);
    }

    if (data.category_id !== undefined) {
        updates.push('category_id = ?');
        params.push(Number(data.category_id));
    }

    if (data.supplier_id !== undefined) {
        updates.push('supplier_id = ?');
        params.push(Number(data.supplier_id));
    }

    if (data.unit_cost !== undefined) {
        updates.push('unit_cost = ?');
        params.push(parseFloat(data.unit_cost));
    }

    if (data.selling_price !== undefined) {
        updates.push('selling_price = ?');
        params.push(parseFloat(data.selling_price));
    }

    if (data.min_stock_threshold !== undefined) {
        updates.push('min_stock_threshold = ?');
        params.push(parseInt(data.min_stock_threshold, 10));
    }

    if (updates.length === 0) {
        return product;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
    return getProductById(id);
}

async function toggleStatus(id, isActive) {
    const product = await getProductById(id);
    if (!product) {
        const err = new Error(`Product with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    const newStatus = isActive ? 1 : 0;
    await db.query('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    return getProductById(id);
}

async function deleteProduct(id) {
    const product = await getProductById(id);
    if (!product) {
        const err = new Error(`Product with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    // Check if movement records or purchase orders exist
    const [movements] = await db.query('SELECT COUNT(*) as count FROM inventory_movements WHERE product_id = ?', [id]);
    if (movements[0].count > 0) {
        const err = new Error(
            `Cannot delete product '${product.name}' (SKU: ${product.sku}) because it has ${movements[0].count} historical inventory movement records. ` +
            'Deleting it would break audit logs. Please deactivate the product instead using PATCH /api/products/' + id + '/status.'
        );
        err.statusCode = 409;
        throw err;
    }

    const [poItems] = await db.query('SELECT COUNT(*) as count FROM purchase_order_items WHERE product_id = ?', [id]);
    if (poItems[0].count > 0) {
        const err = new Error(
            `Cannot delete product '${product.name}' because it is referenced in purchase orders. Please deactivate it instead.`
        );
        err.statusCode = 409;
        throw err;
    }

    await db.query('DELETE FROM products WHERE id = ?', [id]);
    return { id, message: `Product '${product.name}' deleted successfully.` };
}

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    toggleStatus,
    deleteProduct
};
