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

    injectLeaderboardStyles();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function injectLeaderboardStyles() {
    if (document.getElementById('leaderboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'leaderboard-styles';
    style.textContent = `
        #leaderboard { max-width: 650px; margin: 0 auto; }
        .leaderboard-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Pickyside', monospace;
            background: rgba(0,0,0,0.7);
            border-radius: 10px;
            overflow: hidden;
        }
        .leaderboard-table th {
            background: rgba(128,0,0,0.85);
            color: gold;
            padding: 14px 12px;
            text-align: center;
            border-bottom: 2px solid gold;
            font-size: 0.95em;
        }
        .leaderboard-table td {
            padding: 11px 12px;
            text-align: center;
            color: white;
            border-bottom: 1px solid rgba(255,215,0,0.25);
            font-size: 0.9em;
        }
        .leaderboard-table tr:hover { background: rgba(255,215,0,0.08); }
        .leaderboard-table .top-three { background: rgba(255,215,0,0.12); }
        .leaderboard-table .rank { font-weight: bold; font-size: 1.1em; }
        .leaderboard-table .rank.top { font-size: 1.3em; }
        .leaderboard-table .username { font-weight: bold; }
        .leaderboard-table .score { color: #90EE90; font-weight: bold; }
        .leaderboard-table .wave { color: #88ccff; }
        .leaderboard-table .date { color: rgba(255,255,255,0.55); font-size: 0.8em; }
    `;
    document.head.appendChild(style);
}
