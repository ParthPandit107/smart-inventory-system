const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Health check endpoint
router.get('/health', async (req, res) => {
    let dbStatus = 'healthy';
    let dbError = null;

    try {
        await db.query('SELECT 1 as ping');
    } catch (err) {
        dbStatus = 'unhealthy';
        dbError = err.message;
    }

    return res.status(dbStatus === 'healthy' ? 200 : 503).json({
        success: dbStatus === 'healthy',
        service: 'Smart Inventory Management System API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: {
            driver: db.getDriverName(),
            status: dbStatus,
            error: dbError
        }
    });
});

// Mount modules
router.use('/auth', require('./authRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/suppliers', require('./supplierRoutes'));
router.use('/inventory', require('./inventoryRoutes'));
router.use('/purchase-orders', require('./purchaseOrderRoutes'));
router.use('/reports', require('./reportRoutes'));

module.exports = router;
