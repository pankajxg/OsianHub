document.addEventListener('DOMContentLoaded', function() {
    console.log('Settings page loaded');
    
    // Check if user is authenticated
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        window.location.href = '/auth/login.html';
        return;
    }
    
    // Initialize page after a short delay to ensure all scripts are loaded
    setTimeout(() => {
        try {
            loadSettings();
            setupEventListeners();
        } catch (error) {
            console.error('Error initializing settings page:', error);
            showToast('Error loading settings page. Please refresh.', 'error');
        }
    }, 100);
});

function loadSettings() {
    console.log('Loading user settings...');
    
    try {
        // Get user data from multiple possible sources
        let user = null;
        
        // Try to get from localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                user = JSON.parse(userData);
                console.log('Found user in localStorage:', user);
            } catch (e) {
                console.error('Error parsing user data from localStorage:', e);
            }
        }
        
        // If no user in localStorage, try to get from API
        if (!user || !user.email) {
            fetchUserDataFromAPI();
            return; // Return early, data will be populated by API call
        }
        
        // Populate form fields
        populateFormFields(user);
        
        // Load theme preference
        loadThemePreference();
        
    } catch (error) {
        console.error('Error in loadSettings:', error);
        showToast('Error loading user data', 'error');
    }
}

async function fetchUserDataFromAPI() {
    console.log('Fetching user data from API...');
    
    try {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        
        if (!token) {
            console.error('No authentication token found');
            showToast('Please login again', 'error');
            setTimeout(() => {
                window.location.href = '/auth/login.html';
            }, 2000);
            return;
        }
        
        // Use apiFetch if available, otherwise use regular fetch
        let response;
        if (window.apiFetch) {
            response = await window.apiFetch('/users/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } else {
            const baseUrl = window.API_BASE || 'https://osianoffical-hfp9.vercel.app/api';
            response = await fetch(`${baseUrl}/users/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            response = await response.json();
        }
        
        if (response && response.success) {
            const user = response.data || response.user;
            
            // Store in localStorage for future use
            localStorage.setItem('user', JSON.stringify(user));
            
            // Populate form fields
            populateFormFields(user);
            
        } else {
            throw new Error(response?.message || 'Failed to fetch user data');
        }
        
    } catch (error) {
        console.error('Error fetching user data:', error);
        
        // Show fallback data if API fails
        showFallbackData();
    }
}

function populateFormFields(user) {
    console.log('Populating form fields with user data');
    
    try {
        // Set profile fields
        if (document.getElementById('full-name')) {
            document.getElementById('full-name').value = user.name || user.fullName || user.username || '';
        }
        
        if (document.getElementById('email')) {
            document.getElementById('email').value = user.email || '';
        }
        
        if (document.getElementById('bio')) {
            document.getElementById('bio').value = user.bio || user.about || '';
        }
        
        // Set avatar if available
        const avatarEl = document.getElementById('settings-avatar');
        if (avatarEl && user.profileImage) {
            avatarEl.src = user.profileImage;
        }
        
        // Update any other fields you have
        if (document.getElementById('username')) {
            document.getElementById('username').value = user.username || '';
        }
        
        if (document.getElementById('phone')) {
            document.getElementById('phone').value = user.phone || user.phoneNumber || '';
        }
        
        if (document.getElementById('college')) {
            document.getElementById('college').value = user.college || user.institution || '';
        }
        
    } catch (error) {
        console.error('Error populating form fields:', error);
    }
}

function showFallbackData() {
    console.log('Showing fallback data');
    
    // Try to get any existing user data from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            populateFormFields(user);
            return;
        } catch (e) {
            console.error('Error parsing fallback data:', e);
        }
    }
    
    // Show placeholder message
    showToast('Could not load user data. Some fields may be empty.', 'warning');
}

function loadThemePreference() {
    try {
        const themeToggle = document.getElementById('theme-toggle');
        
        if (themeToggle) {
            themeToggle.checked = true;
        }

        if (window.setTheme) {
            window.setTheme('dark');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    } catch (error) {
        console.error('Error loading theme preference:', error);
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Profile form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updateProfile(e);
        });
    }
    
    // Password form
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updatePassword(e);
        });
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', function(e) {
            toggleTheme(e);
        });
    }
    
    // Additional listeners for new fields
    const newPasswordField = document.getElementById('new-password');
    if (newPasswordField) {
        newPasswordField.addEventListener('input', validatePasswordStrength);
    }
    
    const confirmPasswordField = document.getElementById('confirm-password');
    if (confirmPasswordField && newPasswordField) {
        confirmPasswordField.addEventListener('input', function() {
            validatePasswordMatch(newPasswordField.value, this.value);
        });
    }
    
    // Bio character counter
    const bioField = document.getElementById('bio');
    if (bioField) {
        bioField.addEventListener('input', updateBioCounter);
        updateBioCounter(); // Initialize counter
    }
}

function updateBioCounter() {
    const bioField = document.getElementById('bio');
    const counter = document.getElementById('bio-counter');
    
    if (bioField && counter) {
        const length = bioField.value.length;
        counter.textContent = `${length}/200 characters`;
        
        // Optional: Change color when approaching limit
        if (length > 180) {
            counter.style.color = '#ef4444';
        } else if (length > 150) {
            counter.style.color = '#f97316';
        } else {
            counter.style.color = '';
        }
    }
}

async function updateProfile(e) {
    console.log('Updating profile...');
    
    const btn = e.target.querySelector('button[type="submit"]');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';
    btn.disabled = true;
    
    try {
        const formData = new FormData();
        
        // Basic fields
        const name = document.getElementById('full-name')?.value || '';
        const bio = document.getElementById('bio')?.value || '';
        const username = document.getElementById('username')?.value || '';
        const phone = document.getElementById('phone')?.value || '';
        const college = document.getElementById('college')?.value || '';
        
        // Optional fields
        const linkedinProfile = document.getElementById('linkedinProfile')?.value || '';
        const githubProfile = document.getElementById('githubProfile')?.value || '';
        const areasOfInterest = document.getElementById('areasOfInterest')?.value || '';
        const linkedAdminCode = document.getElementById('linkedAdminCode')?.value || '';
        
        // Append to FormData
        formData.append('name', name);
        formData.append('bio', bio);
        formData.append('username', username);
        formData.append('phone', phone);
        formData.append('college', college);
        formData.append('linkedinProfile', linkedinProfile);
        formData.append('githubProfile', githubProfile);
        formData.append('areasOfInterest', areasOfInterest);
        if (linkedAdminCode) formData.append('linkedAdminCode', linkedAdminCode);

        // Handle Profile Image
        const avatarInput = document.getElementById('avatar-input');
        if (avatarInput && avatarInput.files && avatarInput.files[0]) {
            formData.append('avatar', avatarInput.files[0]);
        }
        
        // Validate required fields
        if (!name.trim()) {
            throw new Error('Full name is required');
        }
        
        // Get auth token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('authToken');
        
        if (!token) {
            throw new Error('Authentication token missing');
        }
        
        let response;
        
        // Use apiFetch if available
        if (window.apiFetch) {
            // apiFetch handles FormData automatically (omits Content-Type so browser sets boundary)
            response = await window.apiFetch('/users/profile', {
                method: 'PUT',
                body: formData
            });
        } else {
            // Fallback to regular fetch
            const baseUrl = window.API_BASE || 'http://localhost:5000/api';
            const fetchResponse = await fetch(`${baseUrl}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // No Content-Type header for FormData
                },
                body: formData
            });
            
            if (!fetchResponse.ok) {
                throw new Error(`HTTP error! status: ${fetchResponse.status}`);
            }
            
            response = await fetchResponse.json();
        }
        
        if (response && response.success) {
            // Update localStorage
            const existingUser = JSON.parse(localStorage.getItem('user') || '{}');
            const updatedUser = { ...existingUser, ...formData };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // Update sidebar if exists
            updateSidebarUserInfo(updatedUser);
            
            showToast('Profile updated successfully!', 'success');
            
        } else {
            throw new Error(response?.message || 'Failed to update profile');
        }
        
    } catch (error) {
        console.error('Profile update error:', error);
        showToast(error.message || 'Error updating profile. Please try again.', 'error');
        
    } finally {
        // Always restore button state
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function updatePassword(e) {
    console.log('Updating password...');
    
    const btn = e.target.querySelector('button[type="submit"]');
    if (!btn) return;
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Updating...';
    btn.disabled = true;
    
    try {
        const currentPassword = document.getElementById('current-password')?.value || '';
        const newPassword = document.getElementById('new-password')?.value || '';
        const confirmPassword = document.getElementById('confirm-password')?.value || '';
        
        // Validate passwords
        if (!currentPassword || !newPassword || !confirmPassword) {
            throw new Error('All password fields are required');
        }
        
        if (newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        
        if (newPassword !== confirmPassword) {
            throw new Error('New passwords do not match');
        }
        
        // Validate password strength
        if (!validatePasswordStrength(newPassword)) {
            throw new Error('Password is too weak. Use a stronger password.');
        }
        
        // Get auth token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('authToken');
        
        if (!token) {
            throw new Error('Authentication token missing');
        }
        
        let response;
        
        if (window.apiFetch) {
            response = await window.apiFetch('/auth/update-password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
        } else {
            const baseUrl = window.API_BASE || 'https://osianoffical-hfp9.vercel.app/api';
            const fetchResponse = await fetch(`${baseUrl}/auth/update-password`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            if (!fetchResponse.ok) {
                throw new Error(`HTTP error! status: ${fetchResponse.status}`);
            }
            
            response = await fetchResponse.json();
        }
        
        if (response && response.success) {
            showToast('Password updated successfully!', 'success');
            e.target.reset(); // Clear the form
            
            // Clear any validation messages
            const strengthText = document.getElementById('strength-text');
            const passwordMatch = document.getElementById('password-match');
            if (strengthText) strengthText.textContent = 'Password strength: ';
            if (passwordMatch) passwordMatch.textContent = '';
            
        } else {
            throw new Error(response?.message || 'Failed to update password');
        }
        
    } catch (error) {
        console.error('Password update error:', error);
        showToast(error.message || 'Error updating password. Please try again.', 'error');
        
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function validatePasswordStrength(password) {
    const strengthText = document.getElementById('strength-text');
    if (!strengthText) return true; // Skip if element doesn't exist
    
    let strength = 0;
    
    // Check length
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Check complexity
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    let message = 'Password strength: ';
    let color = '#ef4444'; // red
    
    if (strength >= 6) {
        message += 'Very Strong';
        color = '#22c55e'; // green
    } else if (strength >= 4) {
        message += 'Strong';
        color = '#22c55e'; // green
    } else if (strength >= 3) {
        message += 'Good';
        color = '#eab308'; // yellow
    } else if (strength >= 2) {
        message += 'Fair';
        color = '#f97316'; // orange
    } else {
        message += 'Weak';
    }
    
    strengthText.textContent = message;
    strengthText.style.color = color;
    
    return strength >= 3; // Require at least "Good" strength
}

function validatePasswordMatch(password, confirmPassword) {
    const matchElement = document.getElementById('password-match');
    if (!matchElement) return;
    
    if (!password && !confirmPassword) {
        matchElement.textContent = '';
        return;
    }
    
    if (password === confirmPassword) {
        matchElement.textContent = '✓ Passwords match';
        matchElement.style.color = '#22c55e';
    } else {
        matchElement.textContent = '✗ Passwords do not match';
        matchElement.style.color = '#ef4444';
    }
}

function toggleTheme(e) {
    if (e && e.target) {
        e.target.checked = true;
    }
    
    try {
        if (window.setTheme) {
            window.setTheme('dark');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
        
        showToast('Theme is set to dark mode', 'success');
        
    } catch (error) {
        console.error('Error toggling theme:', error);
        showToast('Error changing theme', 'error');
    }
}

function updateSidebarUserInfo(user) {
    try {
        // Update sidebar name if element exists
        const sidebarName = document.getElementById('sidebar-name');
        if (sidebarName) {
            sidebarName.textContent = user.name || user.fullName || '';
        }
        
        // Update sidebar email if element exists
        const sidebarEmail = document.getElementById('sidebar-email');
        if (sidebarEmail) {
            sidebarEmail.textContent = user.email || '';
        }
        
        // Update sidebar avatar if element exists
        const sidebarAvatar = document.getElementById('sidebar-avatar');
        if (sidebarAvatar && user.profileImage) {
            sidebarAvatar.src = user.profileImage;
        }
        
    } catch (error) {
        console.error('Error updating sidebar:', error);
    }
}

// Global error handler to prevent page crashes
window.addEventListener('error', function(e) {
    console.error('Global error caught:', e.error);
    
    // Prevent the error from crashing the page
    e.preventDefault();
    
    // Show user-friendly message
    if (typeof showToast === 'function') {
        showToast('An error occurred. Please try again.', 'error');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});

// Helper function for toast notifications
function showToast(message, type = 'info') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    
    // Fallback toast implementation
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create a simple toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
    
    // Add CSS for animation if not already present
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Export functions for global access if needed
window.settingsFunctions = {
    loadSettings,
    updateProfile,
    updatePassword,
    toggleTheme,
    showToast
};
