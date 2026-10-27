/**
 * API Client Module
 */

const API = {
    baseUrl: '/api',

    getToken() {
        return localStorage.getItem('sims_jwt_token') || '';
    },

    setToken(token) {
        if (token) {
            localStorage.setItem('sims_jwt_token', token);
        } else {
            localStorage.removeItem('sims_jwt_token');
        }
    },

    getUser() {
        const userJson = localStorage.getItem('sims_user');
        try {
            return userJson ? JSON.parse(userJson) : null;
        } catch {
            return null;
        }
    },

    setUser(user) {
        if (user) {
            localStorage.setItem('sims_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('sims_user');
        }
    },

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const contentType = response.headers.get('content-type');
            
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const message = (data && data.message) ? data.message : `HTTP Error ${response.status}`;
                const error = new Error(message);
                error.status = response.status;
                error.data = data;
                throw error;
            }

            return data;
        } catch (err) {
            throw err;
        }
    },

    get(endpoint, params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, val);
            }
        });
        const qs = query.toString();
        const fullPath = qs ? `${endpoint}?${qs}` : endpoint;
        return this.request(fullPath, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    patch(endpoint, body) {
        return this.request(endpoint, { method: 'PATCH', body });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};
