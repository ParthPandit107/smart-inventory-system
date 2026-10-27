/**
 * Reports Service
 * Provides SQL aggregation queries for inventory valuation, stock movements,
 * supplier breakdowns, category statistics, and CSV data generation.
 */

const db = require('../config/database');

/**
 * 1. Current Inventory Report
 */
async function getInventoryReport({ categoryId, supplierId, stockStatus } = {}) {
    const whereClauses = ['p.is_active = 1'];
    const params = [];

    if (categoryId) {
        whereClauses.push('p.category_id = ?');
        params.push(Number(categoryId));
    }
    if (supplierId) {
        whereClauses.push('p.supplier_id = ?');
        params.push(Number(supplierId));
    }
    if (stockStatus === 'low_stock') {
        whereClauses.push('p.current_stock <= p.min_stock_threshold');
    } else if (stockStatus === 'out_of_stock') {
        whereClauses.push('p.current_stock = 0');
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const [rows] = await db.query(`
        SELECT 
            p.id,
            p.sku,
            p.name,
            c.name as category_name,
            s.name as supplier_name,
            p.unit_cost,
            p.selling_price,
            p.current_stock,
            p.min_stock_threshold,
            (p.current_stock * p.unit_cost) as total_valuation,
            (p.current_stock * p.selling_price) as total_retail_value,
            ((p.selling_price - p.unit_cost) * p.current_stock) as potential_profit,
            CASE 
                WHEN p.current_stock = 0 THEN 'OUT_OF_STOCK'
                WHEN p.current_stock <= p.min_stock_threshold THEN 'LOW_STOCK'
                ELSE 'IN_STOCK'
            END as stock_status
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN suppliers s ON p.supplier_id = s.id
        ${whereSql}
        ORDER BY p.name ASC
    `, params);

    // Summary totals
    let totalStock = 0;
    let totalValuation = 0;
    let totalRetail = 0;

    rows.forEach(r => {
        totalStock += Number(r.current_stock);
        totalValuation += Number(r.total_valuation);
        totalRetail += Number(r.total_retail_value);
    });

    return {
        summary: {
            total_items: rows.length,
            total_units: totalStock,
            total_inventory_valuation: Number(totalValuation.toFixed(2)),
            total_retail_value: Number(totalRetail.toFixed(2)),
            projected_margin: Number((totalRetail - totalValuation).toFixed(2))
        },
        data: rows
    };
}

/**
 * 2. Valuation Report Grouped by Category
 */
async function getValuationReport() {
    const [categoryValuation] = await db.query(`
        SELECT 
            c.id as category_id,
            c.name as category_name,
            COUNT(p.id) as product_count,
            COALESCE(SUM(p.current_stock), 0) as total_units,
            COALESCE(SUM(p.current_stock * p.unit_cost), 0) as inventory_valuation,
            COALESCE(SUM(p.current_stock * p.selling_price), 0) as retail_valuation,
            CASE 
                WHEN SUM(p.current_stock * p.unit_cost) > 0 
                THEN ROUND(((SUM(p.current_stock * p.selling_price) - SUM(p.current_stock * p.unit_cost)) / SUM(p.current_stock * p.selling_price)) * 100, 2)
                ELSE 0 
            END as gross_margin_percentage
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY inventory_valuation DESC
    `);

    const [overallTotals] = await db.query(`
        SELECT 
            COUNT(id) as total_products,
            COALESCE(SUM(current_stock), 0) as total_units,
            COALESCE(SUM(current_stock * unit_cost), 0) as total_valuation,
            COALESCE(SUM(current_stock * selling_price), 0) as total_retail_valuation
        FROM products 
        WHERE is_active = 1
    `);

    return {
        overall: overallTotals[0] || {},
        categories: categoryValuation
    };
}

/**
 * 3. Movement Summary Report
 */
async function getMovementReport({ startDate, endDate } = {}) {
    const whereClauses = [];
    const params = [];

    if (startDate) {
        whereClauses.push('m.created_at >= ?');
        params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
        whereClauses.push('m.created_at <= ?');
        params.push(`${endDate} 23:59:59`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [breakdown] = await db.query(`
        SELECT 
            movement_type,
            COUNT(*) as transaction_count,
            COALESCE(SUM(quantity), 0) as total_quantity
        FROM inventory_movements m
        ${whereSql}
        GROUP BY movement_type
    `, params);

    const [recentRows] = await db.query(`
        SELECT 
            m.id,
            m.created_at,
            p.sku,
            p.name as product_name,
            m.movement_type,
            m.quantity,
            m.previous_stock,
            m.new_stock,
            m.reason,
            m.reference_number,
            u.full_name as recorded_by
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN users u ON m.created_by = u.id
        ${whereSql}
        ORDER BY m.created_at DESC
        LIMIT 100
    `, params);

    return {
        summary: breakdown,
        movements: recentRows
    };
}

/**
 * 4. Supplier Performance & Product Supply Report
 */
async function getSupplierReport() {
    const [rows] = await db.query(`
        SELECT 
            s.id,
            s.name as supplier_name,
            s.contact_person,
            s.email,
            COUNT(DISTINCT p.id) as active_products,
            COALESCE(SUM(p.current_stock), 0) as total_stock_held,
            COALESCE(SUM(p.current_stock * p.unit_cost), 0) as inventory_value,
            COUNT(DISTINCT po.id) as total_purchase_orders,
            COALESCE(SUM(po.total_amount), 0) as total_purchased_amount
        FROM suppliers s
        LEFT JOIN products p ON s.id = p.supplier_id AND p.is_active = 1
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY inventory_value DESC
    `);

    return rows;
}

/**
 * 5. Purchase Order Summary Report
 */
async function getPurchaseSummary() {
    const [statusSummary] = await db.query(`
        SELECT 
            status,
            COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as total_amount
        FROM purchase_orders
        GROUP BY status
    `);

    const [recentOrders] = await db.query(`
        SELECT 
            po.id,
            po.po_number,
            s.name as supplier_name,
            po.order_date,
            po.expected_delivery_date,
            po.status,
            po.total_amount,
            po.received_at
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.id
        ORDER BY po.order_date DESC
        LIMIT 50
    `);

    return {
        status_breakdown: statusSummary,
        recent_orders: recentOrders
    };
}

module.exports = {
    getInventoryReport,
    getValuationReport,
    getMovementReport,
    getSupplierReport,
    getPurchaseSummary
};
