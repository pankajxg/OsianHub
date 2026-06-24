document.addEventListener('DOMContentLoaded', function() {
    // State
    let state = {
        view: 'categories', // categories, topics, quizzes
        selectedCategory: null,
        selectedTopic: null,
        quizzes: []
    };

    // Elements
    const views = {
        categories: document.getElementById('categories-view'),
        topics: document.getElementById('topics-view'),
        quizzes: document.getElementById('quizzes-view')
    };
    
    const grids = {
        categories: document.getElementById('categories-grid'),
        topics: document.getElementById('topics-grid'),
        quizzes: document.getElementById('quizzes-grid')
    };

    const breadcrumbs = document.getElementById('quiz-breadcrumbs');
    const backBtn = document.getElementById('breadcrumb-back');
    const breadcrumbText = document.getElementById('breadcrumb-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Initialize
    init();

    async function init() {
        const categories = await loadCategories();
        
        // Check URL params for auto-navigation
        const urlParams = new URLSearchParams(window.location.search);
        const catId = urlParams.get('category');
        
        if (catId && categories) {
            const cat = categories.find(c => (c._id || c.id) === catId);
            if (cat) {
                // Auto-select category
                selectCategory(cat._id || cat.id, cat.name);
            }
        }
        
        // Event Listeners
        if (backBtn) {
            backBtn.addEventListener('click', handleBack);
        }

        const searchInput = document.getElementById('quiz-search');
        if (searchInput) searchInput.addEventListener('input', filterQuizzes);
        
        const diffFilter = document.getElementById('difficulty-filter');
        if (diffFilter) diffFilter.addEventListener('change', filterQuizzes);
    }

    function switchView(viewName) {
        state.view = viewName;
        
        // Hide all views
        Object.values(views).forEach(el => {
            if (el) el.style.display = 'none';
        });

        // Show target view
        if (views[viewName]) {
            views[viewName].style.display = 'block';
        }

        // Update Breadcrumbs
        if (viewName === 'categories') {
            breadcrumbs.style.display = 'none';
        } else {
            breadcrumbs.style.display = 'flex';
            if (viewName === 'topics') {
                breadcrumbText.textContent = 'Back to Categories';
            } else if (viewName === 'quizzes') {
                breadcrumbText.textContent = state.selectedTopic 
                    ? `Back to ${state.selectedTopic}` 
                    : `Back to ${state.selectedCategory ? state.selectedCategory.name : 'Categories'}`;
            }
        }
    }

    function handleBack() {
        if (state.view === 'quizzes') {
            if (state.selectedTopic) {
                switchView('topics');
            } else {
                switchView('categories');
                state.selectedCategory = null;
            }
        } else if (state.view === 'topics') {
            switchView('categories');
            state.selectedCategory = null;
            state.selectedTopic = null;
        }
    }

    async function loadCategories() {
        setLoading(true);
        try {
            const data = await window.apiFetch('/quizzes/categories?type=global');
            if (data && data.success && data.categories) {
                renderCategories(data.categories);
                return data.categories;
            } else {
                renderEmpty(grids.categories, 'No categories found');
                return [];
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            renderEmpty(grids.categories, 'Error loading categories');
            return [];
        } finally {
            setLoading(false);
        }
    }

    function renderCategories(categories) {
        if (!categories || categories.length === 0) {
            renderEmpty(grids.categories, 'No categories found');
            return;
        }

        grids.categories.innerHTML = categories.map(cat => {
            const hasImage = cat.image && (cat.image.startsWith('http') || cat.image.startsWith('/') || cat.image.startsWith('data:'));
            const iconClass = cat.icon || 'bx bx-folder';

            return `
            <div class="level-card category-card" onclick="selectCategory('${cat._id}', '${cat.name.replace(/'/g, "\\'")}')">
                <div class="category-visual">
                    ${hasImage 
                        ? `<img src="${cat.image}" alt="${cat.name}" class="category-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="fallback-icon" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">
                                <i class="${iconClass}"></i>
                           </div>`
                        : `<i class="${iconClass}"></i>`
                    }
                </div>
                <div class="category-info">
                    <h4>${cat.name}</h4>
                    <p>${cat.description || ''}</p>
                </div>
            </div>
            `;
        }).join('');
    }

    window.selectCategory = async function(id, name) {
        state.selectedCategory = { id, name };
        
        // Load Topics (Fields)
        setLoading(true);
        try {
            const data = await window.apiFetch(`/quizzes/categories/${id}/fields`);
            if (data && data.success && data.fields && data.fields.length > 0) {
                renderTopics(data.fields);
                switchView('topics');
            } else {
                // No topics, go straight to quizzes
                loadQuizzes({ category: id });
            }
        } catch (error) {
            console.error('Error loading topics:', error);
            // Fallback to loading quizzes directly
            loadQuizzes({ category: id });
        } finally {
            setLoading(false);
        }
    };

    function renderTopics(topics) {
        if (!topics || topics.length === 0) {
            switchView('categories'); // Should not happen if check above works
            return;
        }

        grids.topics.innerHTML = topics.map(topic => {
            // Topics might just be strings or objects depending on backend
            const topicName = typeof topic === 'string' ? topic : topic.name;
            const topicId = typeof topic === 'string' ? topic : topic._id; // Or just use name if no ID

            return `
            <div class="level-card topic-card" onclick="selectTopic('${topicName.replace(/'/g, "\\'")}')">
                <div class="category-visual" style="height: 100px;">
                    <i class='bx bx-library' style="font-size: 2.5rem;"></i>
                </div>
                <div class="category-info">
                    <h4>${topicName}</h4>
                </div>
            </div>
            `;
        }).join('');
    }

    window.selectTopic = function(topicName) {
        state.selectedTopic = topicName;
        loadQuizzes({ category: state.selectedCategory.id, field: topicName });
    };

    async function loadQuizzes(params) {
        setLoading(true);
        switchView('quizzes');
        grids.quizzes.innerHTML = ''; // Clear previous

        try {
            const query = new URLSearchParams({ type: 'Global' });
            if (params.category) query.set('category', params.category);
            if (params.field) query.set('field', params.field);

            const data = await window.apiFetch('/quizzes?' + query.toString());
            
            if (data && data.success && data.quizzes) {
                state.quizzes = data.quizzes;
                renderQuizzes(data.quizzes);
            } else {
                renderEmpty(grids.quizzes, 'No quizzes found in this section.');
            }
        } catch (error) {
            console.error('Error loading quizzes:', error);
            renderEmpty(grids.quizzes, 'Error loading quizzes.');
        } finally {
            setLoading(false);
        }
    }

    function renderQuizzes(quizzes) {
        if (!quizzes || quizzes.length === 0) {
            renderEmpty(grids.quizzes, 'No quizzes found.');
            return;
        }
        
        grids.quizzes.innerHTML = quizzes.map(quiz => {
            const quizId = quiz._id || quiz.id;
            let actionBtn = `<a href="attempt-quiz.html?id=${quizId}" class="start-btn">Start Quiz</a>`;
            let cardClick = `onclick="window.location.href='attempt-quiz.html?id=${quizId}'"`;
            
            if (quiz.attempted) {
                actionBtn = `<button class="start-btn" style="background: #333; cursor: not-allowed;" disabled>Already Attempted</button>`;
                cardClick = ''; 
            } else if (quiz.isPaid && !quiz.isPurchased && (quiz.price > 0)) {
                 actionBtn = `<button class="start-btn" style="background: var(--osian-gold, #FFD700); color: #000;" onclick="event.stopPropagation(); window.initiatePurchase('${quizId}', '${quiz.price || 0}')">Unlock - ₹${quiz.price || 0}</button>`;
                 cardClick = `onclick="window.initiatePurchase('${quizId}', '${quiz.price || 0}')"`;
            }

            return `
            <div class="quiz-card" ${cardClick}>
                <div class="quiz-header">
                    <div class="quiz-icon">
                        <i class='bx bx-brain'></i>
                    </div>
                    <span class="quiz-badge badge-${(quiz.difficulty || 'beginner').toLowerCase()}">${quiz.difficulty || 'General'}</span>
                </div>
                <h3 class="quiz-title">${quiz.title || 'Untitled Quiz'}</h3>
                <p class="quiz-desc">${quiz.description || 'No description available.'}</p>
                <div class="quiz-meta">
                    <div class="quiz-meta-item">
                        <i class='bx bx-time'></i> ${quiz.duration || 15}m
                    </div>
                    <div class="quiz-meta-item">
                        <i class='bx bx-question-mark'></i> ${quiz.questions ? quiz.questions.length : 0} Qs
                    </div>
                </div>
                ${actionBtn}
            </div>
            `;
        }).join('');
    }

    function filterQuizzes() {
        const searchTerm = document.getElementById('quiz-search').value.toLowerCase();
        const difficultyFilter = document.getElementById('difficulty-filter').value;
        
        const filtered = state.quizzes.filter(quiz => {
            const matchesSearch = (quiz.title || '').toLowerCase().includes(searchTerm) || 
                                  (quiz.description || '').toLowerCase().includes(searchTerm);
            
            const matchesDifficulty = !difficultyFilter || 
                                      (quiz.difficulty && quiz.difficulty.toLowerCase() === difficultyFilter.toLowerCase());
            
            return matchesSearch && matchesDifficulty;
        });
        
        renderQuizzes(filtered);
    }

    function renderEmpty(container, message) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class='bx bx-ghost' style="font-size: 3rem; color: var(--text-muted);"></i>
                <p style="margin-top: 10px; color: var(--text-muted);">${message}</p>
            </div>
        `;
    }

    function setLoading(isLoading) {
        if (loadingSpinner) loadingSpinner.style.display = isLoading ? 'block' : 'none';
        if (isLoading) {
            // Hide grids while loading? Maybe not necessary if overlay
        }
    }

    // ================= PAYMENTS =================
    window.initiatePurchase = async function(quizId, price) {
        try {
            // 1. Create Order
            const orderRes = await window.apiFetch('/payments/create-order', {
                method: 'POST',
                body: JSON.stringify({ quizId })
            });

            if (!orderRes.success) {
                throw new Error(orderRes.message || 'Failed to create order');
            }

            const { order, isSimulated } = orderRes;

            // HANDLE SIMULATED PAYMENT (Fallback if Razorpay is not configured)
            if (isSimulated) {
                console.log('Processing simulated payment for order:', order.orderId);
                
                // Simulate network delay for better UX
                if (window.showToast) window.showToast('Processing payment...', 'info');
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Directly verify
                const verifyRes = await window.apiFetch('/payments/verify-payment', {
                    method: 'POST',
                    body: JSON.stringify({
                        orderId: order.orderId,
                        paymentId: 'pay_sim_' + Date.now(),
                        signature: 'simulated_signature', 
                        status: 'success'
                    })
                });

                if (verifyRes.success) {
                    if(window.showToast) window.showToast('Payment successful! Quiz unlocked.', 'success');
                    // Reload quizzes to update UI
                    loadQuizzes({ 
                        category: state.selectedCategory ? state.selectedCategory.id : null,
                        field: state.selectedTopic
                    });
                } else {
                    throw new Error(verifyRes.message || 'Payment verification failed');
                }
                return; 
            }
            
            // 2. Get Key (Only for real Razorpay)
            const keyRes = await window.apiFetch('/payments/get-key');
            if (!keyRes.keyId) throw new Error('Failed to load payment configuration');

            // 3. Open Razorpay
            const options = {
                key: keyRes.keyId,
                amount: order.razorpayOrder.amount,
                currency: order.razorpayOrder.currency,
                name: "OSIAN",
                description: `Unlock Quiz: ${order.quiz.title}`,
                order_id: order.razorpayOrder.id,
                handler: async function (response) {
                    // 4. Verify Payment
                    try {
                        const verifyRes = await window.apiFetch('/payments/verify-payment', {
                            method: 'POST',
                            body: JSON.stringify({
                                orderId: order.orderId,
                                paymentId: response.razorpay_payment_id,
                                signature: response.razorpay_signature,
                                status: 'success'
                            })
                        });

                        if (verifyRes.success) {
                            if(window.showToast) window.showToast('Payment successful! Quiz unlocked.', 'success');
                            // Reload quizzes to update UI
                            loadQuizzes({ 
                                category: state.selectedCategory ? state.selectedCategory.id : null,
                                field: state.selectedTopic
                            });
                        } else {
                            throw new Error(verifyRes.message || 'Payment verification failed');
                        }
                    } catch (err) {
                        console.error(err);
                        if(window.showToast) window.showToast('Payment verification failed. Please contact support.', 'error');
                    }
                },
                prefill: {
                    name: JSON.parse(localStorage.getItem('user') || '{}').name || '',
                    email: JSON.parse(localStorage.getItem('user') || '{}').email || '',
                    contact: JSON.parse(localStorage.getItem('user') || '{}').phone || ''
                },
                theme: {
                    color: "#5FFBF1"
                }
            };

            const rzp1 = new Razorpay(options);
            rzp1.on('payment.failed', function (response){
                console.error(response.error);
                if(window.showToast) window.showToast('Payment failed: ' + response.error.description, 'error');
            });
            rzp1.open();

        } catch (error) {
            console.error('Purchase error:', error);
            if(window.showToast) window.showToast(error.message || 'Failed to initiate purchase', 'error');
        }
    };
});
