document.addEventListener('DOMContentLoaded', () => {
    const notificationsList = document.getElementById('notifications-list');
    const markAllReadBtn = document.getElementById('mark-all-read');
    
    // Auth check is handled by auth-guard.js, but good to have a safety check
    const token = localStorage.getItem('token');
    if (!token) return; // auth-guard will redirect

    fetchNotifications();

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            try {
                // Find all unread notifications
                const unreadItems = document.querySelectorAll('.notification-item.unread');
                const unreadIds = Array.from(unreadItems).map(item => item.dataset.id);

                if (unreadIds.length === 0) {
                    showToast('No unread notifications.', 'info');
                    return;
                }

                const result = await apiFetch('/notifications/read', {
                    method: 'POST',
                    body: JSON.stringify({ notificationIds: unreadIds })
                });

                if (result.success || result.message) {
                    showToast('All notifications marked as read.', 'success');
                    // Refresh list or update UI
                    unreadItems.forEach(item => {
                        item.classList.remove('unread');
                        const btn = item.querySelector('.mark-read-btn');
                        if(btn) btn.remove();
                    });
                    updateUnreadCount();
                }
            } catch (error) {
                console.error('Error marking all read:', error);
                showToast('Failed to mark all as read.', 'error');
            }
        });
    }

    async function fetchNotifications() {
        try {
            // Use apiFetch
            const data = await apiFetch('/notifications?limit=50');
            
            // Handle different response formats
            let notifications = [];
            if (Array.isArray(data)) {
                notifications = data;
            } else if (data && Array.isArray(data.notifications)) {
                notifications = data.notifications;
            } else if (data && Array.isArray(data.data)) {
                notifications = data.data;
            }

            renderNotifications(notifications);
            updateUnreadCount();
        } catch (error) {
            console.error('Error fetching notifications:', error);
            notificationsList.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-error-circle' style="color: var(--osian-red);"></i>
                    <p>Failed to load notifications.</p>
                </div>
            `;
        }
    }

    function renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-bell-off'></i>
                    <p>No notifications yet.</p>
                </div>
            `;
            return;
        }

        notificationsList.innerHTML = notifications.map(notif => {
            const isUnread = !notif.isRead;
            const date = new Date(notif.createdAt).toLocaleString();
            
            // Determine icon based on subject/content (simple heuristic)
            let icon = 'bx-bell';
            if (notif.subject.toLowerCase().includes('quiz')) icon = 'bx-brain';
            else if (notif.subject.toLowerCase().includes('result')) icon = 'bx-trophy';
            else if (notif.subject.toLowerCase().includes('alert') || notif.subject.toLowerCase().includes('cheating')) icon = 'bx-error-circle';
            else if (notif.subject.toLowerCase().includes('welcome')) icon = 'bx-party';

            return `
                <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notif._id}">
                    <div class="notification-icon">
                        <i class='bx ${icon}'></i>
                    </div>
                    <div class="notification-content" style="flex: 1;">
                        <h4>${escapeHtml(notif.subject)}</h4>
                        <p>${escapeHtml(notif.message)}</p>
                        <div class="notification-meta">
                            <span><i class='bx bx-time'></i> ${date}</span>
                            ${isUnread ? `
                                <button class="mark-read-btn" onclick="markAsRead('${notif._id}')">
                                    <i class='bx bx-check'></i> Mark as Read
                                </button>
                            ` : '<span><i class=\'bx bx-check-double\'></i> Read</span>'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Expose markAsRead to global scope so inline onclick works
    window.markAsRead = async function(id) {
        try {
            const result = await apiFetch('/notifications/read', {
                method: 'POST',
                body: JSON.stringify({ notificationIds: [id] })
            });

            if (result.success || result.message) {
                const item = document.querySelector(`.notification-item[data-id="${id}"]`);
                if (item) {
                    item.classList.remove('unread');
                    const btn = item.querySelector('.mark-read-btn');
                    if (btn) {
                        btn.outerHTML = '<span><i class=\'bx bx-check-double\'></i> Read</span>';
                    }
                }
                updateUnreadCount();
                showToast('Notification marked as read', 'success');
            }
        } catch (error) {
            console.error('Error marking read:', error);
            showToast('Failed to update notification.', 'error');
        }
    };

    function updateUnreadCount() {
        // Update local list count if needed
        const unreadCount = document.querySelectorAll('.notification-item.unread').length;
        
        // Update Navbar Badge (if present)
        const badge = document.getElementById('notification-badge'); // Common ID
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
                // Styles are usually handled by CSS, but we can enforce visibility
            } else {
                badge.style.display = 'none';
            }
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
