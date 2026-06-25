(function() {
    // --- Prevent Multiple Initializations ---
    if (window.sharedScriptsLoaded) {
        return;
    }
    window.sharedScriptsLoaded = true;
    
    console.log('Shared scripts initialized');

    function redirect(url) {
        window.location.href = window.getRedirectUrl ? window.getRedirectUrl(url) : url;
    }

    // --- API Configuration ---
    window.API_BASE = (function() {
        let override = window.API_BASE_URL || (function() {
            try { return localStorage.getItem('API_BASE_URL') || ''; } catch (_) { return ''; }
        })();

        const hostname = window.location.hostname || '';
        const isFile = window.location.protocol === 'file:';
        const isLocal = isFile || hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1';

        // Allow override even on local for testing against production backend

        if (override) return override;

        if (isLocal) {
            return 'http://localhost:5000/api';
        }
        return 'https://osianoffical-hfp9.vercel.app/api';
    })();

    console.log('API Base URL:', window.API_BASE);

    // --- Global Constants (META) ---
    window.META = {
        categories: ['Technical', 'Aptitude', 'General Knowledge', 'Coding', 'Mathematics', 'Science'],
        topicsByCategory: {
            'Technical': ['JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'Database', 'DevOps'],
            'Aptitude': ['Logical Reasoning', 'Quantitative Analysis', 'Verbal Ability'],
            'General Knowledge': ['Current Affairs', 'History', 'Geography'],
            'Coding': ['Algorithms', 'Data Structures', 'Competitive Programming'],
            'Mathematics': ['Algebra', 'Calculus', 'Statistics'],
            'Science': ['Physics', 'Chemistry', 'Biology']
        },
        levelsByTopic: {}
    };

    // --- Toast Notification Helper ---
    window.showToast = function(message, type = 'info') {
        // Ensure we're in a browser environment
        if (typeof document === 'undefined') return;
        
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: var(--bg-card);
            color: var(--text-main);
            border-left: 4px solid ${type === 'error' ? '#ff4d4d' : (type === 'success' ? '#4CAF50' : '#2196F3')};
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 250px;
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        toast.innerHTML = `<span>${message}</span>`;
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    };

    // --- API Fetch Helper ---
    window.apiFetch = async function(path, opts = {}) {
        const rel = path.startsWith('/') ? path : ('/' + path);
        const url = window.API_BASE + rel;
        
        // Skip auth check for login/register endpoints
        const isAuthEndpoint = rel.includes('/auth/login') || 
                               rel.includes('/auth/register') || 
                               rel.includes('/auth/verify-otp') ||
                               rel.includes('/auth/forgot-password');
        
        const options = {
            credentials: 'omit',
            ...opts
        };
        
        options.headers = {
            ...(options.headers || {})
        };
        
        // Set Content-Type if not already set and body exists
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            if (!options.headers['Content-Type'] && !options.headers['content-type']) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(options.body);
            }
        }

        const token = localStorage.getItem('token');
        
        if (token && !isAuthEndpoint && !options.headers.Authorization && !options.headers.authorization) {
            options.headers['Authorization'] = 'Bearer ' + token;
        }

        console.log(`[API] ${options.method || 'GET'} ${url}`, options.body ? 'with body' : '');

        try {
            const res = await fetch(url, options);
            
            // Handle 401 Unauthorized (Session Expired)
            // Skip for auth endpoints (login/register) where 401 means "Invalid Credentials"
            if (res.status === 401 && !isAuthEndpoint) {
                console.warn(`[API] 401 Unauthorized from ${url}`);
                
                // Prevent multiple redirects
                if (window.authRedirectInProgress) {
                    console.log('[API] Redirect already in progress, skipping');
                    throw new Error('Unauthorized (401)');
                }
                
                // Mark that we're handling this 401
                window.authRedirectInProgress = true;
                
                // Clear auth data
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                // Show notification if not on login page
                const currentPath = window.location.pathname;
                const isLoginPage = currentPath.includes('/auth/login') || currentPath.includes('login.html');
                
                if (!isLoginPage && window.showToast) {
                    window.showToast('Session expired. Please login again.', 'error');
                }
                
                // Only redirect if not already on login page
                if (!isLoginPage) {
                    console.log('[API] Redirecting to login from:', currentPath);
                    setTimeout(() => {
                        window.authRedirectInProgress = false;
                        redirect('/frontend/auth/login.html');
                    }, 1500);
                } else {
                    // Clear the flag immediately if already on login page
                    window.authRedirectInProgress = false;
                }
                
                throw new Error('Unauthorized (401)');
            }

            // Handle other error statuses
            if (!res.ok) {
                const contentType = res.headers.get('content-type');
                let errorData;
                
                if (contentType && contentType.includes('application/json')) {
                    errorData = await res.json();
                } else {
                    errorData = { message: `HTTP ${res.status}` };
                }
                
                const error = new Error(errorData.message || `HTTP ${res.status}`);
                error.status = res.status;
                error.data = errorData;
                throw error;
            }

            // Parse successful response
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await res.json();
                console.log(`[API] Response from ${url}:`, data);
                return data;
            } else {
                const text = await res.text();
                console.log(`[API] Response from ${url}:`, text.substring(0, 100));
                return text;
            }
            
        } catch (err) {
            if (!opts.silent) {
                console.error('[API] Fetch Error:', err.message, 'URL:', url);
                
                // Only show toast for non-401 errors
                if (err.message !== 'Unauthorized (401)' && window.showToast) {
                    window.showToast(err.message || 'Network error occurred', 'error');
                }
            }
            
            throw err;
        }
    };

    // --- Shared Sidebar Loader ---
    window.loadSharedSidebar = async function() {
        try {
            const container = document.getElementById('sidebar-container');
            if (!container) return;
            
            // Prevent multiple loads
            if (container.querySelector('.sidebar-menu') || container.querySelector('nav[aria-label="Sidebar navigation"]')) {
                return;
            }
            
            const res = await fetch('/frontend/components/sidebar-user.html');
            if (!res.ok) {
                console.warn('[Sidebar] Could not load sidebar HTML');
                return;
            }
            
            const html = await res.text();
            container.innerHTML = html;
            
            // Set active link
            const current = window.location.pathname.split('/').pop();
            const links = container.querySelectorAll('.sidebar-menu a');
            links.forEach(link => {
                const href = (link.getAttribute('href') || '').split('/').pop();
                if (href === current) link.classList.add('active');
            });
            
            // Mobile menu functionality
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
            
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    let u = null;
                    if (window.getUserProfile) {
                        u = await window.getUserProfile({});
                    } else {
                        const data = await window.apiFetch('/users/profile');
                        u = data && data.success && data.user ? data.user : null;
                    }
                    if (u) {
                        const nameEl = document.getElementById('sidebar-name');
                        const roleEl = document.getElementById('sidebar-role');
                        const avatarEl = document.getElementById('sidebar-avatar');
                        if (nameEl) nameEl.textContent = u.name || 'User';
                        if (roleEl) roleEl.textContent = (u.role || 'user').toUpperCase();
                        if (avatarEl && (u.profile && u.profile.avatar) ? u.profile.avatar : u.avatar) {
                            avatarEl.src = (u.profile && u.profile.avatar) ? u.profile.avatar : u.avatar;
                        }
                    }
                }
            } catch (error) {
                console.log('[Sidebar] Could not load user profile:', error.message);
            }
        } catch (e) {
            console.error('[Sidebar] Load failed:', e);
        }
    };

    // --- Auth Guard Function ---
    window.checkAuth = async function() {
        const token = localStorage.getItem('token');
        let user = JSON.parse(localStorage.getItem('user') || '{}');
        const currentPath = window.location.pathname;
        
        console.log('[Auth] Checking auth for path:', currentPath, 'Token exists:', !!token);
        
        // Public paths that don't require auth
        const publicPaths = [
            '/auth/login.html',
            '/auth/register.html',
            '/auth/verify-otp.html',
            '/auth/forgot-password.html',
            '/user/events.html',
            '/user/event-details.html',
            '/index.html',
            '/'
        ];

        const isPublic = publicPaths.some(path => currentPath.endsWith(path));
        
        console.log('[Auth] Is public path:', isPublic);

        // If on public page and no token, just return
        if (isPublic && !token) {
            console.log('[Auth] Public page, no token required');
            return true;
        }

        // If on public page but has token, check if we should stay or redirect
        if (isPublic && token) {
            // Only redirect from login/register pages when logged in
            const authOnlyPages = [
                '/auth/login.html',
                '/auth/register.html',
                '/auth/verify-otp.html',
                '/auth/forgot-password.html'
            ];
            
            const isAuthOnlyPage = authOnlyPages.some(path => currentPath.endsWith(path));
            
            if (isAuthOnlyPage) {
                console.log('[Auth] On auth page with token, redirecting to dashboard');
                
                try {
                    let profile = null;
                    if (window.getUserProfile) {
                        profile = await window.getUserProfile({ forceRefresh: true });
                    } else {
                        const data = await window.apiFetch('/users/profile');
                        profile = data && data.success && data.user ? data.user : null;
                    }
                    if (profile) {
                        user = profile;
                        localStorage.setItem('user', JSON.stringify(user));
                        if (user.role === 'admin' && !user.isApproved) {
                            console.log('[Auth] Admin not approved, staying on auth page');
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            if (window.showToast) {
                                window.showToast('Admin account pending approval. Please contact support.', 'error');
                            }
                            return false;
                        }
                    }
                } catch (error) {
                    console.log('[Auth] Could not fetch profile, clearing token');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    return true;
                }
                
                // Redirect based on role
                setTimeout(() => {
                    if (user.role === 'superadmin') {
                        redirect('/frontend/super-admin/dashboard.html');
                    } else if (user.role === 'admin') {
                        redirect('/frontend/admin/dashboard.html');
                    } else {
                        redirect('/frontend/user/dashboard.html');
                    }
                }, 100);
                return false;
            }
            
            // For other public pages (like events), stay on the page
            return true;
        }

        // If not on public page and no token, redirect to login
        if (!isPublic && !token) {
            console.log('[Auth] Protected page, no token, redirecting to login');
            setTimeout(() => {
                redirect('/frontend/auth/login.html');
            }, 100);
            return false;
        }

        // If on protected page with token, validate it
        if (!isPublic && token) {
            console.log('[Auth] Protected page with token, validating...');
            
            if (!user.role) {
                try {
                    let profile = null;
                    if (window.getUserProfile) {
                        profile = await window.getUserProfile({ forceRefresh: true });
                    } else {
                        const data = await window.apiFetch('/users/profile');
                        profile = data && data.success && data.user ? data.user : null;
                    }
                    if (profile) {
                        user = profile;
                        localStorage.setItem('user', JSON.stringify(user));
                    } else {
                        throw new Error('Invalid user data');
                    }
                } catch (error) {
                    console.error('[Auth] Failed to fetch profile:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setTimeout(() => {
                        redirect('/frontend/auth/login.html');
                    }, 100);
                    return false;
                }
            }

            // Check admin approval
            if (user.role === 'admin' && !user.isApproved) {
                console.log('[Auth] Admin not approved, redirecting to login');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                if (window.showToast) {
                    window.showToast('Admin account pending approval.', 'error');
                }
                setTimeout(() => {
                    redirect('/frontend/auth/login.html');
                }, 100);
                return false;
            }

            // Role-based access control
            const role = (user.role || '').toLowerCase();
            
            // Super Admin pages
            if (currentPath.includes('/superadmin/') && role !== 'superadmin') {
                console.log('[Auth] Access denied: need superadmin role');
                if (window.showToast) {
                    window.showToast('Access denied. Super Admin only.', 'error');
                }
                setTimeout(() => {
                    if (role === 'admin') {
                        redirect('/frontend/admin/dashboard.html');
                    } else {
                        redirect('/frontend/user/dashboard.html');
                    }
                }, 100);
                return false;
            }
            
            // Admin pages
            if (currentPath.includes('/admin/') && !['admin', 'superadmin'].includes(role)) {
                console.log('[Auth] Access denied: need admin role');
                if (window.showToast) {
                    window.showToast('Access denied. Admin only.', 'error');
                }
                setTimeout(() => {
                    redirect('/frontend/user/dashboard.html');
                }, 100);
                return false;
            }
            
            console.log('[Auth] Access granted for role:', role);
            return true;
        }

        return true;
    };

    // --- Global Logout Function ---
    window.logout = function() {
        console.log('[Auth] Logging out...');
        
        // Clear all auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Clear any redirect flags
        delete window.authRedirectInProgress;
        
        // Redirect to login
        redirect('/frontend/auth/login.html');
    };

    // --- Initialize on Page Load ---
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[Init] DOM loaded, starting auth check');
        
        // Small delay to ensure other scripts are loaded
        setTimeout(async function() {
            try {
                await window.checkAuth();
                const token = localStorage.getItem('token');
                if (token) {
                    try {
                        let u = null;
                        if (window.getUserProfile) {
                            u = await window.getUserProfile({ silent: true });
                        } else {
                            const data = await window.apiFetch('/users/profile', { silent: true });
                            u = data && data.success && data.user ? data.user : null;
                        }
                        if (u) {
                            localStorage.setItem('user', JSON.stringify(u));
                            const nameEl = document.getElementById('sidebar-name');
                            const roleEl = document.getElementById('sidebar-role');
                            const avatarEl = document.getElementById('sidebar-avatar');
                            if (nameEl) nameEl.textContent = u.name || 'User';
                            if (roleEl) roleEl.textContent = (u.role || 'user').toUpperCase();
                            if (avatarEl && (u.profile && u.profile.avatar) ? u.profile.avatar : u.avatar) {
                                avatarEl.src = (u.profile && u.profile.avatar) ? u.profile.avatar : u.avatar;
                            }
                        }
                    } catch (error) {
                        console.log('[Init] Could not load profile:', error.message);
                    }
                }
            } catch (error) {
                console.error('[Init] Auth check failed:', error);
            }
        }, 300);
    });

})();
