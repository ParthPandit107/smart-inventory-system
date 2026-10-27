/**
 * Purchase Order Management & Restocking Service
 * Manages procurement lifecycle and executes atomic restocking transactions.
 */

const db = require('../config/database');

/**
 * Get Paginated Purchase Orders with Filter by Status / Supplier
 */
async function getPurchaseOrders({ page = 1, limit = 10, status, supplierId }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const params = [];

    if (status && ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'].includes(status.toUpperCase())) {
        whereClauses.push('po.status = ?');
        params.push(status.toUpperCase());
    }

    if (supplierId) {
        whereClauses.push('po.supplier_id = ?');
        params.push(Number(supplierId));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await db.query(`SELECT COUNT(*) as total FROM purchase_orders po ${whereSql}`, params);
    const totalItems = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    const [orders] = await db.query(`
        SELECT 
            po.id,
            po.po_number,
            po.supplier_id,
            s.name as supplier_name,
            s.email as supplier_email,
            po.order_date,
            po.expected_delivery_date,
            po.status,
            po.total_amount,
            po.notes,
            po.received_at,
            po.created_at,
            COUNT(poi.id) as item_count,
            COALESCE(SUM(poi.quantity_ordered), 0) as total_units_ordered,
            u.full_name as created_by_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
        LEFT JOIN users u ON po.created_by = u.id
        ${whereSql}
        GROUP BY po.id
        ORDER BY po.created_at DESC, po.id DESC
        LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    return {
        orders,
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
 * Get Detailed Purchase Order with line items
 */
async function getPurchaseOrderById(id) {
    const [orders] = await db.query(`
        SELECT 
            po.*,
            s.name as supplier_name,
            s.contact_person as supplier_contact,
            s.email as supplier_email,
            s.phone as supplier_phone,
            s.address as supplier_address,
            u.full_name as created_by_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.created_by = u.id
        WHERE po.id = ?
    `, [id]);

    const order = orders[0];
    if (!order) return null;

    const [items] = await db.query(`
        SELECT 
            poi.id,
            poi.purchase_order_id,
            poi.product_id,
            p.sku as product_sku,
            p.name as product_name,
            p.current_stock as product_current_stock,
            poi.quantity_ordered,
            poi.unit_cost,
            poi.total_price
        FROM purchase_order_items poi
        JOIN products p ON poi.product_id = p.id
        WHERE poi.purchase_order_id = ?
        ORDER BY poi.id ASC
    `, [id]);

    order.items = items;
    return order;
}

/**
 * Create a new Purchase Order with Items
 * Validates products & recalculates all item subtotals and order totals on backend.
 */
async function createPurchaseOrder({ supplier_id, order_date, expected_delivery_date, status = 'ORDERED', notes, items, userId }) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Validate Supplier
        const [suppliers] = await conn.query('SELECT id, name FROM suppliers WHERE id = ? AND is_active = 1', [supplier_id]);
        if (!suppliers || suppliers.length === 0) {
            const err = new Error(`Active supplier with ID ${supplier_id} not found.`);
            err.statusCode = 404;
            throw err;
        }

        // 2. Validate all products and calculate line totals
        let calculatedTotal = 0;
        const processedItems = [];

        for (const item of items) {
            const [products] = await conn.query('SELECT id, sku, name, unit_cost FROM products WHERE id = ?', [item.product_id]);
            const product = products[0];
            if (!product) {
                const err = new Error(`Product with ID ${item.product_id} does not exist.`);
                err.statusCode = 404;
                throw err;
            }

            const qty = parseInt(item.quantity_ordered, 10);
            if (!qty || qty <= 0) {
                const err = new Error(`Quantity for product '${product.name}' must be greater than 0.`);
                err.statusCode = 400;
                throw err;
            }

            // Use item cost if specified, otherwise fall back to product unit_cost
            const unitCost = item.unit_cost !== undefined ? parseFloat(item.unit_cost) : parseFloat(product.unit_cost);
            const lineTotal = Number((qty * unitCost).toFixed(2));
            calculatedTotal += lineTotal;

            processedItems.push({
                product_id: product.id,
                quantity_ordered: qty,
                unit_cost: unitCost,
                total_price: lineTotal
            });
        }

        calculatedTotal = Number(calculatedTotal.toFixed(2));

        // Generate PO Number: PO-YYYYMMDD-XXXX
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const poNumber = `PO-${dateStr}-${randomSuffix}`;

        const validStatus = ['DRAFT', 'ORDERED'].includes(status.toUpperCase()) ? status.toUpperCase() : 'ORDERED';

        // 3. Insert Purchase Order Header
        const [poResult] = await conn.query(`
            INSERT INTO purchase_orders (
                po_number, supplier_id, order_date, expected_delivery_date,
                status, total_amount, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            poNumber,
            supplier_id,
            order_date || new Date().toISOString().slice(0, 10),
            expected_delivery_date || null,
            validStatus,
            calculatedTotal,
            notes ? notes.trim() : null,
            userId || null
        ]);

        const poId = poResult.insertId;

        // 4. Insert Purchase Order Items
        for (const itm of processedItems) {
            await conn.query(`
                INSERT INTO purchase_order_items (
                    purchase_order_id, product_id, quantity_ordered, unit_cost, total_price
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                poId,
                itm.product_id,
                itm.quantity_ordered,
                itm.unit_cost,
                itm.total_price
            ]);
        }

        await conn.commit();
        return getPurchaseOrderById(poId);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Receive Purchase Order (Restock)
 * Atomic transaction:
 * 1. Checks PO status is 'ORDERED'
 * 2. Prevents duplicate receiving (409 Conflict)
 * 3. Updates product stock for each line item
 * 4. Logs STOCK_IN inventory movements
 * 5. Updates PO status to 'RECEIVED' and sets received_at
 */
async function receivePurchaseOrder(id, userId = null) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Lock PO row
        const [orders] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [id]);
        const po = orders[0];

        if (!po) {
            const err = new Error(`Purchase order #${id} not found.`);
            err.statusCode = 404;
            throw err;
        }

        if (po.status === 'RECEIVED') {
            const err = new Error(
                `Purchase order '${po.po_number}' has already been received on ${po.received_at || 'earlier date'}. Duplicate receipt is prohibited.`
            );
            err.statusCode = 409;
            throw err;
        }

        if (po.status === 'CANCELLED') {
            const err = new Error(`Cannot receive purchase order '${po.po_number}' because it has been cancelled.`);
            err.statusCode = 400;
            throw err;
        }

        // Fetch PO items
        const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
        if (!items || items.length === 0) {
            const err = new Error(`Purchase order '${po.po_number}' contains no line items to receive.`);
            err.statusCode = 400;
            throw err;
        }

        // For each item, update product stock and create movement record
        for (const item of items) {
            // Lock product row
            const [products] = await conn.query('SELECT id, sku, name, current_stock FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
            const product = products[0];
            if (!product) {
                const err = new Error(`Product #${item.product_id} in purchase order does not exist.`);
                err.statusCode = 404;
                throw err;
            }

            const previousStock = product.current_stock;
            const newStock = previousStock + item.quantity_ordered;

            // 1. Update product stock
            await conn.query('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, product.id]);

            // 2. Insert movement audit record
            await conn.query(`
                INSERT INTO inventory_movements (
                    product_id, movement_type, quantity, previous_stock, new_stock, reason, reference_number, created_by
                ) VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?, ?)
            `, [
                product.id,
                item.quantity_ordered,
                previousStock,
                newStock,
                `Restocked via Purchase Order ${po.po_number}`,
                po.po_number,
                userId
            ]);
        }

        // Update PO Header Status
        await conn.query(`
            UPDATE purchase_orders 
            SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [id]);

        await conn.commit();
        return getPurchaseOrderById(id);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Cancel Purchase Order
 * Sets status to CANCELLED without touching stock
 */
async function cancelPurchaseOrder(id) {
    const po = await getPurchaseOrderById(id);
    if (!po) {
        const err = new Error(`Purchase order #${id} not found.`);
        err.statusCode = 404;
        throw err;
    }

    if (po.status === 'RECEIVED') {
        const err = new Error(`Cannot cancel purchase order '${po.po_number}' because it has already been received.`);
        err.statusCode = 409;
        throw err;
    }

    if (po.status === 'CANCELLED') {
        return po;
    }

    await db.query(`
        UPDATE purchase_orders 
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [id]);

    return getPurchaseOrderById(id);
}

module.exports = {
    getPurchaseOrders,
    getPurchaseOrderById,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder
};
