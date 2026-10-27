/**
 * Report Controller
 */

const reportService = require('../services/reportService');
const { generateCsv } = require('../utils/csvExporter');
const { success, error } = require('../utils/responseHelper');

async function getInventoryReport(req, res, next) {
    try {
        const { categoryId, supplierId, stockStatus } = req.query;
        const report = await reportService.getInventoryReport({ categoryId, supplierId, stockStatus });
        return success(res, report, 'Inventory report generated successfully');
    } catch (err) {
        next(err);
    }
}

async function getValuationReport(req, res, next) {
    try {
        const report = await reportService.getValuationReport();
        return success(res, report, 'Valuation report generated successfully');
    } catch (err) {
        next(err);
    }
}

async function getMovementReport(req, res, next) {
    try {
        const { startDate, endDate } = req.query;
        const report = await reportService.getMovementReport({ startDate, endDate });
        return success(res, report, 'Movement summary report generated successfully');
    } catch (err) {
        next(err);
    }
}

async function getSupplierReport(req, res, next) {
    try {
        const report = await reportService.getSupplierReport();
        return success(res, report, 'Supplier supply report generated successfully');
    } catch (err) {
        next(err);
    }
}

async function getPurchaseSummary(req, res, next) {
    try {
        const report = await reportService.getPurchaseSummary();
        return success(res, report, 'Purchase order summary report generated');
    } catch (err) {
        next(err);
    }
}

async function exportCsv(req, res, next) {
    try {
        const { type = 'inventory' } = req.query;
        let filename = `report_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
        let csvContent = '';

        if (type === 'inventory' || type === 'low_stock') {
            const report = await reportService.getInventoryReport({
                stockStatus: type === 'low_stock' ? 'low_stock' : undefined
            });

            const columns = [
                { key: 'sku', label: 'SKU' },
                { key: 'name', label: 'Product Name' },
                { key: 'category_name', label: 'Category' },
                { key: 'supplier_name', label: 'Supplier' },
                { key: 'current_stock', label: 'Stock Quantity' },
                { key: 'min_stock_threshold', label: 'Min Threshold' },
                { key: 'unit_cost', label: 'Unit Cost ($)' },
                { key: 'selling_price', label: 'Selling Price ($)' },
                { key: 'total_valuation', label: 'Valuation ($)' },
                { key: 'stock_status', label: 'Stock Status' }
            ];

            csvContent = generateCsv(report.data, columns);
        } else if (type === 'movements') {
            const report = await reportService.getMovementReport();
            const columns = [
                { key: 'created_at', label: 'Date/Time' },
                { key: 'sku', label: 'SKU' },
                { key: 'product_name', label: 'Product' },
                { key: 'movement_type', label: 'Type' },
                { key: 'quantity', label: 'Quantity' },
                { key: 'previous_stock', label: 'Previous Stock' },
                { key: 'new_stock', label: 'New Stock' },
                { key: 'reference_number', label: 'Reference' },
                { key: 'reason', label: 'Reason' },
                { key: 'recorded_by', label: 'User' }
            ];
            csvContent = generateCsv(report.movements, columns);
        } else if (type === 'valuation') {
            const report = await reportService.getValuationReport();
            const columns = [
                { key: 'category_name', label: 'Category' },
                { key: 'product_count', label: 'Product Count' },
                { key: 'total_units', label: 'Total Units' },
                { key: 'inventory_valuation', label: 'Inventory Cost Valuation ($)' },
                { key: 'retail_valuation', label: 'Retail Valuation ($)' },
                { key: 'gross_margin_percentage', label: 'Gross Margin %' }
            ];
            csvContent = generateCsv(report.categories, columns);
        } else if (type === 'suppliers') {
            const report = await reportService.getSupplierReport();
            const columns = [
                { key: 'supplier_name', label: 'Supplier Name' },
                { key: 'contact_person', label: 'Contact Person' },
                { key: 'email', label: 'Email' },
                { key: 'active_products', label: 'Active Products' },
                { key: 'total_stock_held', label: 'Units Held' },
                { key: 'inventory_value', label: 'Inventory Value ($)' },
                { key: 'total_purchase_orders', label: 'Total POs' },
                { key: 'total_purchased_amount', label: 'Total Spend ($)' }
            ];
            csvContent = generateCsv(report, columns);
        } else {
            return error(res, `Unknown report export type: ${type}`, 400);
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getInventoryReport,
    getValuationReport,
    getMovementReport,
    getSupplierReport,
    getPurchaseSummary,
    exportCsv
};
