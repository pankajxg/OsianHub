document.addEventListener('DOMContentLoaded', () => {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || 'user';

    let links = [];

    if (role === 'user') {
        links = [
            { name: 'Dashboard', href: '/frontend/user/dashboard.html' },
            { name: 'Quizzes', href: '/frontend/user/quizzes.html' },
            { name: 'Global Quizzes', href: '/frontend/user/global-quizzes.html' },
            { name: 'Events', href: '/frontend/user/events.html' },
            { name: 'Leaderboard', href: '/frontend/user/leaderboard.html' },
            { name: 'Results', href: '/frontend/user/results.html' },
            { name: 'Notifications', href: '/frontend/user/notifications.html' },
            { name: 'Profile', href: '/frontend/user/profile.html' }
        ];
    } else if (role === 'admin') {
        links = [
            { name: 'Dashboard', href: '/frontend/admin/dashboard.html' },
            { name: 'Create Quiz', href: '/frontend/admin/create-quiz.html' },
            { name: 'Results', href: '/frontend/admin/quiz-results.html' },
            { name: 'Profile', href: '/frontend/admin/profile.html' }
        ];
    } else if (role === 'superadmin') {
        links = [
            { name: 'Dashboard', href: '/frontend/super-admin/dashboard.html' },
            { name: 'Users', href: '/frontend/super-admin/user-management.html' },
            { name: 'Categories', href: '/frontend/super-admin/manage-categories.html' },
            { name: 'Global Quizzes', href: '/frontend/super-admin/manage-global-quizzes.html' },
            { name: 'Admins', href: '/frontend/super-admin/admin-management.html' },
            { name: 'Events', href: '/frontend/super-admin/events.html' },
            { name: 'Profile', href: '/frontend/super-admin/profile.html' }
        ];
    }

    const navHtml = `
        <nav class="navbar">
            <div class="logo">
                <a href="#" style="color: var(--osian-cyan); font-weight: bold; font-size: 1.5rem; text-decoration: none;">OSIAN</a>
            </div>
            <ul class="nav-links">
                ${links.map(link => {
                    const isActive = window.location.pathname.includes(link.href);
                    return `<li><a href="${link.href}" class="${isActive ? 'active' : ''}">${link.name}</a></li>`;
                }).join('')}
                <li><a href="#" id="logout-btn">Logout</a></li>
            </ul>
        </nav>
    `;

    navbarContainer.innerHTML = navHtml;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/frontend/auth/login.html';
        });
    }
});
