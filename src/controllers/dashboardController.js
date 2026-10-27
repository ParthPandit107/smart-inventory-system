/**
 * Dashboard Controller
 */

const dashboardService = require('../services/dashboardService');
const { success } = require('../utils/responseHelper');

async function getSummary(req, res, next) {
    try {
        const summary = await dashboardService.getDashboardSummary();
        return success(res, summary, 'Dashboard metrics retrieved successfully');
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSummary
};
