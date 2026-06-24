document.addEventListener("DOMContentLoaded", function() {

    // Auth check is handled by auth-guard.js, but we can keep a secondary check or rely on apiFetch handling 401.
    // However, the manual check here redirects to 'login.html' relatively, which is wrong.
    // Let's rely on auth-guard.js for the initial check.
    
    const form = document.getElementById('notification-form');
    
    if (form) {
        const submitButton = form.querySelector('button[type="submit"]');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const recipient = document.getElementById('recipient').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;

            submitButton.disabled = true;
            submitButton.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Sending...`;

            try {
                // Use apiFetch
                const result = await apiFetch('/notifications/send', {
                    method: 'POST',
                    body: JSON.stringify({
                        recipient,
                        subject,
                        message
                    })
                });

                // notificationController returns { message: "..." } on 201 success
                // apiFetch throws if status is not OK.
                // So if we are here, it is success.
                if (result.message) {
                    if(window.showToast) window.showToast(result.message, 'success');
                    form.reset();
                } else if (result.success) {
                    if(window.showToast) window.showToast('Notification sent successfully!', 'success');
                    form.reset();
                } else {
                     throw new Error(result.message || 'Failed to send notification.');
                }

            } catch (error) {
                console.error('Error sending notification:', error);
                if(window.showToast) window.showToast(`Error: ${error.message}`, 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = `<i class='bx bx-send'></i> Send Notification Now`;
            }
        });
    }
});
