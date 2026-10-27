const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { optionalAuth } = require('../middleware/auth');

router.get('/low-stock', inventoryController.getLowStock);
router.get('/movements', inventoryController.getMovements);
router.post('/stock-in', optionalAuth, inventoryController.recordStockIn);
router.post('/stock-out', optionalAuth, inventoryController.recordStockOut);
router.post('/adjustments', optionalAuth, inventoryController.recordAdjustment);

module.exports = router;
