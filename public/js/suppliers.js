/**
 * Supplier Management Frontend Controller
 */

async function loadSuppliers() {
    const search = document.getElementById('supplier-search').value.trim();

    try {
        const res = await API.get('/suppliers', { search, includeInactive: true });
        if (!res.success) return;

        const tbody = document.getElementById('tbody-suppliers');
        if (!res.data.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No matching suppliers found.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data.map(s => `
            <tr style="${!s.is_active ? 'opacity: 0.6;' : ''}">
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.contact_person || '—')}</td>
                <td><a href="mailto:${escapeHtml(s.email)}" class="btn-link">${escapeHtml(s.email)}</a></td>
                <td class="text-muted text-sm">${escapeHtml(s.phone || '—')}</td>
                <td class="text-muted text-sm">${escapeHtml(s.address || '—')}</td>
                <td><span class="badge badge-primary">${s.product_count} products</span></td>
                <td>
                    <span class="badge ${s.is_active ? 'badge-success' : 'badge-secondary'}">
                        ${s.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-sm btn-outline" onclick="openEditSupplierModal(${s.id})">✏️ Edit</button>
                        <button class="btn btn-sm ${s.is_active ? 'btn-outline' : 'btn-secondary'}" onclick="toggleSupplierActive(${s.id}, ${s.is_active ? 0 : 1})">
                            ${s.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Error loading suppliers', 'error');
    }
}

function openSupplierModal() {
    document.getElementById('form-supplier').reset();
    document.getElementById('sup-id').value = '';
    document.getElementById('modal-supplier-title').textContent = 'Add Supplier';
    openModal('modal-supplier');
}

async function openEditSupplierModal(id) {
    try {
        const res = await API.get(`/suppliers/${id}`);
        if (!res.success) return;

        const s = res.data;
        document.getElementById('sup-id').value = s.id;
        document.getElementById('sup-name').value = s.name;
        document.getElementById('sup-contact').value = s.contact_person || '';
        document.getElementById('sup-email').value = s.email;
        document.getElementById('sup-phone').value = s.phone || '';
        document.getElementById('sup-address').value = s.address || '';
        document.getElementById('modal-supplier-title').textContent = `Edit Supplier: ${s.name}`;

        openModal('modal-supplier');
    } catch (err) {
        showToast('Error loading supplier details', 'error');
    }
}

async function handleSupplierSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sup-id').value;
    const isEdit = Boolean(id);

    const payload = {
        name: document.getElementById('sup-name').value.trim(),
        contact_person: document.getElementById('sup-contact').value.trim(),
        email: document.getElementById('sup-email').value.trim(),
        phone: document.getElementById('sup-phone').value.trim(),
        address: document.getElementById('sup-address').value.trim()
    };

    try {
        let res;
        if (isEdit) {
            res = await API.put(`/suppliers/${id}`, payload);
        } else {
            res = await API.post('/suppliers', payload);
        }

        if (res.success) {
            closeModal('modal-supplier');
            showToast(`Supplier '${res.data.name}' saved successfully`, 'success');
            loadSuppliers();
            loadDashboard();
            populateCategoryAndSupplierDropdowns();
        }
    } catch (err) {
        showToast(err.message || 'Failed to save supplier', 'error');
    }
}

async function toggleSupplierActive(id, newStatus) {
    try {
        const res = await API.patch(`/suppliers/${id}/status`, { is_active: newStatus });
        if (res.success) {
            showToast(res.message, 'success');
            loadSuppliers();
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Failed to update supplier status', 'error');
    }
}
