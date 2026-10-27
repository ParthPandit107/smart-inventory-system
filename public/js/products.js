/**
 * Product Management Frontend Controller
 */

let currentProductPage = 1;
let currentProductSort = 'created_at';
let currentProductOrder = 'desc';

async function loadProducts(page = currentProductPage) {
    currentProductPage = page;
    const search = document.getElementById('product-search').value.trim();
    const category_id = document.getElementById('product-cat-filter').value;
    const stock_status = document.getElementById('product-stock-filter').value;

    try {
        const res = await API.get('/products', {
            page: currentProductPage,
            limit: 10,
            search,
            category_id,
            stock_status,
            sortBy: currentProductSort,
            order: currentProductOrder
        });

        if (!res.success) return;

        const tbody = document.getElementById('tbody-products');
        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No matching products found.</td></tr>';
            document.getElementById('product-pagination-info').textContent = 'Showing 0 of 0 products';
            document.getElementById('product-pagination-btns').innerHTML = '';
            return;
        }

        tbody.innerHTML = res.data.map(p => {
            let statusBadge = '';
            if (p.current_stock === 0) {
                statusBadge = '<span class="badge badge-danger">Out of Stock</span>';
            } else if (p.current_stock <= p.min_stock_threshold) {
                statusBadge = '<span class="badge badge-warning">Low Stock</span>';
            } else {
                statusBadge = '<span class="badge badge-success">In Stock</span>';
            }

            return `
                <tr style="${!p.is_active ? 'opacity: 0.6;' : ''}">
                    <td><span class="sku-badge">${escapeHtml(p.sku)}</span></td>
                    <td>
                        <strong style="color: var(--text-main);">${escapeHtml(p.name)}</strong>
                        ${!p.is_active ? ' <span class="badge badge-secondary">Deactivated</span>' : ''}
                    </td>
                    <td><span class="badge badge-secondary">${escapeHtml(p.category_name)}</span></td>
                    <td class="text-muted text-sm">${escapeHtml(p.supplier_name)}</td>
                    <td>$${parseFloat(p.unit_cost).toFixed(2)}</td>
                    <td>$${parseFloat(p.selling_price).toFixed(2)}</td>
                    <td>
                        <strong style="font-size: 14px;">${p.current_stock}</strong>
                        <span class="text-muted text-sm">(min ${p.min_stock_threshold})</span>
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-outline" title="Record Movement" onclick="openStockModalForProduct(${p.id}, '${escapeHtml(p.name)}')">🔄 Stock</button>
                            <button class="btn btn-sm btn-outline" title="Edit Product" onclick="openEditProductModal(${p.id})">✏️ Edit</button>
                            <button class="btn btn-sm ${p.is_active ? 'btn-outline' : 'btn-secondary'}" title="Toggle Active Status" onclick="toggleProductActive(${p.id}, ${p.is_active ? 0 : 1})">
                                ${p.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                            </button>
                            <button class="btn btn-sm btn-danger" title="Delete Product" onclick="deleteProductPrompt(${p.id}, '${escapeHtml(p.name)}')">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Pagination metadata
        const meta = res.meta;
        const start = (meta.currentPage - 1) * meta.limit + 1;
        const end = Math.min(meta.currentPage * meta.limit, meta.totalItems);
        document.getElementById('product-pagination-info').textContent = `Showing ${start}-${end} of ${meta.totalItems} products`;

        // Pagination buttons
        let btns = '';
        if (meta.hasPrevPage) {
            btns += `<button class="btn btn-sm btn-outline" onclick="loadProducts(${meta.currentPage - 1})">&laquo; Prev</button>`;
        }
        btns += `<span class="btn btn-sm btn-outline" style="pointer-events: none;">Page ${meta.currentPage} of ${meta.totalPages}</span>`;
        if (meta.hasNextPage) {
            btns += `<button class="btn btn-sm btn-outline" onclick="loadProducts(${meta.currentPage + 1})">Next &raquo;</button>`;
        }
        document.getElementById('product-pagination-btns').innerHTML = btns;
    } catch (err) {
        console.error('Error loading products:', err);
        showToast('Failed to load products list', 'error');
    }
}

function sortProducts(col) {
    if (currentProductSort === col) {
        currentProductOrder = currentProductOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentProductSort = col;
        currentProductOrder = 'asc';
    }
    loadProducts(1);
}

async function openProductModal() {
    document.getElementById('form-product').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-product-title').textContent = 'Add New Product';
    document.getElementById('prod-sku').disabled = false;
    document.getElementById('group-initial-stock').style.display = 'block';

    await populateCategoryAndSupplierDropdowns();
    openModal('modal-product');
}

async function openEditProductModal(id) {
    try {
        const res = await API.get(`/products/${id}`);
        if (!res.success) return;

        const p = res.data;
        document.getElementById('modal-product-title').textContent = `Edit Product: ${p.sku}`;
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-sku').value = p.sku;
        document.getElementById('prod-sku').disabled = true; // SKU cannot be changed
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-desc').value = p.description || '';
        document.getElementById('prod-unit-cost').value = p.unit_cost;
        document.getElementById('prod-selling-price').value = p.selling_price;
        document.getElementById('prod-min-threshold').value = p.min_stock_threshold;
        document.getElementById('group-initial-stock').style.display = 'none'; // Stock must change through inventory movements

        await populateCategoryAndSupplierDropdowns();
        document.getElementById('prod-category').value = p.category_id;
        document.getElementById('prod-supplier').value = p.supplier_id;

        openModal('modal-product');
    } catch (err) {
        showToast('Error loading product details', 'error');
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const isEdit = Boolean(id);

    const payload = {
        name: document.getElementById('prod-name').value.trim(),
        description: document.getElementById('prod-desc').value.trim(),
        category_id: parseInt(document.getElementById('prod-category').value, 10),
        supplier_id: parseInt(document.getElementById('prod-supplier').value, 10),
        unit_cost: parseFloat(document.getElementById('prod-unit-cost').value),
        selling_price: parseFloat(document.getElementById('prod-selling-price').value),
        min_stock_threshold: parseInt(document.getElementById('prod-min-threshold').value, 10)
    };

    if (!isEdit) {
        payload.sku = document.getElementById('prod-sku').value.trim().toUpperCase();
        payload.current_stock = parseInt(document.getElementById('prod-initial-stock').value, 10) || 0;
    }

    try {
        let res;
        if (isEdit) {
            res = await API.put(`/products/${id}`, payload);
        } else {
            res = await API.post('/products', payload);
        }

        if (res.success) {
            closeModal('modal-product');
            showToast(`Product '${res.data.name}' saved successfully`, 'success');
            loadProducts(currentProductPage);
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Failed to save product', 'error');
    }
}

async function toggleProductActive(id, newStatus) {
    try {
        const res = await API.patch(`/products/${id}/status`, { is_active: newStatus });
        if (res.success) {
            showToast(res.message, 'success');
            loadProducts(currentProductPage);
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Failed to change status', 'error');
    }
}

async function deleteProductPrompt(id, name) {
    if (!confirm(`Are you sure you want to delete product '${name}'?\n\nNote: If this product has historical stock movements or purchase order records, the system will prevent deletion to protect audit integrity and advise deactivation instead.`)) {
        return;
    }

    try {
        const res = await API.delete(`/products/${id}`);
        if (res.success) {
            showToast(res.message, 'success');
            loadProducts(currentProductPage);
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message, 'warning');
    }
}

async function populateCategoryAndSupplierDropdowns() {
    try {
        const [catsRes, supsRes] = await Promise.all([
            API.get('/categories'),
            API.get('/suppliers')
        ]);

        const catSelect = document.getElementById('prod-category');
        catSelect.innerHTML = catsRes.data.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

        const supSelect = document.getElementById('prod-supplier');
        supSelect.innerHTML = supsRes.data.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

        // Also update filter dropdown
        const filterCat = document.getElementById('product-cat-filter');
        const currentSelected = filterCat.value;
        filterCat.innerHTML = '<option value="">All Categories</option>' + 
            catsRes.data.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        filterCat.value = currentSelected;
    } catch (err) {
        console.error('Failed to load categories/suppliers dropdown:', err);
    }
}
