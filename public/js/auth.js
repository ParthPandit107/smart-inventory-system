/**
 * Authentication Module
 */

function updateAuthUI() {
    const user = API.getUser();
    const btnAuth = document.getElementById('btn-auth-action');
    const userName = document.getElementById('user-display-name');
    const userRole = document.getElementById('user-display-role');
    const userAvatar = document.getElementById('user-avatar-initials');

    if (user && API.getToken()) {
        userName.textContent = user.full_name || user.username;
        userRole.textContent = (user.role || 'STAFF').toUpperCase();
        userAvatar.textContent = (user.full_name || user.username).slice(0, 2).toUpperCase();

        if (user.role === 'admin') {
            userRole.className = 'user-role badge badge-primary';
        } else {
            userRole.className = 'user-role badge badge-secondary';
        }

        btnAuth.textContent = 'Logout';
        btnAuth.onclick = handleLogout;
    } else {
        userName.textContent = 'Demo Viewer';
        userRole.textContent = 'GUEST';
        userRole.className = 'user-role badge badge-secondary';
        userAvatar.textContent = 'DV';
        btnAuth.textContent = 'Sign In';
        btnAuth.onclick = () => openModal('modal-auth');
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;

    try {
        const res = await API.post('/auth/login', { username, password });
        if (res.success && res.data.token) {
            API.setToken(res.data.token);
            API.setUser(res.data.user);
            closeModal('modal-auth');
            updateAuthUI();
            showToast(`Welcome back, ${res.data.user.full_name}!`, 'success');
            // Refresh data
            loadDashboard();
        }
    } catch (err) {
        showToast(err.message || 'Authentication failed', 'error');
    }
}

function handleLogout() {
    API.setToken(null);
    API.setUser(null);
    updateAuthUI();
    showToast('You have been logged out.', 'info');
    loadDashboard();
}

function fillCredentials(user, pass) {
    document.getElementById('auth-username').value = user;
    document.getElementById('auth-password').value = pass;
}
