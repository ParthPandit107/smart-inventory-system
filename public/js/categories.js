/**
 * Category Management Frontend Controller
 */

async function loadCategories() {
    try {
        const res = await API.get('/categories?includeInactive=true');
        if (!res.success) return;

        const tbody = document.getElementById('tbody-categories');
        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No categories created yet.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data.map(c => `
            <tr style="${!c.is_active ? 'opacity: 0.6;' : ''}">
                <td>${c.id}</td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td class="text-muted text-sm">${escapeHtml(c.description || '—')}</td>
                <td><span class="badge badge-primary">${c.product_count} products</span></td>
                <td>${Number(c.total_units || 0).toLocaleString()}</td>
                <td>$${parseFloat(c.total_valuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>
                    <span class="badge ${c.is_active ? 'badge-success' : 'badge-secondary'}">
                        ${c.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-sm btn-outline" onclick="openEditCategoryModal(${c.id}, '${escapeHtml(c.name)}', '${escapeHtml(c.description || '')}')">✏️ Edit</button>
                        <button class="btn btn-sm ${c.is_active ? 'btn-outline' : 'btn-secondary'}" onclick="toggleCategoryActive(${c.id}, ${c.is_active ? 0 : 1})">
                            ${c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Error loading categories', 'error');
    }
}

function openCategoryModal() {
    document.getElementById('form-category').reset();
    document.getElementById('cat-id').value = '';
    document.getElementById('modal-category-title').textContent = 'Add Category';
    openModal('modal-category');
}

function openEditCategoryModal(id, name, desc) {
    document.getElementById('cat-id').value = id;
    document.getElementById('cat-name').value = name;
    document.getElementById('cat-desc').value = desc;
    document.getElementById('modal-category-title').textContent = `Edit Category: ${name}`;
    openModal('modal-category');
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const isEdit = Boolean(id);

    const payload = {
        name: document.getElementById('cat-name').value.trim(),
        description: document.getElementById('cat-desc').value.trim()
    };

    try {
        let res;
        if (isEdit) {
            res = await API.put(`/categories/${id}`, payload);
        } else {
            res = await API.post('/categories', payload);
        }

        if (res.success) {
            closeModal('modal-category');
            showToast(`Category '${res.data.name}' saved successfully`, 'success');
            loadCategories();
            loadDashboard();
            populateCategoryAndSupplierDropdowns();
        }
    } catch (err) {
        showToast(err.message || 'Failed to save category', 'error');
    }
}

async function toggleCategoryActive(id, newStatus) {
    try {
        const res = await API.patch(`/categories/${id}/status`, { is_active: newStatus });
        if (res.success) {
            showToast(res.message, 'success');
            loadCategories();
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Failed to update category status', 'error');
    }
}
