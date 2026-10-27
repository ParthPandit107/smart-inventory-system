/**
 * Dashboard Analytics Service
 * Executes optimized aggregate SQL queries for live system metrics
 */

const db = require('../config/database');

async function getDashboardSummary() {
    // 1. Metric Counts & Valuations
    const [productMetrics] = await db.query(`
        SELECT 
            COUNT(*) as total_active_products,
            COALESCE(SUM(current_stock), 0) as total_units_in_stock,
            COALESCE(SUM(current_stock * unit_cost), 0) as total_inventory_valuation,
            COALESCE(SUM(current_stock * selling_price), 0) as total_retail_valuation,
            COUNT(CASE WHEN current_stock <= min_stock_threshold THEN 1 END) as low_stock_count,
            COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_count,
            COUNT(CASE WHEN current_stock > min_stock_threshold THEN 1 END) as in_stock_count
        FROM products 
        WHERE is_active = 1
    `);

    // 2. Total Categories
    const [categoryMetrics] = await db.query(`
        SELECT COUNT(*) as total_categories FROM categories WHERE is_active = 1
    `);

    // 3. Total Suppliers
    const [supplierMetrics] = await db.query(`
        SELECT COUNT(*) as total_suppliers FROM suppliers WHERE is_active = 1
    `);

    // 4. Pending Purchase Orders
    const [poMetrics] = await db.query(`
        SELECT 
            COUNT(CASE WHEN status = 'ORDERED' THEN 1 END) as pending_orders,
            COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_orders,
            COUNT(CASE WHEN status = 'RECEIVED' THEN 1 END) as received_orders
        FROM purchase_orders
    `);

    // 5. Recent 5 Inventory Movements
    const [recentMovements] = await db.query(`
        SELECT 
            m.id,
            m.product_id,
            p.name as product_name,
            p.sku,
            m.movement_type,
            m.quantity,
            m.previous_stock,
            m.new_stock,
            m.reason,
            m.reference_number,
            m.created_at,
            u.full_name as created_by_name
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN users u ON m.created_by = u.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 5
    `);

    // 6. Recently Added Products (5)
    const [recentProducts] = await db.query(`
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
            p.created_at
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.is_active = 1
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 5
    `);

    // 7. Movement Summary by Type
    const [movementBreakdown] = await db.query(`
        SELECT 
            movement_type,
            COUNT(*) as movement_count,
            COALESCE(SUM(quantity), 0) as total_quantity
        FROM inventory_movements
        GROUP BY movement_type
    `);

    const p = productMetrics[0] || {};
    const cat = categoryMetrics[0] || {};
    const sup = supplierMetrics[0] || {};
    const po = poMetrics[0] || {};

    return {
        metrics: {
            total_active_products: Number(p.total_active_products || 0),
            total_units_in_stock: Number(p.total_units_in_stock || 0),
            total_categories: Number(cat.total_categories || 0),
            total_suppliers: Number(sup.total_suppliers || 0),
            low_stock_count: Number(p.low_stock_count || 0),
            out_of_stock_count: Number(p.out_of_stock_count || 0),
            in_stock_count: Number(p.in_stock_count || 0),
            total_inventory_valuation: Number(parseFloat(p.total_inventory_valuation || 0).toFixed(2)),
            total_retail_valuation: Number(parseFloat(p.total_retail_valuation || 0).toFixed(2)),
            pending_orders: Number(po.pending_orders || 0),
            draft_orders: Number(po.draft_orders || 0),
            received_orders: Number(po.received_orders || 0)
        },
        stock_status_breakdown: {
            in_stock: Number(p.in_stock_count || 0),
            low_stock: Number(p.low_stock_count || 0) - Number(p.out_of_stock_count || 0),
            out_of_stock: Number(p.out_of_stock_count || 0)
        },
        movement_breakdown: movementBreakdown,
        recent_movements: recentMovements,
        recent_products: recentProducts
    };
}

module.exports = {
    getDashboardSummary
};
