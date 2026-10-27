/**
 * Low Stock Alerts Frontend Controller
 */

async function loadLowStock() {
    const search = document.getElementById('lowstock-search').value.trim();

    try {
        const res = await API.get('/inventory/low-stock', { search });
        if (!res.success) return;

        const tbody = document.getElementById('tbody-lowstock');
        const badge = document.getElementById('low-stock-badge');
        badge.textContent = res.data.length;
        badge.style.display = res.data.length > 0 ? 'inline-block' : 'none';

        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-success py-4">🎉 Excellent! No products are currently below their minimum threshold.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data.map(p => {
            const isOut = p.current_stock === 0;
            const severityBadge = isOut ? 
                '<span class="badge badge-danger">OUT OF STOCK</span>' : 
                '<span class="badge badge-warning">LOW STOCK</span>';

            return `
                <tr style="${isOut ? 'background-color: #fff5f5;' : ''}">
                    <td><span class="sku-badge">${escapeHtml(p.sku)}</span></td>
                    <td><strong>${escapeHtml(p.name)}</strong></td>
                    <td><span class="badge badge-secondary">${escapeHtml(p.category_name)}</span></td>
                    <td class="text-sm">${escapeHtml(p.supplier_name)}</td>
                    <td>
                        <strong style="color: ${isOut ? 'var(--danger)' : 'var(--warning)'}; font-size: 15px;">${p.current_stock}</strong>
                    </td>
                    <td>${p.min_stock_threshold} min</td>
                    <td>
                        <span class="badge badge-primary">+${p.suggested_reorder_qty} units</span>
                    </td>
                    <td>$${parseFloat(p.estimated_reorder_cost).toFixed(2)}</td>
                    <td>${severityBadge}</td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-primary" onclick="quickRestockPO(${p.id}, ${p.supplier_id}, ${p.suggested_reorder_qty}, ${p.unit_cost})">
                                📝 Restock PO
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="openStockModalForProduct(${p.id}, '${escapeHtml(p.name)}')">
                                📥 Stock In
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        showToast('Error loading low stock alerts', 'error');
    }
}

async function quickRestockPO(productId, supplierId, suggestedQty, unitCost) {
    await openPOModal();
    document.getElementById('po-supplier').value = supplierId;
    
    // Clear items and add this product pre-filled
    const tbody = document.getElementById('tbody-po-items');
    tbody.innerHTML = '';
    addPOLineItem(productId, suggestedQty, unitCost);
}
