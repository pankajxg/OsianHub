document.addEventListener("DOMContentLoaded", function() {

    // --- SETUP ---
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    
// Use centralized API helper with automatic fallback

    // --- 1. Check if already logged in ---
    // If a user visits login.html but is already logged in, send them to their dashboard.
    // BUT check if they just logged out (to prevent loops)
    const justLoggedOut = sessionStorage.getItem('justLoggedOut');
    if (justLoggedOut) {
        // Clear the flag and ensure local storage is clean
        sessionStorage.removeItem('justLoggedOut');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Do NOT redirect, stay on login page
    } else {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (token && user) {
            const currentPath = window.location.pathname;
            
            if (user.role === 'superadmin') {
                if (!currentPath.includes('/super-admin/dashboard.html')) {
                    window.location.href = '/frontend/super-admin/dashboard.html';
                    return;
                }
            } else if (user.role === 'admin') {
                if (!currentPath.includes('/admin/dashboard.html')) {
                    window.location.href = '/frontend/admin/dashboard.html';
                    return;
                }
            } else {
                // Default user
                if (!currentPath.includes('/user/dashboard.html')) {
                    window.location.href = '/frontend/user/dashboard.html';
                    return;
                }
            }
            
            // If we are already on the correct dashboard, allow the script to continue
            // (though likely there's nothing else to do on the dashboard from this script)
        }
    }

    // --- 2. Handle Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Prevent default form submission

            if (!emailInput || !passwordInput) return;

            const email = emailInput.value;
            const password = passwordInput.value;

            // Clear previous errors
            if (errorMessage) {
                errorMessage.textContent = '';
                errorMessage.style.display = 'none';
            }
            
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Logging in...';

            try {
                const data = await apiFetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                if (!data) throw new Error('Unable to reach server. Please try again.');

                // --- THIS IS THE CRITICAL FIX ---
                // Check that the API returned BOTH token and user
                if (data.token && data.user) {

                    // Check for unapproved admin
                    if (data.user.role === 'admin' && !data.user.isApproved) {
                         const msg = 'Your admin account is pending approval. Please contact support.';
                         if (typeof showToast === 'function') {
                             showToast(msg, 'error');
                         } else if (errorMessage) {
                            errorMessage.textContent = msg;
                            errorMessage.style.display = 'block';
                            errorMessage.style.color = '#e63946';
                         }
                         submitButton.disabled = false;
                         submitButton.textContent = 'Login';
                         return;
                    }

                    // 1. Save the token string
                    localStorage.setItem('token', data.token);
                    
                    // 2. Save the user object (as a string)
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    if (typeof showToast === 'function') {
                        showToast('Login successful! Redirecting...', 'success');
                    }

                    // 3. Redirect to the correct dashboard based on role
                    setTimeout(() => {
                        if (data.user.role === 'superadmin') {
                            window.location.href = '/frontend/super-admin/dashboard.html';
                        } else if (data.user.role === 'admin') {
                            window.location.href = '/frontend/admin/dashboard.html';
                        } else {
                            window.location.href = '/frontend/user/dashboard.html';
                        }
                    }, 1000);

                } else {
                    // This handles if the server is misconfigured
                    throw new Error('Login failed: Invalid response from server.');
                }

            } catch (error) {
                // Check for redirect (Account not verified)
                if (error.redirect) {
                     if (error.email) {
                         localStorage.setItem('pendingVerificationEmail', error.email);
                     }
                     
                     const msg = error.message || 'Account not verified.';
                     if (typeof showToast === 'function') {
                        showToast(msg + ' Redirecting to verification...', 'warning');
                     } else if (errorMessage) {
                        errorMessage.innerHTML = `${msg} <br> <a href="verify-otp.html" style="color: var(--primary); font-weight: 600; text-decoration: underline; margin-top: 5px; display: inline-block;">Verify OTP</a>`;
                        errorMessage.style.display = 'block';
                        errorMessage.style.color = '#e63946';
                     }
                     
                     // Redirect after a short delay to allow user to see the message
                     setTimeout(() => {
                         window.location.href = 'verify-otp.html';
                     }, 1500);
                     
                     // Re-enable the button
                     submitButton.disabled = false;
                     submitButton.textContent = 'Login';
                     return;
                }

                // Show error message to the user
                if (typeof showToast === 'function') {
                    showToast(error.message || 'Login failed', 'error');
                } else if (errorMessage) {
                    errorMessage.textContent = error.message;
                    errorMessage.style.display = 'block';
                }
                console.error('Login error:', error);
                
                // Re-enable the button
                submitButton.disabled = false;
                submitButton.textContent = 'Login';
            }
        });
    }
});
