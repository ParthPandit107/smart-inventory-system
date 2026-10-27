/**
 * Supplier Management Service
 */

const db = require('../config/database');

async function getSuppliers(search = '', includeInactive = false) {
    const whereClauses = [];
    const params = [];

    if (!includeInactive) {
        whereClauses.push('s.is_active = 1');
    }

    if (search && search.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        whereClauses.push('(LOWER(s.name) LIKE ? OR LOWER(s.contact_person) LIKE ? OR LOWER(s.email) LIKE ?)');
        params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await db.query(`
        SELECT 
            s.id,
            s.name,
            s.contact_person,
            s.email,
            s.phone,
            s.address,
            s.is_active,
            s.created_at,
            s.updated_at,
            COUNT(p.id) as product_count,
            COALESCE(SUM(p.current_stock), 0) as total_units_supplied,
            COALESCE(SUM(p.current_stock * p.unit_cost), 0) as total_supplied_valuation
        FROM suppliers s
        LEFT JOIN products p ON s.id = p.supplier_id AND p.is_active = 1
        ${whereSql}
        GROUP BY s.id
        ORDER BY s.name ASC
    `, params);

    return rows;
}

async function getSupplierById(id) {
    const [rows] = await db.query(`
        SELECT 
            s.*,
            COUNT(p.id) as product_count
        FROM suppliers s
        LEFT JOIN products p ON s.id = p.supplier_id AND p.is_active = 1
        WHERE s.id = ?
        GROUP BY s.id
    `, [id]);

    const supplier = rows[0];
    if (!supplier) return null;

    // Fetch products associated with this supplier
    const [products] = await db.query(`
        SELECT id, sku, name, current_stock, unit_cost, selling_price, min_stock_threshold, is_active
        FROM products
        WHERE supplier_id = ?
        ORDER BY name ASC
    `, [id]);

    supplier.products = products;
    return supplier;
}

async function createSupplier(data) {
    const email = data.email.trim().toLowerCase();
    
    const [result] = await db.query(`
        INSERT INTO suppliers (name, contact_person, email, phone, address, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    `, [
        data.name.trim(),
        data.contact_person ? data.contact_person.trim() : null,
        email,
        data.phone ? data.phone.trim() : null,
        data.address ? data.address.trim() : null
    ]);

    return getSupplierById(result.insertId);
}

async function updateSupplier(id, data) {
    const supplier = await getSupplierById(id);
    if (!supplier) {
        const err = new Error(`Supplier with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    const updates = [];
    const params = [];

    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name.trim());
    }

    if (data.contact_person !== undefined) {
        updates.push('contact_person = ?');
        params.push(data.contact_person ? data.contact_person.trim() : null);
    }

    if (data.email !== undefined) {
        updates.push('email = ?');
        params.push(data.email.trim().toLowerCase());
    }

    if (data.phone !== undefined) {
        updates.push('phone = ?');
        params.push(data.phone ? data.phone.trim() : null);
    }

    if (data.address !== undefined) {
        updates.push('address = ?');
        params.push(data.address ? data.address.trim() : null);
    }

    if (updates.length === 0) return supplier;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`, params);
    return getSupplierById(id);
}

async function toggleStatus(id, isActive) {
    const supplier = await getSupplierById(id);
    if (!supplier) {
        const err = new Error(`Supplier with ID ${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    const newStatus = isActive ? 1 : 0;
    await db.query('UPDATE suppliers SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
    return getSupplierById(id);
}

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    toggleStatus
};
