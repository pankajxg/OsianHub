/* =========================================================================
   OSIAN User Dashboard Script
   Handles: Stats, Search, Global Categories, Dept Quizzes, Real-time Updates
   ========================================================================= */

// 1. Global Auth & Constants
if (typeof window.checkAuth === 'function') {
    window.checkAuth();
}

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";

// 2. Main Execution
document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    let wizardState = { category: null, categoryName: '', field: null, level: null };
    let loadingAttempts = 0;
    const MAX_LOADING_ATTEMPTS = 2; 

    // --- Helpers ---
    function getValidImageUrl(path) {
        if (!path) return null;
        const s = String(path).trim();
        if (!s) return null;
        if (s.startsWith('data:') || s.startsWith('http')) return s;
        if (s.startsWith('/')) return s;
        return '/' + s;
    }

    function renderEmptyState(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="content-box" style="grid-column: 1 / -1; width: 100%;">
                <p class="empty-text">${message}</p>
            </div>
        `;
    }

    // --- Initialization Flow ---
    if (window.location.pathname.includes('dashboard.html') || window.location.pathname.endsWith('/user/')) {
        initDashboard();
    } else {
        const sidebarContainer = document.getElementById('sidebar-container');
        const hasContent = sidebarContainer && (sidebarContainer.querySelector('.sidebar-menu') || sidebarContainer.querySelector('nav'));
        if (sidebarContainer && !hasContent) {
            loadSidebar();
        }
    }

    initDashboardSearch();

    // --- Core Dashboard Init ---
    async function initDashboard() {
        try {
            // 1. Sidebar (Prioritize Premium if exists, else shared)
            if (typeof initPremiumSidebar === 'function' && document.querySelector('.premium-layout')) {
                initPremiumSidebar();
            } else if (typeof window.loadSharedSidebar === 'function') {
                await window.loadSharedSidebar();
            } else {
                await loadSidebar();
            }
            
            // 2. Data Loading (Initial Fetch)
            await fetchStats(true); // Force update immediately
            await fetchDepartmentQuizzes();
            await initGlobalWizard();
            fetchUnreadNotificationsCount();
            
            // 3. Animations
            if (window.AOS && typeof window.AOS.init === 'function') {
                window.AOS.init({ duration: 800, offset: 100, easing: 'ease-out-quad', once: true });
            }
            
            // 4. Polling & Real-time Listeners
            startPolling();
            setupRealTimeListeners();

        } catch (e) {
            console.error('Error initializing dashboard:', e);
            if (window.showToast) window.showToast('Failed to load dashboard data', 'error');
        }
    }

    function startPolling() {
        // Poll every 10 seconds for fresher data
        setInterval(() => {
            fetchStats(true);
            fetchUnreadNotificationsCount();
        }, 10000); 
    }

    function setupRealTimeListeners() {
        // 1. Tab Visibility (User switches tabs)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === 'visible') {
                console.log("Dashboard visible: Refreshing stats...");
                fetchStats(true);
                fetchUnreadNotificationsCount();
            }
        });

        // 2. Window Focus (User clicks back into window)
        window.addEventListener("focus", () => {
            console.log("Window focused: Refreshing stats...");
            fetchStats(true);
        });

        // 3. Page Show (BF Cache Fix - Crucial for Back Button updates)
        window.addEventListener("pageshow", (event) => {
            // If the page was persisted in cache (back button used), force reload stats
            if (event.persisted || performance.navigation.type === 2) {
                console.log("Page restored from cache: Refreshing stats...");
                fetchStats(true);
            }
        });
    }

    // --- Sidebar Logic ---
    async function loadSidebar() {
        // Check for premium sidebar first
        if (document.getElementById('sidebar-container') && typeof initPremiumSidebar === 'function') {
             // Optional: condition to check if user is allowed premium sidebar
             initPremiumSidebar();
             return;
        }

        if (typeof window.loadSharedSidebar === 'function') {
            await window.loadSharedSidebar();
            return;
        }
        try {
            let html = '';
            const paths = [
                '/frontend/components/sidebar-user.html',
                '../components/sidebar-user.html',
                'components/sidebar-user.html'
            ];
            
            for (const path of paths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        html = await response.text();
                        break;
                    }
                } catch (err) { continue; }
            }
            
            if (!html) return;
            
            const container = document.getElementById('sidebar-container');
            if (container) {
                container.innerHTML = html;
                const currentPath = window.location.pathname;
                document.querySelectorAll('.sidebar-menu a').forEach(link => {
                    if (currentPath.includes(link.getAttribute('href'))) {
                        link.classList.add('active');
                    }
                });

                const menuBtn = document.getElementById('mobile-menu-btn');
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.getElementById('overlay');
                
                if (menuBtn && sidebar && overlay) {
                    menuBtn.addEventListener('click', () => {
                        sidebar.classList.add('active');
                        overlay.classList.add('active');
                    });
                    overlay.addEventListener('click', () => {
                        sidebar.classList.remove('active');
                        overlay.classList.remove('active');
                    });
                }
                await loadUserProfile();
            }
        } catch (err) {
            if (loadingAttempts < MAX_LOADING_ATTEMPTS) {
                loadingAttempts++;
                setTimeout(loadSidebar, 1000 * loadingAttempts);
            }
        }
    }

    async function loadUserProfile() {
        try {
            const avatarEl = document.getElementById('sidebar-avatar');
            const nameEl = document.getElementById('sidebar-name');
            const roleEl = document.getElementById('sidebar-role');
            
            if ((!user.id || !user.name) && localStorage.getItem('token')) {
                try {
                    let profile = null;
                    if (window.getUserProfile) {
                        profile = await window.getUserProfile({});
                    } else if (window.apiFetch) {
                        const response = await window.apiFetch('/users/profile');
                        profile = response && response.success && response.user ? response.user : null;
                    }
                    if (profile) {
                        Object.assign(user, profile);
                        localStorage.setItem('user', JSON.stringify(user));
                    }
                } catch (e) {}
            }
            
            if (nameEl) nameEl.textContent = user.name || 'User';
            if (roleEl) roleEl.textContent = (user.role || 'Student').charAt(0).toUpperCase() + (user.role || 'Student').slice(1);
            if (avatarEl) {
                const prof = user && user.profile ? user.profile : {};
                const avatarSrc = prof.avatar || user.avatar || user.profileImage || '';
                avatarEl.src = avatarSrc || 'https://i.ibb.co/jP9JWBBy/diljj.png';
                avatarEl.onerror = () => { avatarEl.src = 'https://i.ibb.co/jP9JWBBy/diljj.png'; };
            }
        } catch (e) {}
    }

    // --- Search Logic ---
    function initDashboardSearch() {
        const input = document.getElementById('dashboard-search-input');
        const results = document.getElementById('dashboard-search-results');
        if (!input || !results) return;

        let searching = false;

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = input.value.trim();
                if (!q) { hideDashboardSearchResults(); return; }
                if (searching) return;
                searching = true;
                handleDashboardSearch(q).finally(() => { searching = false; });
            } else if (e.key === 'Escape') {
                hideDashboardSearchResults();
            }
        });

        input.addEventListener('input', function (e) {
            if (!e.target.value.trim()) hideDashboardSearchResults();
        });

        document.addEventListener('click', function (e) {
            if (results.style.display === 'none' || !results.style.display) return;
            if (e.target === input || results.contains(e.target)) return;
            hideDashboardSearchResults();
        });
    }

    function hideDashboardSearchResults() {
        const r = document.getElementById('dashboard-search-results');
        if (r) r.style.display = 'none';
    }

    async function handleDashboardSearch(query) {
        const results = document.getElementById('dashboard-search-results');
        if (!results || typeof window.apiFetch !== 'function') return;

        results.style.display = 'block';
        results.innerHTML = '<div class="dashboard-search-empty">Searching...</div>';

        try {
            const encoded = encodeURIComponent(query);
            const [eventsRes, quizzesRes, catsRes] = await Promise.all([
                window.apiFetch('/events?q=' + encoded),
                window.apiFetch('/quizzes?type=Global'),
                window.apiFetch('/quizzes/categories?type=global')
            ]);

            const events = eventsRes?.success ? eventsRes.events : [];
            const quizzes = quizzesRes?.success ? quizzesRes.quizzes : [];
            const categories = catsRes?.success ? catsRes.categories : [];

            const qLower = query.toLowerCase();
            const filteredQuizzes = quizzes.filter(q => 
                (q.title || '').toLowerCase().includes(qLower) || (q.description || '').toLowerCase().includes(qLower)
            ).slice(0, 4);

            const filteredCategories = categories.filter(c => 
                (c.name || '').toLowerCase().includes(qLower)
            ).slice(0, 4);

            const topEvents = events.slice(0, 4);

            let html = '';

            if (filteredCategories.length) {
                html += '<div class="dashboard-search-section-title">Categories</div>';
                filteredCategories.forEach(cat => {
                    html += `<a class="dashboard-search-item" href="global-quizzes.html?category=${cat._id || cat.id}">
                        ${cat.name || 'Category'}<span>${cat.description || ''}</span>
                    </a>`;
                });
            }

            if (topEvents.length) {
                html += '<div class="dashboard-search-section-title">Events</div>';
                topEvents.forEach(ev => {
                    const dateText = ev.startDate ? new Date(ev.startDate).toLocaleDateString() : '';
                    html += `<a class="dashboard-search-item" href="event-details.html?id=${ev._id || ev.id}">
                        ${ev.title || 'Event'}<span>${dateText}</span>
                    </a>`;
                });
            }

            if (filteredQuizzes.length) {
                html += '<div class="dashboard-search-section-title">Topics & quizzes</div>';
                filteredQuizzes.forEach(quiz => {
                    html += `<a class="dashboard-search-item" href="#" onclick="openDashboardQuizDetails('${quiz._id || quiz.id}')">
                        ${quiz.title || 'Quiz'}<span>${quiz.difficulty || ''}</span>
                    </a>`;
                });
            }

            if (!html) html = '<div class="dashboard-search-empty">No matching topics or events found.</div>';
            results.innerHTML = html;
        } catch (e) {
            results.innerHTML = '<div class="dashboard-search-empty">Unable to search right now.</div>';
        }
    }

    // --- Stats Logic (FIXED) ---

    async function fetchStats(isUpdate = false) {
        try {
            // Add a random parameter to prevent browser caching of the API request
            const timestamp = new Date().getTime();
            const data = await window.apiFetch(`/users/stats?_t=${timestamp}`);
            
            if (data && data.success && data.stats) {
                updateStatsUI(data.stats);
                loadingAttempts = 0;
            } else if (!isUpdate) {
                // Only reset to 0 on initial load failure, not during background polling
                setDefaultStats();
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
            if (!isUpdate) setDefaultStats();
        }
    }

    function updateStatsUI(stats) {
        const updateVal = (id, val, suffix = '') => {
            const el = document.getElementById(id);
            if (!el) return;
            
            // Ensure value is treated as a number
            const numVal = parseFloat(val);
            const displayVal = isNaN(numVal) ? 0 : numVal;
            
            el.textContent = displayVal + suffix;
        };

        // Handle variations in API response keys safely
        const quizCount = stats.totalQuizzes || stats.quizzesCompleted || 0;
        const avgScore = stats.averageScore || stats.avgScore || 0;
        const totalScore = stats.totalScore || stats.score || 0;
        const certCount = stats.certificates || stats.certificatesEarned || 0;

        updateVal('stat-quizzes', quizCount);
        updateVal('stat-avg-score', avgScore, '%');
        updateVal('stat-total-score', totalScore);
        updateVal('stat-certificates', certCount);
    }

    function setDefaultStats() {
        ['stat-quizzes', 'stat-total-score', 'stat-certificates'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.textContent = '0';
        });
        const avg = document.getElementById('stat-avg-score');
        if(avg) avg.textContent = '0%';
    }

    async function fetchUnreadNotificationsCount() {
        try {
            const data = await window.apiFetch(`/notifications/unread-count?_t=${Date.now()}`);
            const badge = document.getElementById('notification-badge');
            if (badge) {
                if (data && data.count > 0) {
                    badge.textContent = data.count > 99 ? '99+' : data.count;
                    badge.style.display = 'block';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (e) {}
    }

    // --- Department Quizzes Logic ---

    async function fetchDepartmentQuizzes() {
        const deptSection = document.getElementById('department-quizzes-section');
        const deptContainer = document.getElementById('department-quizzes-grid');
        const deptBadge = document.getElementById('dept-code-badge');
        
        if (!deptContainer) return;
        
        deptContainer.innerHTML = '<div class="skeleton" style="height: 160px; grid-column: 1/-1;"></div>';

        try {
            if (user && user.linkedAdminCode && deptBadge) {
                deptBadge.textContent = `Code: ${user.linkedAdminCode}`;
            }

            const data = await window.apiFetch('/quizzes/department/me');
            
            if (data && data.success && data.quizzes && data.quizzes.length > 0) {
                if(deptSection) deptSection.style.display = 'block';
                renderQuizzesSection(data.quizzes, deptContainer, 'department');
            } else {
                if(deptSection) deptSection.style.display = 'block';
                renderEmptyState(deptContainer, 'No department quizzes assigned yet.');
            }
        } catch (error) {
            renderEmptyState(deptContainer, 'Unable to load department quizzes.');
        }
    }

    function renderQuizzesSection(quizzes, container, type = 'department') {
        if (!quizzes || quizzes.length === 0) {
            renderEmptyState(container, `No ${type} quizzes available yet.`);
            return;
        }
        
        const quizzesToShow = quizzes.slice(0, 6);
        
        container.innerHTML = quizzesToShow.map(quiz => {
            const isAttempted = quiz.attempted || quiz.completed;
            const clickAttr = isAttempted ? '' : `href="attempt-quiz.html?id=${quiz._id || quiz.id}"`;
            const cursorStyle = isAttempted ? 'cursor: not-allowed; opacity: 0.7;' : 'cursor: pointer;';
            
            const rawImage = quiz.coverImage || quiz.image;
            const safeCoverImage = getValidImageUrl(rawImage);
            
            return `
            <a ${clickAttr} class="quiz-card-entry" style="${cursorStyle} position: relative; text-decoration:none;">
                ${isAttempted ? `<span class="badge badge-success" style="position:absolute; top:10px; right:10px; z-index:2; font-size: 0.7rem;">Completed</span>` : ''}
                
                <div class="quiz-card-img-wrapper" style="height: 140px; overflow: hidden; position: relative; background: #1e293b; border-radius: 12px 12px 0 0;">
                    ${safeCoverImage 
                        ? `<img src="${safeCoverImage}" class="quiz-card-img" alt="${quiz.title}" loading="lazy" 
                                style="width: 100%; height: 100%; object-fit: cover;"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="fallback-icon" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">
                                <i class='bx ${isAttempted ? 'bx-check-circle' : 'bx-brain'}' style="font-size: 3rem; color: var(--osian-cyan);"></i>
                           </div>`
                        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                                <i class='bx ${isAttempted ? 'bx-check-circle' : 'bx-brain'}' style="font-size: 3rem; color: var(--osian-cyan);"></i>
                           </div>`
                    }
                </div>
                
                <div class="quiz-card-content">
                    <div class="quiz-card-title">${quiz.title || 'Untitled Quiz'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                        ${quiz.category && quiz.category.name ? `<span class="badge" style="background:rgba(255,255,255,0.1); font-size: 0.7rem;">${quiz.category.name}</span>` : ''}
                    </div>
                    <div class="quiz-card-meta">
                        <span><i class='bx bx-question-mark'></i> ${quiz.questions ? quiz.questions.length : 0} Qs</span>
                        <span><i class='bx bx-time'></i> ${quiz.duration || 10}m</span>
                    </div>
                </div>
            </a>`;
        }).join('');
    }

    // --- Global Quizzes Logic ---

    async function initGlobalWizard() {
        const container = document.querySelector('#global-categories-list .categories-grid');
        if (!container) return;
        
        container.innerHTML = '<div class="skeleton" style="height: 150px; grid-column: 1/-1;"></div>';

        try {
            const data = await window.apiFetch('/quizzes/categories?type=global');
            
            if (data && data.success && data.categories && data.categories.length > 0) {
                renderCategories(data.categories, container);
            } else {
                renderEmptyState(container, 'No global quizzes available yet.');
            }
        } catch (error) {
            renderEmptyState(container, 'No global quizzes available yet.');
        }
    }

    function renderCategories(categories, container) {
        if (!categories || categories.length === 0) {
            renderEmptyState(container, 'No global quizzes available yet.');
            return;
        }
        
        const categoriesToShow = categories.slice(0, 6);

        container.innerHTML = categoriesToShow.map(cat => {
            const safeImage = getValidImageUrl(cat.image);
            const iconClass = cat.icon || 'bx bx-folder';
            
            return `
            <div class="level-card category-card" onclick="window.location.href='global-quizzes.html?category=${cat._id || cat.id}'">
                <div class="category-visual">
                    ${safeImage 
                        ? `<img src="${safeImage}" alt="${cat.name}" class="category-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="fallback-icon" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">
                                <i class="${iconClass}"></i>
                            </div>`
                        : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"><i class="${iconClass}"></i></div>`
                    }
                </div>
                <div class="category-info">
                    <h4>${cat.name || 'Unnamed'}</h4>
                    <p>Explore quizzes</p>
                </div>
            </div>`;
        }).join('');
    }

    window.selectCategory = async function(id, name) {
        wizardState.category = id;
        wizardState.categoryName = name;
        
        document.getElementById('wizard-step-categories').style.display = 'none';
        document.getElementById('wizard-step-fields').style.display = 'block';
        
        const fieldsContainer = document.getElementById('global-fields-list');
        fieldsContainer.innerHTML = `
            <div class="level-card" style="grid-column: 1 / -1; width: 100%;">
                <i class='bx bx-loader-circle bx-spin' style="font-size: 2rem;"></i>
                <h4>Loading Topics</h4>
            </div>`;
        
        try {
            const topicsData = await window.apiFetch(`/topics?categoryId=${encodeURIComponent(id)}&t=${Date.now()}`);
            const topics = (topicsData && topicsData.success && Array.isArray(topicsData.topics)) ? topicsData.topics : [];

            if (topics.length > 0) {
                renderFields(topics, fieldsContainer);
                return;
            }

            const data = await window.apiFetch(`/quizzes/categories/${id}/fields`);
            if (data && data.success && data.fields) renderFields(data.fields, fieldsContainer);
            else renderEmptyState(fieldsContainer, 'No topics available.');
        } catch (error) {
            renderEmptyState(fieldsContainer, 'Error loading topics.');
        }
    };

    function renderFields(fields, container) {
        if (!fields || fields.length === 0) {
            renderEmptyState(container, 'No topics available.');
            return;
        }

        container.innerHTML = `<div class="categories-grid">
            ${fields.map(field => {
                const isObj = typeof field === 'object';
                const topicName = isObj ? (field.name || '') : String(field || '');
                const safeTopicName = topicName.replace(/'/g, "\\'");
                const safeImage = getValidImageUrl(isObj ? field.image : null);

                return `
                <div class="level-card category-card topic-card" onclick="selectField('${safeTopicName}')">
                    <div class="category-visual">
                        ${safeImage
                            ? `<img src="${safeImage}" alt="${topicName}" class="category-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                               <div class="fallback-icon" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;"><i class='bx bx-book-content'></i></div>`
                            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"><i class='bx bx-book-content'></i></div>`
                        }
                    </div>
                    <div class="category-info">
                        <h4>${topicName}</h4>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    }

    window.selectField = function(field) {
        wizardState.field = field;
        const query = new URLSearchParams({
            category: wizardState.category,
            field: field,
            type: 'Global'
        });
        window.location.href = 'global-quizzes.html?' + query.toString();
    };

    window.backToCategories = function() {
        document.getElementById('wizard-step-fields').style.display = 'none';
        document.getElementById('wizard-step-categories').style.display = 'block';
        wizardState.category = null;
        wizardState.field = null;
    };
});

/* =========================================
   INJECT PREMIUM SIDEBAR
   (Merged & Cleaned for Safety)
   ========================================= */
function initPremiumSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    // 1. Get User Info safely
    let user = {};
    try {
        user = JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) { console.error("User parsing error", e); }
    
    // Default Fallbacks
    const userName = user.name || "Diljot Singh"; 
    const userRole = user.role || "Developer";
    const avatarUrl = user.avatar || user.profile?.avatar || 'https://i.ibb.co/jP9JWBBy/diljj.png';

    // 2. Define Menu Items
    const menuItems = [
        { name: 'Dashboard', icon: 'bxs-dashboard', link: 'dashboard.html' },
        { name: 'Global Quizzes', icon: 'bx-world', link: 'global-quizzes.html' },
        { name: 'Leaderboard', icon: 'bx-trophy', link: 'leaderboard.html' },
        { name: 'My Profile', icon: 'bx-user', link: 'profile.html' },
        { name: 'Settings', icon: 'bx-cog', link: 'settings.html' }
    ];

    // 3. Get current page for "Active" highlighting
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

    // 4. Build HTML
    const navLinksHtml = menuItems.map(item => {
        const isActive = currentPage === item.link ? 'active' : '';
        return `
            <a href="${item.link}" class="nav-item ${isActive}">
                <i class='bx ${item.icon}'></i>
                <span>${item.name}</span>
            </a>
        `;
    }).join('');

    container.innerHTML = `
        <div class="sidebar-brand">
            <i class='bx bx-atom'></i>
            <span>OSIAN</span>
        </div>

        <div class="sidebar-user-card">
            <img src="${avatarUrl}" class="sidebar-avatar user-avatar" id="sidebar-user-avatar" alt="User" onerror="this.src='https://i.ibb.co/jP9JWBBy/diljj.png'">
            <div class="sidebar-user-info">
                <h4>${userName}</h4>
                <span>${userRole}</span>
            </div>
        </div>

        <nav class="sidebar-menu">
            ${navLinksHtml}
        </nav>

        <div class="sidebar-footer">
            <button class="logout-btn" onclick="handleLogout()">
                <i class='bx bx-log-out-circle'></i> Logout
            </button>
        </div>
    `;
    
    // Re-trigger avatar sync if available
    if(window.initAvatars) window.initAvatars();
}

// 5. Logout Function Helper
function handleLogout() {
    if(confirm('Are you sure you want to log out?')) {
        window.logout(); // Use the global logout function defined at the top
    }
}
