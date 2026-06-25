document.addEventListener('DOMContentLoaded', () => {
    const quizzesList = document.getElementById('quizzes-list');
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = window.getRedirectUrl ? window.getRedirectUrl('/frontend/auth/login.html') : '/frontend/auth/login.html';
        return;
    }

    fetchQuizzes();

    async function fetchQuizzes() {
        if (!quizzesList) return;
        try {
            const data = await apiFetch('/quizzes/assigned/me');

            if (data.success) {
                renderQuizzes(data.quizzes);
            } else {
                quizzesList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Failed to load quizzes.</div>';
            }
        } catch (error) {
            console.error('Error fetching quizzes:', error);
            quizzesList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">Error connecting to server.</div>';
        }
    }

    function renderQuizzes(quizzes) {
        if (!quizzesList) return;
        quizzesList.innerHTML = '';

        if (!quizzes || quizzes.length === 0) {
            quizzesList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);">No quizzes available at the moment.</div>';
            return;
        }

        quizzes.forEach(quiz => {
            const categoryName = quiz.category ? quiz.category.name : 'General';
            const isPaid = quiz.isPaid;
            const priceTag = isPaid ? `<span class="badge badge-paid" style="background: rgba(249, 245, 134, 0.1); color: var(--osian-yellow); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">Paid</span>` : `<span class="badge badge-free" style="background: rgba(134, 253, 232, 0.1); color: var(--osian-mint); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">Free</span>`;
            const difficultyColor = quiz.difficulty === 'Easy' ? '#00c853' : (quiz.difficulty === 'Intermediate' ? '#ffd600' : '#ff1744');
            
            // Create proper quiz card structure matching dashboard
            const card = document.createElement('div');
            card.className = 'quiz-card'; // Use dashboard class
            
            let actionButton = '';
            if (quiz.attempted) {
                actionButton = `<span class="btn" style="background: #333; color: #888; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: not-allowed;">Already Attempted</span>`;
                // No click handler
            } else if (quiz.isPaid && !quiz.isPurchased) {
                actionButton = `<button class="btn btn-buy" data-quiz-id="${quiz._id}" style="background: linear-gradient(135deg, var(--osian-yellow), #f59e0b); color: var(--osian-dark); padding: 0.5rem 1.5rem; border: none; border-radius: 6px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;"><i class='bx bx-lock-open-alt'></i> Buy Now</button>`;
                
                // Add click handler for buying
                setTimeout(() => {
                    const btn = card.querySelector('.btn-buy');
                    if(btn) btn.onclick = (e) => {
                        e.stopPropagation();
                        initiatePayment(quiz);
                    };
                }, 0);
            } else {
                actionButton = `<span class="btn" style="background: linear-gradient(135deg, var(--osian-cyan), var(--osian-mint)); color: var(--osian-dark); padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 600; font-size: 0.9rem;">Start Quiz</span>`;
                // On click -> start quiz
                card.onclick = () => window.location.href = `attempt-quiz.html?id=${quiz._id}`;
            }

            card.innerHTML = `
                <div class="quiz-info" style="display: flex; gap: 1rem; align-items: flex-start;">
                    <img src="${quiz.coverImage || '/frontend/assets/technical-lead.svg'}" alt="Quiz" class="quiz-icon" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;" loading="lazy" onerror="this.src='/frontend/assets/technical-lead.svg'">
                    <div class="quiz-details" style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-main); font-size: 1.1rem;">${quiz.title}</h4>
                        <div class="quiz-badges" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span class="badge" style="background: rgba(255,255,255,0.1); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${categoryName}</span>
                            ${priceTag}
                        </div>
                        <div class="quiz-meta" style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-muted);">
                            <span><i class='bx bx-time'></i> ${quiz.duration}m</span>
                            <span><i class='bx bx-bar-chart-alt-2' style="color: ${difficultyColor}"></i> ${quiz.difficulty}</span>
                            <span><i class='bx bx-question-mark'></i> ${quiz.questions ? quiz.questions.length : 0} Qs</span>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 1.5rem; text-align: right;">
                    ${actionButton}
                </div>
            `;
            quizzesList.appendChild(card);
        });
    }

    async function loadRazorpay() {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    }

    async function initiatePayment(quiz) {
        try {
            const isLoaded = await loadRazorpay();
            if (!isLoaded) {
                if (window.showToast) window.showToast('Failed to load payment gateway. Please check your internet connection.', 'error');
                return;
            }

            // Get Key
            const keyRes = await apiFetch('/payments/get-key');
            if (!keyRes.keyId) {
                if (window.showToast) window.showToast('Payment configuration missing.', 'error');
                return;
            }

            // Create Order
            const orderRes = await apiFetch('/payments/create-order', 'POST', { quizId: quiz._id });
            if (!orderRes.success) {
                if (window.showToast) window.showToast(orderRes.message || 'Failed to create order', 'error');
                return;
            }

            const options = {
                key: keyRes.keyId,
                amount: orderRes.order.razorpayOrder.amount,
                currency: orderRes.order.razorpayOrder.currency,
                name: 'OSIAN Quiz',
                description: `Purchase ${quiz.title}`,
                image: '/frontend/assets/logo.png', // Fallback or use a valid logo
                order_id: orderRes.order.razorpayOrder.id,
                handler: async function (response) {
                    try {
                        const verifyRes = await apiFetch('/payments/verify-payment', 'POST', {
                            orderId: orderRes.order.orderId,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            status: 'success'
                        });

                        if (verifyRes.success) {
                            if (window.showToast) window.showToast('Payment successful! You can now start the quiz.', 'success');
                            fetchQuizzes(); // Reload to update UI
                        } else {
                            if (window.showToast) window.showToast('Payment verification failed. Please contact support.', 'error');
                        }
                    } catch (error) {
                        console.error('Verification error:', error);
                        if (window.showToast) window.showToast('Payment verification error.', 'error');
                    }
                },
                prefill: {
                    name: JSON.parse(localStorage.getItem('user') || '{}').name || '',
                    email: JSON.parse(localStorage.getItem('user') || '{}').email || '',
                    contact: ''
                },
                theme: {
                    color: '#0ea5e9'
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response){
                if (window.showToast) window.showToast('Payment Failed: ' + response.error.description, 'error');
            });
            rzp.open();

        } catch (error) {
            console.error('Payment error:', error);
            if (window.showToast) window.showToast('An error occurred during payment initiation.', 'error');
        }
    }
});
