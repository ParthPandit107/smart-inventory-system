const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', purchaseOrderController.getPurchaseOrders);
router.get('/:id', purchaseOrderController.getPurchaseOrderById);
router.post('/', optionalAuth, purchaseOrderController.createPurchaseOrder);
router.post('/:id/receive', optionalAuth, purchaseOrderController.receivePurchaseOrder);
router.post('/:id/cancel', optionalAuth, purchaseOrderController.cancelPurchaseOrder);

module.exports = router;
