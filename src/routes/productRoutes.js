const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth, authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', optionalAuth, productController.createProduct);
router.put('/:id', optionalAuth, productController.updateProduct);
router.patch('/:id/status', optionalAuth, productController.toggleStatus);
router.delete('/:id', optionalAuth, productController.deleteProduct);

module.exports = router;
