/**
 * Inventory Movement Frontend Controller
 */

let currentMovementPage = 1;

async function loadMovements(page = currentMovementPage) {
    currentMovementPage = page;
    const movementType = document.getElementById('movement-type-filter').value;
    const startDate = document.getElementById('movement-start-date').value;
    const endDate = document.getElementById('movement-end-date').value;

    try {
        const res = await API.get('/inventory/movements', {
            page: currentMovementPage,
            limit: 15,
            movementType,
            startDate,
            endDate
        });

        if (!res.success) return;

        const tbody = document.getElementById('tbody-movements');
        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No matching movement records found.</td></tr>';
            document.getElementById('movement-pagination-info').textContent = 'Showing 0 of 0 movements';
            document.getElementById('movement-pagination-btns').innerHTML = '';
            return;
        }

        tbody.innerHTML = res.data.map(m => {
            let typeBadge = '';
            if (m.movement_type === 'STOCK_IN') typeBadge = '<span class="badge badge-success">+ STOCK IN</span>';
            else if (m.movement_type === 'STOCK_OUT') typeBadge = '<span class="badge badge-danger">- STOCK OUT</span>';
            else typeBadge = '<span class="badge badge-warning">⚖ ADJUSTMENT</span>';

            const dt = new Date(m.created_at).toLocaleString();

            return `
                <tr>
                    <td class="text-muted text-sm">#${m.id}</td>
                    <td class="text-sm">${dt}</td>
                    <td>
                        <strong>${escapeHtml(m.product_name)}</strong><br>
                        <span class="sku-badge">${escapeHtml(m.product_sku)}</span>
                    </td>
                    <td>${typeBadge}</td>
                    <td><strong>${m.quantity}</strong> units</td>
                    <td><span class="text-muted">${m.previous_stock}</span> &rarr; <strong>${m.new_stock}</strong></td>
                    <td><span class="badge badge-secondary">${escapeHtml(m.reference_number || '—')}</span></td>
                    <td class="text-sm">${escapeHtml(m.reason || '—')}</td>
                    <td class="text-muted text-sm">${escapeHtml(m.created_by_name || 'System')}</td>
                </tr>
            `;
        }).join('');

        // Pagination
        const meta = res.meta;
        const start = (meta.currentPage - 1) * meta.limit + 1;
        const end = Math.min(meta.currentPage * meta.limit, meta.totalItems);
        document.getElementById('movement-pagination-info').textContent = `Showing ${start}-${end} of ${meta.totalItems} audit logs`;

        let btns = '';
        if (meta.hasPrevPage) {
            btns += `<button class="btn btn-sm btn-outline" onclick="loadMovements(${meta.currentPage - 1})">&laquo; Prev</button>`;
        }
        btns += `<span class="btn btn-sm btn-outline" style="pointer-events: none;">Page ${meta.currentPage} of ${meta.totalPages}</span>`;
        if (meta.hasNextPage) {
            btns += `<button class="btn btn-sm btn-outline" onclick="loadMovements(${meta.currentPage + 1})">Next &raquo;</button>`;
        }
        document.getElementById('movement-pagination-btns').innerHTML = btns;
    } catch (err) {
        showToast('Error loading movement logs', 'error');
    }
}

function clearMovementFilters() {
    document.getElementById('movement-type-filter').value = '';
    document.getElementById('movement-start-date').value = '';
    document.getElementById('movement-end-date').value = '';
    loadMovements(1);
}

let cachedProductsList = [];

async function openStockModal(type) {
    document.getElementById('form-stock').reset();
    document.getElementById('stock-movement-type').value = type;

    const modalTitle = document.getElementById('modal-stock-title');
    const groupQty = document.getElementById('group-stock-qty');
    const groupTarget = document.getElementById('group-stock-target');
    const labelQty = document.getElementById('label-stock-qty');
    const submitBtn = document.getElementById('btn-submit-stock');

    if (type === 'STOCK_IN') {
        modalTitle.textContent = '📥 Record Stock In (Addition)';
        labelQty.textContent = 'Quantity to Receive *';
        groupQty.style.display = 'block';
        groupTarget.style.display = 'none';
        submitBtn.textContent = 'Confirm Stock In';
        submitBtn.className = 'btn btn-success';
    } else if (type === 'STOCK_OUT') {
        modalTitle.textContent = '📤 Record Stock Out (Dispatch / Removal)';
        labelQty.textContent = 'Quantity to Dispatch *';
        groupQty.style.display = 'block';
        groupTarget.style.display = 'none';
        submitBtn.textContent = 'Confirm Stock Out';
        submitBtn.className = 'btn btn-warning';
    } else {
        modalTitle.textContent = '⚖️ Manual Stock Adjustment (Physical Audit)';
        groupQty.style.display = 'none';
        groupTarget.style.display = 'block';
        submitBtn.textContent = 'Apply Audit Adjustment';
        submitBtn.className = 'btn btn-primary';
    }

    await populateStockProductsDropdown();
    document.getElementById('stock-product-preview').style.display = 'none';
    openModal('modal-stock');
}

async function openStockModalForProduct(productId, productName) {
    await openStockModal('STOCK_IN');
    const select = document.getElementById('stock-product-select');
    select.value = productId;
    handleStockProductChange();
}

async function populateStockProductsDropdown() {
    try {
        const res = await API.get('/products', { limit: 100, sortBy: 'name', order: 'asc' });
        cachedProductsList = res.data;
        const select = document.getElementById('stock-product-select');
        select.innerHTML = '<option value="">-- Choose a Product --</option>' + 
            res.data.map(p => `<option value="${p.id}" data-stock="${p.current_stock}" data-threshold="${p.min_stock_threshold}">${escapeHtml(p.name)} (${escapeHtml(p.sku)}) [Stock: ${p.current_stock}]</option>`).join('');
    } catch (err) {
        console.error('Failed to populate stock products:', err);
    }
}

function handleStockProductChange() {
    const select = document.getElementById('stock-product-select');
    const option = select.options[select.selectedIndex];
    const preview = document.getElementById('stock-product-preview');

    if (option && option.value) {
        document.getElementById('preview-current-stock').textContent = option.dataset.stock;
        document.getElementById('preview-threshold').textContent = option.dataset.threshold;
        preview.style.display = 'flex';
    } else {
        preview.style.display = 'none';
    }
}

async function handleStockSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('stock-movement-type').value;
    const productId = parseInt(document.getElementById('stock-product-select').value, 10);
    const reason = document.getElementById('stock-reason').value.trim();
    const ref = document.getElementById('stock-ref').value.trim();

    if (!productId) {
        showToast('Please select a product', 'warning');
        return;
    }

    try {
        let res;
        if (type === 'STOCK_IN') {
            const quantity = parseInt(document.getElementById('stock-quantity').value, 10);
            res = await API.post('/inventory/stock-in', {
                product_id: productId,
                quantity,
                reason,
                reference_number: ref
            });
        } else if (type === 'STOCK_OUT') {
            const quantity = parseInt(document.getElementById('stock-quantity').value, 10);
            res = await API.post('/inventory/stock-out', {
                product_id: productId,
                quantity,
                reason,
                reference_number: ref
            });
        } else {
            const newStock = parseInt(document.getElementById('stock-target').value, 10);
            res = await API.post('/inventory/adjustments', {
                product_id: productId,
                new_stock: newStock,
                reason,
                reference_number: ref
            });
        }

        if (res.success) {
            closeModal('modal-stock');
            showToast(res.message, 'success');
            loadMovements(1);
            loadProducts();
            loadDashboard();
            loadLowStock();
        }
    } catch (err) {
        showToast(err.message || 'Operation failed', 'error');
    }
}
