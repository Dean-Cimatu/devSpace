// hide login/register when logged in
document.addEventListener('DOMContentLoaded', function() {
    updateNavigationState();
});

function updateNavigationState() {
    const topNav = document.getElementById('topNav');
    if (!topNav) return;
    
    if (auth.isLoggedIn()) {
        const registerBtn = topNav.querySelector('a[href*="register"]');
        const loginBtn = topNav.querySelector('a[href*="login"]');
        
        if (registerBtn) registerBtn.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'none';
    }
}
