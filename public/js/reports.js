/**
 * Reports & Data Export Controller
 */

let activeReportTab = 'inventory';

function switchReportTab(tab) {
    activeReportTab = tab;
    document.querySelectorAll('.report-tab').forEach(btn => btn.classList.remove('active'));
    
    // Find matching button
    const activeBtn = Array.from(document.querySelectorAll('.report-tab')).find(b => b.getAttribute('onclick').includes(tab));
    if (activeBtn) activeBtn.classList.add('active');

    loadActiveReport();
}

async function loadActiveReport() {
    const container = document.getElementById('report-content-container');
    const title = document.getElementById('current-report-title');

    container.innerHTML = '<div class="p-4 text-center text-muted">Generating database-driven analytical report...</div>';

    try {
        if (activeReportTab === 'inventory') {
            title.textContent = 'Current Inventory Valuation & Gross Margin Projection';
            const res = await API.get('/reports/inventory');
            if (!res.success) return;

            const summary = res.data.summary;
            const rows = res.data.data;

            container.innerHTML = `
                <div style="display: flex; gap: 16px; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid var(--border); flex-wrap: wrap;">
                    <div>Catalog Items: <strong>${summary.total_items}</strong></div>
                    <div>Total Stored Units: <strong>${summary.total_units.toLocaleString()}</strong></div>
                    <div>Inventory Valuation (Cost): <strong>$${summary.total_inventory_valuation.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
                    <div>Retail Value: <strong>$${summary.total_retail_value.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
                    <div>Projected Margin: <strong class="text-success">$${summary.projected_margin.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Unit Cost ($)</th>
                                <th>Selling Price ($)</th>
                                <th>Valuation ($)</th>
                                <th>Projected Profit ($)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(r => `
                                <tr>
                                    <td><span class="sku-badge">${escapeHtml(r.sku)}</span></td>
                                    <td><strong>${escapeHtml(r.name)}</strong></td>
                                    <td>${escapeHtml(r.category_name)}</td>
                                    <td><strong>${r.current_stock}</strong></td>
                                    <td>$${parseFloat(r.unit_cost).toFixed(2)}</td>
                                    <td>$${parseFloat(r.selling_price).toFixed(2)}</td>
                                    <td><strong>$${parseFloat(r.total_valuation).toFixed(2)}</strong></td>
                                    <td class="text-success">+$${parseFloat(r.potential_profit).toFixed(2)}</td>
                                    <td><span class="badge ${r.stock_status === 'IN_STOCK' ? 'badge-success' : (r.stock_status === 'LOW_STOCK' ? 'badge-warning' : 'badge-danger')}">${r.stock_status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (activeReportTab === 'category') {
            title.textContent = 'Inventory Valuation Grouped by Product Category';
            const res = await API.get('/reports/valuation');
            if (!res.success) return;

            const cats = res.data.categories;
            const overall = res.data.overall;

            container.innerHTML = `
                <div style="display: flex; gap: 20px; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid var(--border); flex-wrap: wrap;">
                    <div>Total Active Products: <strong>${overall.total_products}</strong></div>
                    <div>Total Inventory Valuation: <strong>$${parseFloat(overall.total_valuation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
                    <div>Total Retail Valuation: <strong>$${parseFloat(overall.total_retail_valuation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Category Name</th>
                                <th>Product Count</th>
                                <th>Total Stock Units</th>
                                <th>Inventory Asset Valuation ($)</th>
                                <th>Retail Asset Valuation ($)</th>
                                <th>Gross Margin %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cats.map(c => `
                                <tr>
                                    <td><strong>${escapeHtml(c.category_name)}</strong></td>
                                    <td><span class="badge badge-primary">${c.product_count} items</span></td>
                                    <td>${Number(c.total_units || 0).toLocaleString()}</td>
                                    <td><strong>$${parseFloat(c.inventory_valuation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                                    <td>$${parseFloat(c.retail_valuation || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td><strong class="text-success">${c.gross_margin_percentage}%</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (activeReportTab === 'supplier') {
            title.textContent = 'Supplier Inventory Distribution & Procurement Spend';
            const res = await API.get('/reports/suppliers');
            if (!res.success) return;

            const sups = res.data;

            container.innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Supplier Name</th>
                                <th>Contact Person</th>
                                <th>Email</th>
                                <th>Active Products</th>
                                <th>Inventory Held (Units)</th>
                                <th>Inventory Value ($)</th>
                                <th>POs Issued</th>
                                <th>Total Spend ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sups.map(s => `
                                <tr>
                                    <td><strong>${escapeHtml(s.supplier_name)}</strong></td>
                                    <td>${escapeHtml(s.contact_person || '—')}</td>
                                    <td>${escapeHtml(s.email)}</td>
                                    <td><span class="badge badge-secondary">${s.active_products}</span></td>
                                    <td>${Number(s.total_stock_held || 0).toLocaleString()}</td>
                                    <td><strong>$${parseFloat(s.inventory_value || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                                    <td>${s.total_purchase_orders}</td>
                                    <td><strong class="text-primary">$${parseFloat(s.total_purchased_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else if (activeReportTab === 'purchases') {
            title.textContent = 'Procurement Overview & Status Summary';
            const res = await API.get('/reports/purchases');
            if (!res.success) return;

            const breakdown = res.data.status_breakdown;
            const orders = res.data.recent_orders;

            container.innerHTML = `
                <div style="display: flex; gap: 20px; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid var(--border); flex-wrap: wrap;">
                    ${breakdown.map(b => `
                        <div>Status <strong>${b.status}</strong>: ${b.order_count} orders ($${parseFloat(b.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})})</div>
                    `).join('')}
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>PO Number</th>
                                <th>Supplier</th>
                                <th>Order Date</th>
                                <th>Delivery Date</th>
                                <th>Status</th>
                                <th>Total Spend ($)</th>
                                <th>Received Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(o => `
                                <tr>
                                    <td><strong>${escapeHtml(o.po_number)}</strong></td>
                                    <td>${escapeHtml(o.supplier_name)}</td>
                                    <td>${o.order_date}</td>
                                    <td class="text-muted text-sm">${o.expected_delivery_date || '—'}</td>
                                    <td><span class="badge ${o.status === 'RECEIVED' ? 'badge-success' : (o.status === 'ORDERED' ? 'badge-warning' : 'badge-secondary')}">${o.status}</span></td>
                                    <td><strong>$${parseFloat(o.total_amount).toFixed(2)}</strong></td>
                                    <td class="text-sm text-muted">${o.received_at ? new Date(o.received_at).toLocaleString() : '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = `<div class="p-4 text-center text-danger">Failed to generate report: ${escapeHtml(err.message)}</div>`;
    }
}

function exportActiveReportCsv() {
    let typeParam = 'inventory';
    if (activeReportTab === 'category') typeParam = 'valuation';
    else if (activeReportTab === 'supplier') typeParam = 'suppliers';
    else if (activeReportTab === 'purchases') typeParam = 'inventory';

    window.location.href = `/api/reports/export.csv?type=${typeParam}`;
}
