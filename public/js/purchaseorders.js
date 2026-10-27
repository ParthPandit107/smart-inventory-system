/**
 * Purchase Order & Restocking Frontend Controller
 */

let currentPOPage = 1;

async function loadPurchaseOrders(page = currentPOPage) {
    currentPOPage = page;
    const status = document.getElementById('po-status-filter').value;

    try {
        const res = await API.get('/purchase-orders', {
            page: currentPOPage,
            limit: 10,
            status
        });

        if (!res.success) return;

        const tbody = document.getElementById('tbody-pos');
        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No purchase orders found.</td></tr>';
            document.getElementById('po-pagination-info').textContent = 'Showing 0 of 0 purchase orders';
            document.getElementById('po-pagination-btns').innerHTML = '';
            return;
        }

        tbody.innerHTML = res.data.map(po => {
            let statusBadge = '';
            if (po.status === 'ORDERED') statusBadge = '<span class="badge badge-warning">ORDERED</span>';
            else if (po.status === 'RECEIVED') statusBadge = '<span class="badge badge-success">RECEIVED</span>';
            else if (po.status === 'CANCELLED') statusBadge = '<span class="badge badge-danger">CANCELLED</span>';
            else statusBadge = '<span class="badge badge-secondary">DRAFT</span>';

            return `
                <tr>
                    <td><strong>${escapeHtml(po.po_number)}</strong></td>
                    <td>
                        ${escapeHtml(po.supplier_name)}<br>
                        <span class="text-muted text-sm">${escapeHtml(po.supplier_email)}</span>
                    </td>
                    <td class="text-sm">${po.order_date}</td>
                    <td class="text-sm text-muted">${po.expected_delivery_date || '—'}</td>
                    <td><span class="badge badge-secondary">${po.item_count} items (${po.total_units_ordered} units)</span></td>
                    <td><strong style="font-size: 14px;">$${parseFloat(po.total_amount).toFixed(2)}</strong></td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-outline" onclick="viewPODetails(${po.id})">🔍 Details</button>
                            ${po.status === 'ORDERED' ? `
                                <button class="btn btn-sm btn-success" onclick="receivePO(${po.id}, '${escapeHtml(po.po_number)}')">📥 Receive</button>
                                <button class="btn btn-sm btn-danger" onclick="cancelPO(${po.id}, '${escapeHtml(po.po_number)}')">❌ Cancel</button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Pagination
        const meta = res.meta;
        const start = (meta.currentPage - 1) * meta.limit + 1;
        const end = Math.min(meta.currentPage * meta.limit, meta.totalItems);
        document.getElementById('po-pagination-info').textContent = `Showing ${start}-${end} of ${meta.totalItems} orders`;

        let btns = '';
        if (meta.hasPrevPage) {
            btns += `<button class="btn btn-sm btn-outline" onclick="loadPurchaseOrders(${meta.currentPage - 1})">&laquo; Prev</button>`;
        }
        btns += `<span class="btn btn-sm btn-outline" style="pointer-events: none;">Page ${meta.currentPage} of ${meta.totalPages}</span>`;
        if (meta.hasNextPage) {
            btns += `<button class="btn btn-sm btn-outline" onclick="loadPurchaseOrders(${meta.currentPage + 1})">Next &raquo;</button>`;
        }
        document.getElementById('po-pagination-btns').innerHTML = btns;
    } catch (err) {
        showToast('Error loading purchase orders', 'error');
    }
}

async function openPOModal() {
    document.getElementById('form-po').reset();
    document.getElementById('po-order-date').value = new Date().toISOString().slice(0, 10);
    
    // Populate suppliers dropdown
    const supsRes = await API.get('/suppliers');
    const supSelect = document.getElementById('po-supplier');
    supSelect.innerHTML = supsRes.data.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    // Pre-cache all products
    const prodsRes = await API.get('/products', { limit: 100, sortBy: 'name', order: 'asc' });
    cachedProductsList = prodsRes.data;

    // Reset line items and add first row
    const tbody = document.getElementById('tbody-po-items');
    tbody.innerHTML = '';
    addPOLineItem();

    openModal('modal-po');
}

function addPOLineItem(preselectedProductId = null, prefilledQty = 10, prefilledCost = null) {
    const tbody = document.getElementById('tbody-po-items');
    const rowId = `po-item-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const options = cachedProductsList.map(p => {
        const isSel = preselectedProductId && p.id === Number(preselectedProductId) ? 'selected' : '';
        return `<option value="${p.id}" data-cost="${p.unit_cost}" ${isSel}>${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`;
    }).join('');

    const defaultCost = prefilledCost !== null ? prefilledCost : (cachedProductsList[0]?.unit_cost || 0);

    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.innerHTML = `
        <td>
            <select class="po-item-product" required onchange="handlePOProductChange('${rowId}')">
                ${options}
            </select>
        </td>
        <td>
            <input type="number" min="1" class="po-item-qty" required value="${prefilledQty}" oninput="recalcPOTotal()">
        </td>
        <td>
            <input type="number" step="0.01" min="0" class="po-item-cost" required value="${defaultCost}" oninput="recalcPOTotal()">
        </td>
        <td>
            <button type="button" class="btn btn-sm btn-danger" onclick="removePOLineItem('${rowId}')">✕</button>
        </td>
    `;

    tbody.appendChild(tr);
    recalcPOTotal();
}

function removePOLineItem(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        const tbody = document.getElementById('tbody-po-items');
        if (tbody.children.length <= 1) {
            showToast('A purchase order requires at least one item.', 'warning');
            return;
        }
        row.remove();
        recalcPOTotal();
    }
}

function handlePOProductChange(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const select = row.querySelector('.po-item-product');
    const option = select.options[select.selectedIndex];
    if (option) {
        row.querySelector('.po-item-cost').value = option.dataset.cost || 0;
        recalcPOTotal();
    }
}

function recalcPOTotal() {
    const rows = document.querySelectorAll('#tbody-po-items tr');
    let total = 0;

    rows.forEach(r => {
        const qty = parseFloat(r.querySelector('.po-item-qty')?.value) || 0;
        const cost = parseFloat(r.querySelector('.po-item-cost')?.value) || 0;
        total += (qty * cost);
    });

    document.getElementById('po-preview-total').textContent = `$${total.toFixed(2)}`;
}

async function handlePOSubmit(e) {
    e.preventDefault();
    const supplier_id = parseInt(document.getElementById('po-supplier').value, 10);
    const order_date = document.getElementById('po-order-date').value;
    const expected_delivery_date = document.getElementById('po-delivery-date').value;
    const notes = document.getElementById('po-notes').value.trim();

    const rows = document.querySelectorAll('#tbody-po-items tr');
    const items = [];

    rows.forEach(r => {
        const product_id = parseInt(r.querySelector('.po-item-product').value, 10);
        const quantity_ordered = parseInt(r.querySelector('.po-item-qty').value, 10);
        const unit_cost = parseFloat(r.querySelector('.po-item-cost').value);

        if (product_id && quantity_ordered > 0) {
            items.push({ product_id, quantity_ordered, unit_cost });
        }
    });

    if (items.length === 0) {
        showToast('Please add at least one line item with valid quantity.', 'warning');
        return;
    }

    try {
        const res = await API.post('/purchase-orders', {
            supplier_id,
            order_date,
            expected_delivery_date,
            notes,
            items
        });

        if (res.success) {
            closeModal('modal-po');
            showToast(`Purchase order ${res.data.po_number} created successfully!`, 'success');
            loadPurchaseOrders(1);
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Failed to create purchase order', 'error');
    }
}

async function viewPODetails(id) {
    try {
        const res = await API.get(`/purchase-orders/${id}`);
        if (!res.success) return;

        const po = res.data;
        document.getElementById('modal-view-po-number').textContent = `Purchase Order: ${po.po_number}`;

        let statusClass = 'badge-secondary';
        if (po.status === 'ORDERED') statusClass = 'badge-warning';
        if (po.status === 'RECEIVED') statusClass = 'badge-success';
        if (po.status === 'CANCELLED') statusClass = 'badge-danger';

        const content = document.getElementById('po-details-content');
        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 14px;">
                <div>
                    <h4 style="font-size: 16px;">Supplier: ${escapeHtml(po.supplier_name)}</h4>
                    <p class="text-sm text-muted">Contact: ${escapeHtml(po.supplier_contact || '—')} (${escapeHtml(po.supplier_email)})</p>
                    <p class="text-sm text-muted">Phone: ${escapeHtml(po.supplier_phone || '—')}</p>
                </div>
                <div style="text-align: right;">
                    <span class="badge ${statusClass}" style="font-size: 12px; margin-bottom: 4px;">${po.status}</span>
                    <p class="text-sm">Order Date: <strong>${po.order_date}</strong></p>
                    <p class="text-sm text-muted">Expected: ${po.expected_delivery_date || '—'}</p>
                    ${po.received_at ? `<p class="text-sm text-success">Received: ${new Date(po.received_at).toLocaleString()}</p>` : ''}
                </div>
            </div>

            <h5>Line Items</h5>
            <div class="table-responsive mt-1">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Product Name</th>
                            <th>Qty Ordered</th>
                            <th>Unit Cost ($)</th>
                            <th>Subtotal ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${po.items.map(item => `
                            <tr>
                                <td><span class="sku-badge">${escapeHtml(item.product_sku)}</span></td>
                                <td><strong>${escapeHtml(item.product_name)}</strong></td>
                                <td>${item.quantity_ordered}</td>
                                <td>$${parseFloat(item.unit_cost).toFixed(2)}</td>
                                <td><strong>$${parseFloat(item.total_price).toFixed(2)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" style="text-align: right; font-weight: 700; padding: 12px 16px;">Order Total:</td>
                            <td style="font-size: 15px; font-weight: 700; color: var(--primary); padding: 12px 16px;">
                                $${parseFloat(po.total_amount).toFixed(2)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            ${po.notes ? `<div class="mt-3 p-2 text-sm text-muted" style="background: #f8fafc; border-radius: 6px;">Notes: ${escapeHtml(po.notes)}</div>` : ''}
        `;

        const footer = document.getElementById('po-details-footer');
        let buttons = `<button type="button" class="btn btn-outline" onclick="closeModal('modal-view-po')">Close</button>`;

        if (po.status === 'ORDERED') {
            buttons = `
                <button type="button" class="btn btn-danger" onclick="cancelPO(${po.id}, '${escapeHtml(po.po_number)}', true)">Cancel Order</button>
                <button type="button" class="btn btn-success" onclick="receivePO(${po.id}, '${escapeHtml(po.po_number)}', true)">📥 Receive & Restock Inventory</button>
                ${buttons}
            `;
        }

        footer.innerHTML = buttons;
        openModal('modal-view-po');
    } catch (err) {
        showToast('Error loading PO details', 'error');
    }
}

async function receivePO(id, poNumber, closeViewModal = false) {
    if (!confirm(`Confirm receipt for Purchase Order ${poNumber}?\n\nThis will atomically increase inventory stock for all order items and create audit movement records in a single database transaction.`)) {
        return;
    }

    try {
        const res = await API.post(`/purchase-orders/${id}/receive`);
        if (res.success) {
            showToast(`PO ${poNumber} received and stock successfully updated!`, 'success');
            if (closeViewModal) closeModal('modal-view-po');
            loadPurchaseOrders(currentPOPage);
            loadDashboard();
            loadProducts();
            loadLowStock();
        }
    } catch (err) {
        showToast(err.message || 'Failed to receive purchase order', 'error');
    }
}

async function cancelPO(id, poNumber, closeViewModal = false) {
    if (!confirm(`Are you sure you want to cancel Purchase Order ${poNumber}?`)) {
        return;
    }

    try {
        const res = await API.post(`/purchase-orders/${id}/cancel`);
        if (res.success) {
            showToast(`PO ${poNumber} cancelled.`, 'info');
            if (closeViewModal) closeModal('modal-view-po');
            loadPurchaseOrders(currentPOPage);
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Failed to cancel purchase order', 'error');
    }
}
