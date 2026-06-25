document.addEventListener('DOMContentLoaded', async () => {
    // Load Sidebar if available
    if (typeof window.loadSharedSidebar === 'function') {
        await window.loadSharedSidebar();
    }

    const leaderboardBody = document.getElementById('leaderboard-body');
    const scopeFilter = document.getElementById('scope-filter');
    const periodFilter = document.getElementById('period-filter');
    const categoryFilter = document.getElementById('category-filter');
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdatedEl = document.getElementById('last-updated');
    let eventSource = null;
    let isAutoSwitching = false; 

    // --- 1. PROFILE SYNC ---
    async function syncUserProfile() {
        try {
            const data = await window.apiFetch('/users/profile');
            if (data && data.success && data.user) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
        } catch (e) {
            console.log("Profile sync skipped");
        }
    }

    await syncUserProfile(); 

    // --- 2. STREAM LOGIC ---
    function startStream() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = window.getRedirectUrl ? window.getRedirectUrl('/frontend/auth/login.html') : '/frontend/auth/login.html';
            return;
        }

        if (eventSource) {
            eventSource.close();
        }

        const scope = scopeFilter.value;
        const period = periodFilter.value;
        const category = categoryFilter ? categoryFilter.value : 'all';
        const baseUrl = window.API_BASE || 'https://osianoffical-hfp9.vercel.app/api'; 
        
        const url = `${baseUrl}/leaderboard/stream?access_token=${token}&scope=${scope}&period=${period}&category=${category}&limit=50`;

        // Loading UI
        leaderboardBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">
                    <div class="loading-spinner" style="width:30px; height:30px; margin:0 auto 10px;"></div>
                    Connecting to live leaderboard...
                </td>
            </tr>`;

        eventSource = new EventSource(url);

        eventSource.onopen = () => {
            console.log(`Leaderboard stream connected (${scope}).`);
        };

        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'leaderboard') {
                    renderLeaderboard(data.leaderboard);
                    updateTimestamp();
                } else if (data.type === 'error') {
                    handleStreamError(data.message);
                }
            } catch (e) {
                console.error('Data parsing error', e);
            }
        };

        eventSource.onerror = function(err) {
            if (eventSource.readyState !== 2) {
                eventSource.close();
                // Silent retry or simple message
                leaderboardBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding: 20px; color: #ff6b6b;">
                            <i class='bx bx-wifi-off' style="font-size: 2rem;"></i><br>
                            Connection lost. <button onclick="location.reload()" class="btn-action">Retry</button>
                        </td>
                    </tr>`;
            }
        };
    }

    // --- 3. AUTO-FIX FOR "DEPARTMENT NOT FOUND" ---
    function handleStreamError(msg) {
        eventSource.close();
        
        // CRITICAL FIX: If backend says "no_department", automatically switch to Global.
        // This bypasses the error screen entirely.
        if (msg === 'no_department') {
            if (scopeFilter.value === 'department') {
                console.warn("Department scope rejected (Stale Token). Switching to Global.");
                
                // 1. Force dropdown to Global
                scopeFilter.value = 'global';
                
                // 2. Notify user gently
                if (window.showToast) {
                    window.showToast('Department sync pending. Switched to Global view.', 'info');
                }

                // 3. Restart stream immediately
                startStream(); 
                return;
            }
        }

        let html = '';
        if (msg === 'auth_required') {
            html = `<div class="error-message-container">Authentication required. <a href="../auth/login.html">Login</a></div>`;
        } else {
            html = `<div class="error-message-container">Error loading data: ${msg}</div>`;
        }

        leaderboardBody.innerHTML = `<tr><td colspan="5" style="padding:0;">${html}</td></tr>`;
    }

    window.logoutAndRefresh = function() {
        localStorage.clear();
        window.location.href = window.getRedirectUrl ? window.getRedirectUrl('/frontend/auth/login.html') : '/frontend/auth/login.html';
    };

    function renderLeaderboard(entries) {
        leaderboardBody.innerHTML = '';
        if (!entries || entries.length === 0) {
            leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">No data available for this period.</td></tr>';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

        entries.forEach(entry => {
            const tr = document.createElement('tr');
            
            if (entry.user.id === currentUser.id || entry.user.id === currentUser._id) {
                tr.classList.add('highlight-row');
            }

            const avatarSrc = entry.user.avatar && entry.user.avatar.length > 10 
                ? entry.user.avatar 
                : 'https://i.ibb.co/jP9JWBBy/diljj.png';
            
            let rankClass = '';
            let rankDisplay = `#${entry.rank}`;
            if (entry.rank === 1) { rankClass = 'rank-1'; rankDisplay = "<i class='bx bxs-trophy'></i>"; }
            else if (entry.rank === 2) { rankClass = 'rank-2'; rankDisplay = "<i class='bx bxs-medal'></i>"; }
            else if (entry.rank === 3) { rankClass = 'rank-3'; rankDisplay = "<i class='bx bxs-medal'></i>"; }

            tr.innerHTML = `
                <td class="rank-cell ${rankClass}">${rankDisplay}</td>
                <td>
                    <div class="user-info">
                        <img src="${avatarSrc}" alt="" class="user-avatar-leaderboard" onerror="this.src='https://i.ibb.co/jP9JWBBy/diljj.png'">
                        <div>
                            <span class="user-name">${entry.user.name || 'User'}</span>
                            ${entry.user.department ? `<span style="font-size:0.8rem; color:var(--text-muted);">${entry.user.department}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td style="font-weight: bold; color: var(--osian-cyan); font-size: 1.1rem;">${Math.round(entry.compositeScore || 0)}</td>
                <td>${Math.round(entry.avgScore || 0)}%</td>
                <td>${Math.round(entry.accuracy || 0)}%</td>
            `;
            leaderboardBody.appendChild(tr);
        });
    }

    function updateTimestamp() {
        const now = new Date();
        if(lastUpdatedEl) lastUpdatedEl.textContent = now.toLocaleTimeString();
    }

    if (scopeFilter) scopeFilter.addEventListener('change', startStream);
    if (periodFilter) periodFilter.addEventListener('change', startStream);
    if (categoryFilter) categoryFilter.addEventListener('change', startStream);
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('spinning');
            startStream();
            setTimeout(() => refreshBtn.classList.remove('spinning'), 1000);
        });
    }

    window.addEventListener('beforeunload', () => {
        if (eventSource) eventSource.close();
    });

    startStream();
});
