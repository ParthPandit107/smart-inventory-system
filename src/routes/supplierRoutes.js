const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', supplierController.getSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', optionalAuth, supplierController.createSupplier);
router.put('/:id', optionalAuth, supplierController.updateSupplier);
router.patch('/:id/status', optionalAuth, supplierController.toggleStatus);

module.exports = router;
