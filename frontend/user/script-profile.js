document.addEventListener('DOMContentLoaded', () => {
    // Initialize
    if (typeof loadSidebar === 'function') loadSidebar();
    
    const profileForm = document.getElementById('profile-form');
    const avatarInput = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');
    
    // Initial data load
    fetchProfile();
    fetchStats();
    
    // Poll stats
    setInterval(fetchStats, 30000);

    // --- Functions ---

    async function fetchProfile() {
        try {
            let user = null;
            if (window.getUserProfile) {
                user = await window.getUserProfile({ forceRefresh: true });
            } else {
                const data = await window.apiFetch('/users/profile');
                if (data && data.success && data.user) {
                    user = data.user;
                }
            }

            if (user) {
                
                // Populate basic fields
                setVal('name', user.name);
                setVal('email', user.email);
                setVal('username', user.username);
                
                // ✅ FIX 1: Populate University ID and Department (Root Level Fields)
                setVal('universityId', user.universityId); 
                setVal('department', user.department);
                
                const roleDisplay = document.getElementById('role-display');
                if(roleDisplay) roleDisplay.textContent = user.role ? user.role.toUpperCase() : 'USER';
                
                // Populate Department Quiz Code
                setVal('linkedAdminCode', user.linkedAdminCode);

                // Populate profile fields
                if (user.profile) {
                    const fields = ['age', 'phone', 'college', 'course', 'year', 'state', 'city', 'address'];
                    fields.forEach(field => {
                        setVal(field, user.profile[field]);
                    });
                    
                    if (user.profile.avatar && avatarPreview) {
                        avatarPreview.src = user.profile.avatar;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            if(window.showToast) window.showToast('Error loading profile', 'error');
        }
    }

    function setVal(id, val) {
        const el = document.getElementById(id);
        if(el) el.value = val || '';
    }

    async function fetchStats() {
        try {
            const res = await window.apiFetch('/users/stats');
            if (res && res.success && res.stats) {
                const s = res.stats;
                setText('stat-quizzes', s.totalQuizzes || s.quizzesCompleted || 0);
                setText('stat-score', s.totalScore || 0);
                setText('stat-certificates', s.certificates || s.certificatesEarned || 0);
                setText('stat-rank', s.globalRank || '--');
                
                const lu = document.getElementById('last-updated');
                if (lu) {
                    const now = new Date();
                    lu.textContent = 'Last synced: ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
        } catch (e) {
            console.error('Error fetching stats:', e);
        }
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if(el) el.textContent = text;
    }

    // Handle Avatar Preview
    if(avatarInput) {
        avatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    if(avatarPreview) avatarPreview.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle Form Submission
    if(profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = profileForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            try {
                const formData = new FormData();
                
                // Collect basic fields if editable
                const linkedAdminCode = document.getElementById('linkedAdminCode');
                if (linkedAdminCode) formData.append('linkedAdminCode', linkedAdminCode.value);

                // ✅ FIX 2: Collect University ID and Department for Saving
                const universityId = document.getElementById('universityId');
                if (universityId) formData.append('universityId', universityId.value);

                const department = document.getElementById('department');
                if (department) formData.append('department', department.value);

                // Collect profile fields
                const fields = ['phone', 'age', 'college', 'course', 'year', 'city', 'state', 'address', 'githubProfile', 'linkedinProfile', 'areasOfInterest'];
                fields.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        formData.append(id, el.value);
                    }
                });

                // Avatar
                if (avatarInput && avatarInput.files[0]) {
                    formData.append('avatar', avatarInput.files[0]);
                }

                // Send Request
                const response = await window.apiFetch('/users/profile', {
                    method: 'PUT',
                    body: formData
                });

                if (response.success) {
                    if(window.showToast) window.showToast('Profile updated successfully!', 'success');
                    
                    // Update local storage
                    if (response.user) {
                        localStorage.setItem('user', JSON.stringify(response.user));
                        
                        // Update osianUserData for avatars
                        try {
                            let osianData = JSON.parse(localStorage.getItem('osianUserData') || '{}');
                            if (response.user.profile && response.user.profile.avatar) {
                                osianData.avatar = response.user.profile.avatar;
                                localStorage.setItem('osianUserData', JSON.stringify(osianData));
                            }
                        } catch(e) {}

                        if (window.initAvatars) window.initAvatars();
                    }
                } else {
                    if(window.showToast) window.showToast(response.message || 'Failed to update profile', 'error');
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                if(window.showToast) window.showToast('An error occurred while updating profile', 'error');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});