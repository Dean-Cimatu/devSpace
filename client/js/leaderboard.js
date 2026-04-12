document.addEventListener('DOMContentLoaded', loadLeaderboard);

async function loadLeaderboard() {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    // Inject placeholder while fetching
    const wrapper = document.createElement('div');
    wrapper.id = 'leaderboard';
    wrapper.innerHTML = '<p style="text-align:center;color:gold;font-family:Pickyside,monospace;">Loading scores...</p>';
    const h1 = mainContent.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', wrapper);

    let scores = [];
    try {
        const res = await fetch('/api/scores');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        scores = await res.json();
    } catch (err) {
        wrapper.innerHTML = `<p style="text-align:center;color:#ff6666;font-family:Pickyside,monospace;">
            Could not load scores — make sure the server is running.<br>
            <small style="opacity:0.7">${err.message}</small>
        </p>`;
        return;
    }

    if (!Array.isArray(scores) || scores.length === 0) {
        wrapper.innerHTML = `<p style="text-align:center;color:gold;font-family:Pickyside,monospace;">
            No scores yet — be the first to play!
        </p>`;
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const rows = scores.map((entry, i) => {
        const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : '—';
        const rankCell = i < 3
            ? `<td class="rank top">${medals[i]}</td>`
            : `<td class="rank">${i + 1}</td>`;
        return `<tr class="${i < 3 ? 'top-three' : ''}">
            ${rankCell}
            <td class="username">${escapeHtml(entry.name)}</td>
            <td class="score">${entry.score.toLocaleString()}</td>
            <td class="wave">Wave ${entry.wave}</td>
            <td class="date">${dateStr}</td>
        </tr>`;
    }).join('');

    wrapper.innerHTML = `
        <table class="leaderboard-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Score</th>
                    <th>Wave</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;

}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
