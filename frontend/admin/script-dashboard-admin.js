// script-dashboard-admin.js - Corrected for Admin Dashboard
document.addEventListener("DOMContentLoaded", function() {
    // Add a flag to prevent multiple initializations
    if (window.dashboardInitialized) {
        return;
    }
    window.dashboardInitialized = true;
    
    console.log('Admin Dashboard script loaded');
    
    // Check authentication first
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
        console.log('No token found in dashboard script');
        window.location.href = '/frontend/auth/login.html';
        return;
    }
    
    // Verify user role
    // Allow 'admin' and 'superadmin' to view this, but primarily for 'admin'
    if (user.role !== 'admin' && user.role !== 'superadmin') {
        console.log('User is not authorized for admin dashboard');
        window.location.href = '/frontend/index.html';
        return;
    }

    // Initialize Dashboard with retry logic
    initDashboardWithRetry();

    async function initDashboardWithRetry(retryCount = 0) {
        try {
            await initDashboard();
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            
            // Check if error is due to authentication
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                console.log('Authentication error, clearing tokens');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/frontend/auth/login.html';
                return;
            }
            
            // Retry logic for other errors
            if (retryCount < 3) {
                console.log(`Retrying dashboard initialization (${retryCount + 1}/3)`);
                setTimeout(() => {
                    initDashboardWithRetry(retryCount + 1);
                }, 2000 * (retryCount + 1));
            } else {
                if (window.showToast) {
                    window.showToast('Failed to load dashboard after multiple attempts', 'error');
                }
            }
        }
    }

    async function initDashboard() {
        console.log('Initializing admin dashboard...');
        
        // Update UI with user info
        updateUserInfo();
        
        // Load data in parallel but handle errors individually
        const promises = [
            loadAdminKPIs().catch(e => {
                console.error('Error loading KPIs:', e);
                return null;
            }),
            fetchUnreadNotificationsCount().catch(e => {
                console.error('Error loading notifications:', e);
                return null;
            }),
            loadRecentQuizzes().catch(e => {
                console.error('Error loading recent quizzes:', e);
                return null;
            })
        ];
        
        await Promise.all(promises);
        console.log('Dashboard initialization complete');
        
        // Start polling for real-time updates
        startPolling();
    }

    function startPolling() {
        // Poll every 30 seconds
        setInterval(() => {
            console.log('Polling for dashboard updates...');
            // Pass true to indicate this is a background update
            loadAdminKPIs(true).catch(console.error);
            loadRecentQuizzes(true).catch(console.error);
            fetchUnreadNotificationsCount().catch(console.error);
        }, 30000);
    }

    function updateKPI(id, newValue) {
        const el = document.getElementById(id);
        if (!el) return;
        
        // Get current value, handling potential non-numeric characters if any
        const currentText = el.textContent || '0';
        const currentValue = parseInt(currentText.replace(/[^0-9-]/g, '')) || 0;
        
        if (currentValue !== newValue) {
            animateValue(id, currentValue, newValue, 1000);
        }
    }

    function updateUserInfo() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Update avatar if exists
        const avatarElements = document.querySelectorAll('.avatar, .avatar-nav');
        avatarElements.forEach(el => {
            // Check for profile image
            if (user.profile && user.profile.avatar) {
                el.textContent = ''; // Clear initials
                el.style.backgroundImage = `url('${user.profile.avatar}')`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
            } else if (user.name) {
                const initials = user.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
                el.textContent = initials || 'AD';
                el.style.backgroundImage = 'none';
            }
        });
        
        // Update name if exists
        const nameElements = document.querySelectorAll('.user-name-nav, #nav-name');
        nameElements.forEach(el => {
            if (user.name) {
                el.textContent = user.name;
            }
        });

        // Update Unique Code if exists
        if (user.uniqueCode) {
            const codeEl = document.getElementById('admin-unique-code');
            if (codeEl) {
                codeEl.textContent = user.uniqueCode;
                // Click to copy
                codeEl.title = 'Click to copy';
                codeEl.style.cursor = 'pointer';
                codeEl.onclick = () => {
                    navigator.clipboard.writeText(user.uniqueCode).then(() => {
                        const original = codeEl.textContent;
                        codeEl.textContent = 'Copied!';
                        setTimeout(() => codeEl.textContent = original, 1500);
                    });
                };
            }
        } else if (user.role === 'superadmin') {
            const codeEl = document.getElementById('admin-unique-code');
            if (codeEl) codeEl.textContent = 'SUPER';
        } else {
            // Try to fetch profile if code is missing (e.g. first login after update)
            fetchUserProfile();
        }
    }

    async function fetchUserProfile() {
        try {
            let profile = null;
            if (window.getUserProfile) {
                profile = await window.getUserProfile({});
            } else {
                const data = await apiFetch('/users/profile');
                profile = data && data.user ? data.user : null;
            }
            if (profile) {
                localStorage.setItem('user', JSON.stringify(profile));
                // Recursive call to update UI, but safely
                const codeEl = document.getElementById('admin-unique-code');
                if (codeEl && profile.uniqueCode) {
                     codeEl.textContent = profile.uniqueCode;
                     codeEl.title = 'Click to copy';
                     codeEl.style.cursor = 'pointer';
                     codeEl.onclick = () => {
                         navigator.clipboard.writeText(profile.uniqueCode).then(() => {
                             const original = codeEl.textContent;
                             codeEl.textContent = 'Copied!';
                             setTimeout(() => codeEl.textContent = original, 1500);
                         });
                     };
                }
            }
        } catch (e) {
            console.error('Failed to fetch profile', e);
            if (window.showToast) {
                window.showToast('Failed to load admin profile', 'error');
            }
        }
    }

    async function loadAdminKPIs(isBackground = false) {
        try {
            // apiFetch handles base URL and headers automatically
            const data = await apiFetch('/analytics/admin-kpis');
            
            const k = data.kpis || {};
            
            // Animate numbers for Admin KPIs
            // If background update, don't animate, just set
            if (isBackground) {
                const el1 = document.getElementById('kpi-total-quizzes');
                const el2 = document.getElementById('kpi-active-quizzes');
                const el3 = document.getElementById('kpi-total-participants');
                if(el1) el1.textContent = k.totalQuizzesCreated || 0;
                if(el2) el2.textContent = k.activeQuizzes || 0;
                if(el3) el3.textContent = k.totalParticipants || 0;
            } else {
                animateValue('kpi-total-quizzes', 0, k.totalQuizzesCreated || 0, 1000);
                animateValue('kpi-active-quizzes', 0, k.activeQuizzes || 0, 1000);
                animateValue('kpi-total-participants', 0, k.totalParticipants || 0, 1000);
            }
            
        } catch(e) {
            console.error('Error loading admin KPIs:', e);
            if (!isBackground) {
                const ids = ['kpi-total-quizzes', 'kpi-active-quizzes', 'kpi-total-participants'];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.textContent = '0';
                });
                if (window.showToast) {
                    window.showToast('Failed to load admin statistics', 'error');
                }
            }
        }
    }

    async function loadRecentQuizzes(isBackground = false) {
        try {
            // Fetch quizzes created by this admin
            const data = await apiFetch('/quizzes/admin?limit=5');

            if (data.quizzes) {
                const tbody = document.getElementById('recent-quizzes-body');
                if (!tbody) return;

                if (data.quizzes.length > 0) {
                    tbody.innerHTML = data.quizzes.map(quiz => `
                        <tr>
                            <td>
                                <div style="font-weight: 500;">${quiz.title}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(quiz.createdAt).toLocaleDateString()}</div>
                            </td>
                            <td><span class="badge badge-category">${quiz.category?.name || 'General'}</span></td>
                            <td>${quiz.type}</td>
                            <td>${quiz.questions ? quiz.questions.length : 0}</td>
                            <td><span class="badge status-${quiz.status}">${quiz.status}</span></td>
                            <td>
                                <button class="action-btn" onclick="editQuiz('${quiz._id}')"><i class='bx bx-edit'></i></button>
                                <button class="action-btn" onclick="deleteQuiz('${quiz._id}')"><i class='bx bx-trash'></i></button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No quizzes created yet.</td></tr>';
                }
            }
        } catch (error) {
            console.error('Error loading recent quizzes:', error);
            const tbody = document.getElementById('recent-quizzes-body');
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Error loading data</td></tr>';
        }
    }

    async function fetchUnreadNotificationsCount() {
        try {
            const data = await apiFetch('/notifications/unread-count');
            
            const badge = document.querySelector('.notification-badge');
            if (badge && data && data.count > 0) {
                badge.textContent = data.count > 99 ? '99+' : data.count;
                badge.style.display = 'flex';
            } else if (badge) {
                badge.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching unread notifications count:', error);
        }
    }

    function animateValue(id, start, end, duration) {
        const obj = document.getElementById(id);
        if (!obj) return;
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});

// Helper functions for actions (must be global)
window.editQuiz = function(id) {
    // Implement edit logic or redirect
    console.log('Edit quiz:', id);
    if(window.showCreateQuiz) {
        // If we are on the dashboard that has this function
        // Or redirect to quiz editor
        window.location.href = `create-quiz.html?id=${id}`;
    } else {
        window.showToast('Redirecting to edit...', 'info');
        window.location.href = `create-quiz.html?id=${id}`;
    }
};

window.deleteQuiz = async function(id) {
    if(!confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
        await apiFetch(`/quizzes/${id}`, {
            method: 'DELETE'
        });
        
        window.showToast('Quiz deleted successfully', 'success');
        // Reload page or refresh list
        setTimeout(() => window.location.reload(), 1000);
        
    } catch (error) {
        console.error('Delete error:', error);
        window.showToast('Error deleting quiz', 'error');
    }
};
