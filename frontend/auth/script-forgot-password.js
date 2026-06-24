document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const emailInput = document.getElementById('email');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    
    const otpSection = document.getElementById('otp-section');
    const otpInput = document.getElementById('otp');
    const verifyOtpBtn = document.getElementById('verify-otp-btn');
    const resendOtpBtn = document.getElementById('resend-otp-btn');
    const otpTimerDisplay = document.getElementById('otp-timer');
    const timerCountSpan = document.getElementById('timer-count');
    
    const resetSection = document.getElementById('reset-section');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const resetBtn = document.getElementById('reset-btn');
    const formStatus = document.getElementById('form-status');
    const strengthContainer = document.getElementById('password-strength-container');

    let otpTimerInterval;

    // Use global API_BASE from shared-init.js
    // function apiBase() { ... } removed

    // --- Password Strength Validation ---
    const rules = {
        length: { regex: /.{8,}/, element: document.getElementById('rule-length') },
        uppercase: { regex: /[A-Z]/, element: document.getElementById('rule-uppercase') },
        lowercase: { regex: /[a-z]/, element: document.getElementById('rule-lowercase') },
        number: { regex: /[0-9]/, element: document.getElementById('rule-number') },
        special: { regex: /[@$!%*?&]/, element: document.getElementById('rule-special') }
    };

    if (newPasswordInput) {
        newPasswordInput.addEventListener('focus', () => {
            if (strengthContainer) strengthContainer.style.display = 'block';
        });

        newPasswordInput.addEventListener('input', validatePassword);
    }

    function validatePassword() {
        if (!newPasswordInput) return false;
        const password = newPasswordInput.value;
        let isValid = true;

        for (const key in rules) {
            const rule = rules[key];
            if (!rule.element) continue;
            
            const isMatch = rule.regex.test(password);
            const icon = rule.element.querySelector('i');
            
            if (isMatch) {
                rule.element.style.color = '#28a745'; // Green
                if (icon) icon.className = 'bx bx-check-circle';
            } else {
                rule.element.style.color = '#dc3545'; // Red
                if (icon) icon.className = 'bx bx-x-circle';
                isValid = false;
            }
        }
        
        // Also check if password contains email
        const emailVal = emailInput ? emailInput.value : '';
        if (emailVal && password.toLowerCase().includes(emailVal.toLowerCase())) isValid = false;

        if (resetBtn) {
            resetBtn.disabled = !isValid;
            if (!isValid) {
                resetBtn.style.opacity = '0.6';
                resetBtn.style.cursor = 'not-allowed';
            } else {
                resetBtn.style.opacity = '1';
                resetBtn.style.cursor = 'pointer';
            }
        }
        
        return isValid;
    }

    // --- Step 1: Send OTP ---
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!emailInput.value) {
                if (formStatus) {
                    formStatus.textContent = 'Please enter your email.';
                    formStatus.style.color = 'red';
                }
                return;
            }

            if (sendOtpBtn) {
                sendOtpBtn.disabled = true;
                sendOtpBtn.textContent = 'Sending...';
            }
            if (formStatus) formStatus.textContent = '';

            try {
                const response = await fetch(apiBase() + '/api/auth/forgot-password-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });
                const data = await response.json().catch(() => ({}));
                
                if (formStatus) {
                    formStatus.textContent = data.message || 'If the email exists, a reset OTP has been sent.';
                    formStatus.style.color = 'green';
                }
                
                forgotPasswordForm.style.display = 'none';
                if (otpSection) otpSection.style.display = 'block';
                startOtpTimer();
                if (otpInput) otpInput.focus();

            } catch (error) {
                if (formStatus) {
                    formStatus.textContent = 'Failed to send OTP. Please try again.';
                    formStatus.style.color = 'red';
                }
                if (sendOtpBtn) {
                    sendOtpBtn.disabled = false;
                    sendOtpBtn.textContent = 'Send Reset OTP';
                }
            }
        });
    }

    // --- Step 2: Verify OTP ---
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener('click', async () => {
            const otp = otpInput ? otpInput.value : '';
            if (!otp || otp.length !== 6) {
                if (formStatus) {
                    formStatus.textContent = 'Please enter a valid 6-digit OTP.';
                    formStatus.style.color = 'red';
                }
                return;
            }

            verifyOtpBtn.disabled = true;
            verifyOtpBtn.textContent = 'Verifying...';

            try {
                const response = await fetch(apiBase() + '/api/auth/verify-reset-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: emailInput.value,
                        otp: otp 
                    })
                });
                const data = await response.json();

                if (response.ok) {
                    if (formStatus) {
                        formStatus.textContent = 'OTP verified. Set your new password.';
                        formStatus.style.color = 'green';
                    }
                    if (otpSection) otpSection.style.display = 'none';
                    if (resetSection) resetSection.style.display = 'block';
                    if (newPasswordInput) newPasswordInput.focus();
                } else {
                    throw new Error(data.message || 'Invalid OTP');
                }

            } catch (error) {
                if (formStatus) {
                    formStatus.textContent = error.message;
                    formStatus.style.color = 'red';
                }
                verifyOtpBtn.disabled = false;
                verifyOtpBtn.textContent = 'Verify OTP';
            }
        });
    }

    // --- Resend OTP ---
    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async () => {
            resendOtpBtn.disabled = true;
            resendOtpBtn.textContent = 'Sending...';

            try {
                // Re-use forgot-password-otp endpoint
                const response = await fetch(apiBase() + '/api/auth/forgot-password-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });
                
                if (formStatus) {
                    formStatus.textContent = 'New OTP sent.';
                    formStatus.style.color = 'green';
                }
                startOtpTimer();

            } catch (error) {
                if (formStatus) {
                    formStatus.textContent = 'Failed to resend OTP.';
                    formStatus.style.color = 'red';
                }
                resendOtpBtn.disabled = false;
                resendOtpBtn.textContent = 'Resend OTP';
            }
        });
    }

    // --- Step 3: Reset Password ---
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!validatePassword()) {
                if (formStatus) {
                    formStatus.textContent = 'Please meet all password strength requirements.';
                    formStatus.style.color = 'red';
                }
                return;
            }

            if (newPasswordInput.value !== confirmPasswordInput.value) {
                if (formStatus) {
                    formStatus.textContent = 'Passwords do not match.';
                    formStatus.style.color = 'red';
                }
                return;
            }

            if (resetBtn) {
                resetBtn.disabled = true;
                resetBtn.textContent = 'Resetting...';
            }

            try {
                await apiFetch('/auth/reset-password-otp', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        email: emailInput.value, 
                        otp: otpInput.value, 
                        newPassword: newPasswordInput.value,
                        confirmPassword: confirmPasswordInput.value
                    })
                });

                if (formStatus) {
                    formStatus.textContent = 'Password reset successful! Redirecting to login...';
                    formStatus.style.color = 'green';
                }
                if (resetSection) resetSection.style.display = 'none';
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);

            } catch (error) {
                if (formStatus) {
                    formStatus.textContent = error.message;
                    formStatus.style.color = 'red';
                }
                if (resetBtn) {
                    resetBtn.disabled = false;
                    resetBtn.textContent = 'Reset Password';
                }
            }
        });
    }

    function startOtpTimer() {
        clearInterval(otpTimerInterval);
        let timeLeft = 60;
        resendOtpBtn.disabled = true;
        resendOtpBtn.style.cursor = 'not-allowed';
        resendOtpBtn.style.background = '#6c757d';
        otpTimerDisplay.style.display = 'block';
        timerCountSpan.textContent = timeLeft;

        otpTimerInterval = setInterval(() => {
            timeLeft--;
            timerCountSpan.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(otpTimerInterval);
                resendOtpBtn.disabled = false;
                resendOtpBtn.style.cursor = 'pointer';
                resendOtpBtn.style.background = ''; 
                resendOtpBtn.classList.add('login-btn'); 
                otpTimerDisplay.style.display = 'none';
                resendOtpBtn.textContent = 'Resend OTP';
            }
        }, 1000);
    }
});
