document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const avatarInput = document.getElementById('avatar-input');
    const avatarPreview = document.getElementById('avatar-preview');
    const token = localStorage.getItem('token');

    // Auth check handled by auth-guard
    // if (!token) { ... }

    // Fetch Profile Data
    async function fetchProfile() {
        try {
            let user = null;
            if (window.getUserProfile) {
                user = await window.getUserProfile({});
            } else {
                const data = await apiFetch('/users/profile');
                if (data && data.success && data.user) {
                    user = data.user;
                }
            }

            if (user) {
                
                // Populate basic fields
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if(el) el.value = val || '';
                };

                setVal('name', user.name);
                setVal('email', user.email);
                setVal('username', user.username);
                
                const roleDisplay = document.getElementById('role-display');
                if(roleDisplay) roleDisplay.textContent = user.role ? user.role.toUpperCase() : 'SUPER ADMIN';
                
                // Populate profile fields
                if (user.profile) {
                    setVal('age', user.profile.age);
                    setVal('phone', user.profile.phone);
                    setVal('college', user.profile.college);
                    setVal('course', user.profile.course);
                    setVal('year', user.profile.year);
                    setVal('state', user.profile.state);
                    setVal('city', user.profile.city);
                    setVal('address', user.profile.currentAddress);
                    
                    if (user.profile.avatar && avatarPreview) {
                        avatarPreview.src = user.profile.avatar;
                    }
                }
            } else {
                if(window.showToast) window.showToast('Failed to load profile data', 'error');
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            if(window.showToast) window.showToast('Error loading profile', 'error');
        }
    }

    // Handle File Selection for Preview
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
                
                // Basic info (some might be read-only but we send name just in case)
                // formData.append('name', document.getElementById('name').value); 
                
                // Profile Fields
                const fields = ['phone', 'age', 'college', 'course', 'year', 'city', 'state', 'address'];
                fields.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        formData.append(id, el.value);
                    }
                });

                // Avatar
                const avatarInput = document.getElementById('avatar-input');
                if (avatarInput && avatarInput.files[0]) {
                    formData.append('avatar', avatarInput.files[0]);
                }

                // Debug: Log FormData contents
                for (let [key, value] of formData.entries()) {
                    console.log(key, value);
                }

                // Send Request
                const response = await apiFetch('/users/profile', {
                    method: 'PUT',
                    body: formData // apiFetch handles headers for FormData
                });

                if (response.success) {
                    if(window.showToast) window.showToast('Profile updated successfully!', 'success');
                    // Update local user data if needed
                    if (response.user) {
                        localStorage.setItem('user', JSON.stringify(response.user));
                        
                        // Also update osianUserData to ensure initAvatars picks up the change
                        try {
                            let osianData = JSON.parse(localStorage.getItem('osianUserData') || '{}');
                            if (response.user.profile && response.user.profile.avatar) {
                                osianData.avatar = response.user.profile.avatar;
                                localStorage.setItem('osianUserData', JSON.stringify(osianData));
                            }
                        } catch(e) { console.error('Error updating osianUserData:', e); }

                        // Update sidebar avatar immediately
                        if (window.initAvatars) window.initAvatars();

                        // Update navbar avatar if it exists
                        const navAvatar = document.getElementById('nav-avatar');
                        if (navAvatar && response.user.profile && response.user.profile.avatar) {
                            // Check if it's an img or div
                            if (navAvatar.tagName === 'IMG') {
                                navAvatar.src = response.user.profile.avatar;
                            } else {
                                // It's a div, replace content or background
                                navAvatar.innerHTML = `<img src="${response.user.profile.avatar}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                            }
                        }
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

    /* 
    // Old updateProfile function (removed as we use event listener directly)
    async function updateProfile(payload) { ... }
    */

    fetchProfile();
});
