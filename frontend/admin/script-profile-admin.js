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
                if(roleDisplay) roleDisplay.textContent = user.role ? user.role.toUpperCase() : 'USER';
                
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
            
            const formData = new FormData();
            
            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : '';
            };

            // Basic fields
            formData.append('name', getVal('name'));
            // Email and Username are usually read-only or handled separately, but we'll include them if the backend allows updates
            // formData.append('email', getVal('email')); 
            // formData.append('username', getVal('username'));

            // Profile fields
            formData.append('age', getVal('age'));
            formData.append('phone', getVal('phone'));
            formData.append('college', getVal('college'));
            formData.append('course', getVal('course'));
            formData.append('year', getVal('year'));
            formData.append('state', getVal('state'));
            formData.append('city', getVal('city'));
            formData.append('currentAddress', getVal('address'));
            
            // Optional fields (if they exist in admin profile form)
            if(document.getElementById('githubProfile')) formData.append('githubProfile', getVal('githubProfile'));
            if(document.getElementById('linkedinProfile')) formData.append('linkedinProfile', getVal('linkedinProfile'));
            if(document.getElementById('areasOfInterest')) formData.append('areasOfInterest', getVal('areasOfInterest'));

            // Avatar
            const file = avatarInput ? avatarInput.files[0] : null;
            if (file) {
                formData.append('avatar', file);
            }

            await updateProfile(formData);
        });
    }

    async function updateProfile(formData) {
        const submitBtn = profileForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        try {
            // apiFetch handles FormData automatically (removes Content-Type header to let browser set boundary)
            const data = await apiFetch('/users/profile', {
                method: 'PUT',
                body: formData
            });
            
            if (data.success) {
                if(window.showToast) window.showToast('Profile updated successfully!', 'success');
                // Update avatar preview if returned
                if (data.user && data.user.profile && data.user.profile.avatar && avatarPreview) {
                     avatarPreview.src = data.user.profile.avatar;
                }
            } else {
                if(window.showToast) window.showToast(data.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            if(window.showToast) window.showToast('An error occurred while updating profile', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    fetchProfile();
});
