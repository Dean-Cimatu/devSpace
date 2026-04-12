// home page setup
document.addEventListener('DOMContentLoaded', async function () {
    await updateUserStatus();
    updateNavigationState();
});

async function updateUserStatus() {
    if (!auth.isLoggedIn()) return;

    // Fetch full profile from server so we get gamesPlayed, highScore, createdAt
    const user = await auth.fetchMe();
    if (!user) return;

    const mainContent = document.querySelector('.main-content');
    const mainMenu    = document.querySelector('#mainMenu');
    if (!mainContent || !mainMenu) return;

    const layoutContainer = document.createElement('div');
    layoutContainer.className = 'game-layout';
    layoutContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 30px;
        width: 100%;
        max-width: 1000px;
        margin: 20px auto;
    `;

    const welcomePanel = document.createElement('div');
    welcomePanel.className = 'welcome-panel';
    welcomePanel.innerHTML = `
        <div class="welcome-header">
            <h2>Welcome Back!</h2>
            <h3>${user.username}</h3>
        </div>
        <div class="player-stats">
            <div class="stat-item">
                <span class="stat-label">Games Played:</span>
                <span class="stat-value">${user.gamesPlayed}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">High Score:</span>
                <span class="stat-value">${user.highScore.toLocaleString()}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Member Since:</span>
                <span class="stat-value">${new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
        <div class="user-actions">
            <button onclick="logout()" class="logout-btn">Logout</button>
        </div>
    `;

    mainMenu.style.flexShrink = '0';

    const title = mainContent.querySelector('#title');
    if (title) {
        mainMenu.remove();
        layoutContainer.appendChild(mainMenu);
        layoutContainer.appendChild(welcomePanel);
        title.insertAdjacentElement('afterend', layoutContainer);
    }
}

function logout() {
    auth.logout();
    window.location.reload();
}

window.logout = logout;
