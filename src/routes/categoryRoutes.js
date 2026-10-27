const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);
router.post('/', optionalAuth, categoryController.createCategory);
router.put('/:id', optionalAuth, categoryController.updateCategory);
router.patch('/:id/status', optionalAuth, categoryController.toggleStatus);

module.exports = router;
