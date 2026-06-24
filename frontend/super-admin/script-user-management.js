document.addEventListener("DOMContentLoaded", function() {

    function showToast(message, type){
        let el = document.getElementById('osian-toast');
        if (!el) { el = document.createElement('div'); el.id = 'osian-toast'; el.className = 'osian-toast'; document.body.appendChild(el); }
        el.className = 'osian-toast ' + (type || '');
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(function(){ el.classList.remove('show'); }, 5000);
    }

    const token = localStorage.getItem('token');
    // Auth check handled by auth-guard
    if (!token) return;

    // --- State ---
    let currentPage = 1;
    let totalPages = 1;
    let searchQuery = '';
    const limit = 10;

    // --- Elements ---
    const tableBody = document.querySelector('#all-users-table tbody');
    const searchInput = document.getElementById('user-search');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');

    // --- Functions ---

    async function fetchUsers() {
        if (!tableBody) return;
        
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

        try {
            // Build query string
            let qs = `?page=${currentPage}&limit=${limit}`;
            if (searchQuery) {
                // Note: Backend might need to support search query parameter. 
                // Assuming standard generic search or filter if implemented, otherwise client-side filter (less ideal).
                // Looking at userController.js, it DOES NOT seem to support search query yet (only page/limit).
                // So for now, we might rely on pagination. 
                // However, let's pass it anyway in case we update backend.
                qs += `&search=${encodeURIComponent(searchQuery)}`;
            }

            const data = await apiFetch('/users' + qs);

            if (data.success && data.users) {
                renderTable(data.users);
                updatePagination(data.pagination);
            } else {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center error">Error loading users.</td></tr>';
        }
    }

    function renderTable(users) {
        tableBody.innerHTML = '';
        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
            return;
        }

        users.forEach(u => {
            const row = document.createElement('tr');
            const roleClass = u.role ? u.role.toLowerCase() : 'user';
            const statusClass = u.isActive ? 'active' : 'inactive';
            const statusText = u.isActive ? 'Active' : 'Inactive';
            const date = new Date(u.createdAt).toLocaleDateString();

            row.innerHTML = `
                <td>
                    <div class="user-name-cell">
                        <img src="${(u.profile?.avatar && !u.profile.avatar.includes('placeholder.com')) ? u.profile.avatar : 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23cbd5e1\'%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z\'/%3E%3C/svg%3E'}" alt="Avatar" class="user-avatar" style="width: 32px; height: 32px; object-fit: cover; border-radius: 50%;">
                        <span>${u.name || 'N/A'}</span>
                    </div>
                </td>
                <td>${u.email}</td>
                <td><span class="role-tag ${roleClass}">${u.role}</span></td>
                <td><span class="status-tag ${statusClass}">${statusText}</span></td>
                <td>${date}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit" title="Change Role" onclick="changeRole('${u._id}', '${u.role}')"><i class='bx bxs-edit'></i></button>
                        <button class="btn-icon ${u.isActive ? 'delete' : 'approve'}" title="${u.isActive ? 'Deactivate' : 'Activate'}" onclick="toggleStatus('${u._id}', ${u.isActive})">
                            <i class='bx ${u.isActive ? 'bx-block' : 'bx-check-circle'}'></i>
                        </button>
                        <button class="btn-icon delete" title="Delete User" onclick="deleteUser('${u._id}')"><i class='bx bxs-trash'></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function updatePagination(pagination) {
        if (!pagination) return;
        currentPage = pagination.currentPage;
        totalPages = pagination.totalPages;
        
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    }

    // --- Actions ---

    window.changeRole = async function(userId, currentRole) {
        // Normalize current role for display
        const displayRole = (currentRole || 'user').toLowerCase();
        
        let newRole = prompt(`Enter new role for user (current: ${displayRole}).\nValid roles: user, admin, superadmin`);
        if (!newRole) return;
        
        newRole = newRole.trim().toLowerCase();
        const validRoles = ['user', 'admin', 'superadmin'];
        
        if (!validRoles.includes(newRole)) {
            showToast('Invalid role. Must be one of: user, admin, superadmin', 'warning');
            return;
        }

        if (newRole === displayRole) {
            showToast('User already has this role.', 'warning');
            return;
        }

        if (!confirm(`Are you sure you want to change this user's role from "${displayRole}" to "${newRole}"?`)) {
            return;
        }

        try {
            // Using the correct backend endpoint structure
            const data = await apiFetch('/users/role', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, newRole })
            });

            if (data.success) {
                showToast(data.message || `Role updated to ${newRole}`, 'success');
                // Refresh the table to show changes
                fetchUsers();
            } else {
                showToast(data.message || 'Failed to update role', 'error');
            }
        } catch (error) {
            console.error('Role update error:', error);
            showToast(error.message || 'An error occurred while updating role.', 'error');
        }
    };

    window.toggleStatus = async function(userId, currentStatus) {
        const action = currentStatus ? 'deactivate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            const data = await apiFetch('/users/status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, isActive: !currentStatus })
            });

            if (data.success) {
                showToast(data.message || `User ${action}d successfully`, 'success');
                fetchUsers();
            } else {
                showToast(data.message || 'Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Status update error:', error);
            showToast(error.message || 'An error occurred while updating status.', 'error');
        }
    };

    window.deleteUser = async function(userId) {
        if (!confirm('Are you sure you want to PERMANENTLY delete this user? This action cannot be undone.')) return;

        try {
            const data = await apiFetch(`/users/${userId}`, { method: 'DELETE' });
            if (data.success) {
                showToast(data.message, 'success');
                fetchUsers();
            } else {
                showToast(data.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('An error occurred.', 'error');
        }
    };

    // --- Event Listeners ---

    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchUsers();
        }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchUsers();
        }
    });

    // Simple debounce for search
    let searchTimeout;
    if (searchInput) searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchQuery = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            currentPage = 1; // Reset to page 1 on search
            fetchUsers();
        }, 500);
    });

    // --- Init ---
    fetchUsers();

});
