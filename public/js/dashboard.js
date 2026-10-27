/**
 * Dashboard Controller
 */

async function loadDashboard() {
    try {
        const res = await API.get('/dashboard/summary');
        if (!res.success) return;

        const data = res.data;
        const m = data.metrics;

        // Stat cards
        document.getElementById('stat-products').textContent = m.total_active_products;
        document.getElementById('stat-units').textContent = m.total_units_in_stock.toLocaleString();
        document.getElementById('stat-valuation').textContent = `$${m.total_inventory_valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('stat-low-stock').textContent = m.low_stock_count;
        document.getElementById('stat-out-of-stock').textContent = m.out_of_stock_count;
        document.getElementById('stat-pending-po').textContent = m.pending_orders;
        document.getElementById('stat-received-po').textContent = m.received_orders;
        document.getElementById('stat-categories').textContent = m.total_categories;
        document.getElementById('stat-suppliers').textContent = m.total_suppliers;

        // Nav badges
        const lowBadge = document.getElementById('low-stock-badge');
        lowBadge.textContent = m.low_stock_count;
        lowBadge.style.display = m.low_stock_count > 0 ? 'inline-block' : 'none';

        const poBadge = document.getElementById('pending-po-badge');
        poBadge.textContent = m.pending_orders;
        poBadge.style.display = m.pending_orders > 0 ? 'inline-block' : 'none';

        // Render Stock Distribution Bars
        renderStockDistribution(data.stock_status_breakdown, m.total_active_products);

        // Render Recent Movements Table
        renderDashboardMovements(data.recent_movements || []);

        // Render Recent Products Table
        renderDashboardProducts(data.recent_products || []);
    } catch (err) {
        console.error('Error loading dashboard summary:', err);
        showToast('Failed to load dashboard metrics', 'error');
    }
}

function renderStockDistribution(breakdown, total) {
    const container = document.getElementById('stock-distribution-container');
    if (!total || total === 0) {
        container.innerHTML = '<p class="text-muted text-sm">No products found in inventory.</p>';
        return;
    }

    const inStockPct = Math.round((breakdown.in_stock / total) * 100);
    const lowStockPct = Math.round((breakdown.low_stock / total) * 100);
    const outOfStockPct = Math.round((breakdown.out_of_stock / total) * 100);

    container.innerHTML = `
        <div class="dist-item">
            <div class="dist-header">
                <span>Healthy In-Stock (${breakdown.in_stock})</span>
                <span class="text-success font-weight-bold">${inStockPct}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill green" style="width: ${inStockPct}%"></div>
            </div>
        </div>

        <div class="dist-item">
            <div class="dist-header">
                <span>Low Stock - Below Threshold (${breakdown.low_stock})</span>
                <span class="text-warning font-weight-bold">${lowStockPct}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill yellow" style="width: ${lowStockPct}%"></div>
            </div>
        </div>

        <div class="dist-item">
            <div class="dist-header">
                <span>Out of Stock (${breakdown.out_of_stock})</span>
                <span class="text-danger font-weight-bold">${outOfStockPct}%</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill red" style="width: ${outOfStockPct}%"></div>
            </div>
        </div>
    `;
}

function renderDashboardMovements(movements) {
    const tbody = document.querySelector('#table-dash-movements tbody');
    if (!movements.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center py-3">No inventory movements recorded yet.</td></tr>';
        return;
    }

    tbody.innerHTML = movements.map(m => {
        let typeBadge = '';
        if (m.movement_type === 'STOCK_IN') typeBadge = '<span class="badge badge-success">+ IN</span>';
        else if (m.movement_type === 'STOCK_OUT') typeBadge = '<span class="badge badge-danger">- OUT</span>';
        else typeBadge = '<span class="badge badge-warning">⚖ ADJ</span>';

        const formattedTime = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(m.product_name)}</div>
                    <span class="sku-badge">${escapeHtml(m.sku)}</span>
                </td>
                <td>${typeBadge}</td>
                <td><strong>${m.quantity}</strong></td>
                <td><span class="text-muted">${m.previous_stock} &rarr;</span> <strong>${m.new_stock}</strong></td>
                <td class="text-muted text-sm">${formattedTime}</td>
            </tr>
        `;
    }).join('');
}

function renderDashboardProducts(products) {
    const tbody = document.querySelector('#table-dash-products tbody');
    if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center py-3">No products available.</td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => `
        <tr>
            <td><span class="sku-badge">${escapeHtml(p.sku)}</span></td>
            <td style="font-weight: 500;">${escapeHtml(p.name)}</td>
            <td><span class="badge badge-secondary">${escapeHtml(p.category_name)}</span></td>
            <td><strong>${p.current_stock}</strong> <span class="text-muted text-sm">/ ${p.min_stock_threshold} min</span></td>
            <td>$${parseFloat(p.unit_cost).toFixed(2)}</td>
        </tr>
    `).join('');
}
