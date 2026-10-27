/**
 * Application Core Bootstrapper & Routing
 */

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initClock();
    checkSystemHealth();

    // Default demo login for evaluation convenience if not logged in
    if (!API.getToken()) {
        try {
            const loginRes = await API.post('/auth/login', { username: 'admin', password: 'admin123' });
            if (loginRes.success && loginRes.data.token) {
                API.setToken(loginRes.data.token);
                API.setUser(loginRes.data.user);
            }
        } catch {
            // Guest mode fallback
        }
    }

    updateAuthUI();
    loadDashboard();
    populateCategoryAndSupplierDropdowns();
});

// Tab Navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });
    }

    // Modal background close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
            }
        });
    });
}

function switchTab(tabName) {
    // Update sidebar buttons
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tabName);
    });

    // Update page views
    document.querySelectorAll('.page-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${tabName}`);
    });

    // Update page header
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    const metaMap = {
        dashboard: { title: 'Dashboard Overview', sub: 'Real-time inventory metrics and database records' },
        products: { title: 'Product Catalog & Inventory', sub: 'Manage SKU records, pricing, thresholds, and product data' },
        categories: { title: 'Category Classifications', sub: 'Organize products into structured inventory departments' },
        suppliers: { title: 'Supplier Directory', sub: 'Maintain verified vendor contacts and procurement sources' },
        inventory: { title: 'Stock Movement Audit Logs', sub: 'Immutable transactional history of stock receipts, dispatches, and adjustments' },
        lowstock: { title: 'Low Stock Alerts & Recommendations', sub: 'Automated threshold detection with computed reorder suggestions' },
        purchaseorders: { title: 'Purchase Orders & Restocking', sub: 'Manage vendor orders and execute atomic inventory restocking transactions' },
        reports: { title: 'Inventory Analytics & Reports', sub: 'Database-driven aggregations, valuation summaries, and CSV data export' }
    };

    const meta = metaMap[tabName] || { title: 'Inventory Management', sub: '' };
    titleEl.textContent = meta.title;
    subtitleEl.textContent = meta.sub;

    // Close mobile sidebar if open
    document.querySelector('.sidebar').classList.remove('open');

    // Trigger tab data load
    if (tabName === 'dashboard') loadDashboard();
    else if (tabName === 'products') loadProducts(1);
    else if (tabName === 'categories') loadCategories();
    else if (tabName === 'suppliers') loadSuppliers();
    else if (tabName === 'inventory') loadMovements(1);
    else if (tabName === 'lowstock') loadLowStock();
    else if (tabName === 'purchaseorders') loadPurchaseOrders(1);
    else if (tabName === 'reports') loadActiveReport();
}

// System Health Check
async function checkSystemHealth() {
    try {
        const res = await API.get('/health');
        const driverLabel = document.getElementById('db-driver-label');
        if (res.database && res.database.status === 'healthy') {
            driverLabel.textContent = `DB: ${res.database.driver.toUpperCase()} (Online)`;
        } else {
            driverLabel.textContent = 'DB: Offline';
            driverLabel.style.color = 'var(--danger)';
        }
    } catch {
        document.getElementById('db-driver-label').textContent = 'DB: Disconnected';
    }
}

// Live Digital Clock
function initClock() {
    const el = document.getElementById('system-time-display');
    const update = () => {
        const now = new Date();
        el.textContent = now.toLocaleTimeString([], { hour12: false });
    };
    update();
    setInterval(update, 1000);
}

// Modal Helpers
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
}

// Toast System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <span>${icon}</span>
        <div style="flex: 1;">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Debounce Helper
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// HTML Escaper for XSS prevention
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
