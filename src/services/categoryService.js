/**
 * Category Management Service
 */

const db = require('../config/database');

async function getCategories(includeInactive = false) {
    const whereSql = includeInactive ? '' : 'WHERE c.is_active = 1';
    
    // Aggregation: count active products associated with each category
    const [rows] = await db.query(`
        SELECT 
            c.id,
            c.name,
            c.description,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(p.id) as product_count,
            COALESCE(SUM(p.current_stock), 0) as total_units,
            COALESCE(SUM(p.current_stock * p.unit_cost), 0) as total_valuation
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
        ${whereSql}
        GROUP BY c.id
        ORDER BY c.name ASC
    `);

    return rows;
}

async function getCategoryById(id) {
    const [rows] = await db.query(`
        SELECT 
            c.*,
            COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
        WHERE c.id = ?
        GROUP BY c.id
    `, [id]);

    const category = rows[0];
    if (!category) return null;

    // Fetch products belonging to this category
    const [products] = await db.query(`
        SELECT id, sku, name, current_stock, unit_cost, selling_price, min_stock_threshold, is_active
        FROM products
        WHERE category_id = ?
        ORDER BY name ASC
    `, [id]);

    category.products = products;
    return category;
}

async function createCategory(data) {
    const name = data.name.trim();

    // Check duplicate category name
    const [existing] = await db.query('SELECT id FROM categories WHERE LOWER(name) = ?', [name.toLowerCase()]);
    if (existing && existing.length > 0) {
        const err = new Error(`Category with name '${name}' already exists.`);
        err.statusCode = 409;
        throw err;
    }

    const [result] = await db.query(`
        INSERT INTO categories (name, description, is_active)
        VALUES (?, ?, 1)
    `, [name, data.description ? data.description.trim() : null]);

    return getCategoryById(result.insertId);
}

async function updateCategory(id, data) {
    const category = await getCategoryById(id);
    if (!category) {
        const err = new Error(`Category with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
        const name = data.name.trim();
        // Check duplicate name excluding current category
        const [existing] = await db.query('SELECT id FROM categories WHERE LOWER(name) = ? AND id != ?', [name.toLowerCase(), id]);
        if (existing && existing.length > 0) {
            const err = new Error(`Category with name '${name}' already exists.`);
            err.statusCode = 409;
            throw err;
        }
        updates.push('name = ?');
        params.push(name);
    }

    if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description ? data.description.trim() : null);
    }

    if (updates.length === 0) return category;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, params);
    return getCategoryById(id);
}

async function toggleStatus(id, isActive) {
    const category = await getCategoryById(id);
    if (!category) {
        const err = new Error(`Category with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    const newStatus = isActive ? 1 : 0;
    await db.query('UPDATE categories SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    return getCategoryById(id);
}

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    toggleStatus
};
