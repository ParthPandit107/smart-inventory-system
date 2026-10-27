const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/inventory', reportController.getInventoryReport);
router.get('/valuation', reportController.getValuationReport);
router.get('/movements', reportController.getMovementReport);
router.get('/suppliers', reportController.getSupplierReport);
router.get('/purchases', reportController.getPurchaseSummary);
router.get('/export.csv', reportController.exportCsv);

module.exports = router;
