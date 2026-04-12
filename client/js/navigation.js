document.addEventListener('DOMContentLoaded', function() {
    updateNavigationState();
});

function updateNavigationState() {
    const topNav = document.getElementById('topNav');
    if (!topNav) return;

    if (auth.isLoggedIn()) {
        const user = auth.getCurrentUser();

        // Hide auth links
        const registerLink = topNav.querySelector('a[href*="register"]');
        const loginLink    = topNav.querySelector('a[href*="login"]');
        if (registerLink) registerLink.style.display = 'none';
        if (loginLink)    loginLink.style.display    = 'none';

        // Inject user badge on the right if not already there
        if (!topNav.querySelector('.nav-user')) {
            const spacer = document.createElement('span');
            spacer.style.flex = '1';
            topNav.appendChild(spacer);

            const badge = document.createElement('div');
            badge.className = 'nav-user';
            const username = user?.username || 'Player';
            badge.innerHTML = `
                <span class="nav-username">${_escapeHtml(username)}</span>
                <button class="nav-logout-btn" onclick="auth.logout();window.location.reload()">Logout</button>
            `;
            topNav.appendChild(badge);
        }
    }
}

function _escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
