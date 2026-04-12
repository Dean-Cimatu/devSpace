// API-backed authentication helper
// Exposes window.auth for use by both regular scripts and ES module game scripts.

(function () {
    const TOKEN_KEY = 'cf_token';

    function _decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        } catch {
            return null;
        }
    }

    function _isExpired(payload) {
        if (!payload || !payload.exp) return true;
        return Date.now() / 1000 > payload.exp;
    }

    const auth = {
        getToken() {
            return localStorage.getItem(TOKEN_KEY);
        },

        _saveToken(token) {
            localStorage.setItem(TOKEN_KEY, token);
        },

        clearToken() {
            localStorage.removeItem(TOKEN_KEY);
        },

        isLoggedIn() {
            const token = this.getToken();
            if (!token) return false;
            const payload = _decodeToken(token);
            if (_isExpired(payload)) { this.clearToken(); return false; }
            return true;
        },

        // Returns { userId, username } from the JWT payload synchronously — no network call
        getCurrentUser() {
            const token = this.getToken();
            if (!token) return null;
            const payload = _decodeToken(token);
            if (_isExpired(payload)) { this.clearToken(); return null; }
            return payload;
        },

        // POST /api/auth/login — returns { success, message }
        async login(username, password) {
            try {
                const res = await fetch('/api/auth/login', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (!res.ok) return { success: false, message: data.error || 'Login failed.' };
                this._saveToken(data.token);
                return { success: true, message: `Welcome back, ${data.username}!` };
            } catch {
                return { success: false, message: 'Server unreachable. Please try again.' };
            }
        },

        // POST /api/auth/register — returns { success, message }
        async register(userData) {
            try {
                const res = await fetch('/api/auth/register', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(userData)
                });
                const data = await res.json();
                if (!res.ok) return { success: false, message: data.error || 'Registration failed.' };
                this._saveToken(data.token);
                return { success: true, message: 'Registration successful!' };
            } catch {
                return { success: false, message: 'Server unreachable. Please try again.' };
            }
        },

        logout() {
            this.clearToken();
        },

        // GET /api/auth/me — returns full user profile from server
        async fetchMe() {
            const token = this.getToken();
            if (!token) return null;
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) return null;
                return await res.json();
            } catch {
                return null;
            }
        }
    };

    window.auth = auth;
})();
