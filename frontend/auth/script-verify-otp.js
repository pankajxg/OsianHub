document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verify-form');
    const emailInput = document.getElementById('email');
    const otpInput = document.getElementById('otp');
    const resendBtn = document.getElementById('resend-btn');
    const messageArea = document.getElementById('message-area');
    const timerMsg = document.getElementById('timer-msg');
    const countdownSpan = document.getElementById('countdown');

    // 1. Pre-fill email from localStorage if available
    const storedEmail = localStorage.getItem('pendingVerificationEmail');
    if (storedEmail) {
        emailInput.value = storedEmail;
    }

    // Helper to show messages
    function showMessage(msg, type) {
        messageArea.textContent = msg;
        messageArea.style.display = 'block';
        if (type === 'error') {
            messageArea.style.color = '#dc3545';
        } else {
            messageArea.style.color = '#28a745';
        }
    }

    // 2. Handle Verification
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            const otp = otpInput.value.trim();

            if (!email || !otp) {
                showMessage('Please enter both email and OTP.', 'error');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verifying...';
            messageArea.style.display = 'none';

            try {
                const data = await apiFetch('/auth/verify-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email, otp })
                });

                // Success!
                showMessage('Verification successful! Logging you in...', 'success');
                
                // Store token and user data
                if (data.token && data.user) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Clear the pending email
                    localStorage.removeItem('pendingVerificationEmail');

                    // Redirect based on role
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
                    // Fallback if no token returned (should not happen with correct backend)
                    window.location.href = 'login.html';
                }

            } catch (error) {
                showMessage(error.message || 'Verification failed. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Verify Account';
            }
        });
    }

    // 3. Handle Resend OTP
    let timerInterval;
    
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            if (!email) {
                showMessage('Please enter your email address to resend OTP.', 'error');
                return;
            }

            resendBtn.disabled = true;
            resendBtn.style.opacity = '0.5';
            resendBtn.style.cursor = 'not-allowed';

            try {
                await apiFetch('/auth/resend-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });

                showMessage('A new OTP has been sent to your email.', 'success');
                startTimer();

            } catch (error) {
                showMessage(error.message || 'Failed to resend OTP.', 'error');
                // Re-enable button on error if not rate-limited
                if (!error.message.includes('wait')) {
                    resendBtn.disabled = false;
                    resendBtn.style.opacity = '1';
                    resendBtn.style.cursor = 'pointer';
                } else {
                    // If rate limited, just start timer anyway
                    startTimer();
                }
            }
        });
    }

    function startTimer() {
        let timeLeft = 30;
        resendBtn.style.display = 'none';
        timerMsg.style.display = 'block';
        countdownSpan.textContent = timeLeft;

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            countdownSpan.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerMsg.style.display = 'none';
                resendBtn.style.display = 'inline-block';
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
                resendBtn.style.cursor = 'pointer';
            }
        }, 1000);
    }
});