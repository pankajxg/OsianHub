// Global variables
let userData = {};
let inProgressQuizzes = [];
let quizHistory = [];
let currentPage = 1;
const historyPerPage = 5;
let totalHistoryCount = 0;

document.addEventListener('DOMContentLoaded', function() {
    // Sidebar handled by shared-init.js

    // Load progress data
    loadProgressData();// Global variables
let userData = {};
let inProgressQuizzes = [];
let quizHistory = [];
let currentPage = 1;
const historyPerPage = 5;
let totalHistoryCount = 0;

document.addEventListener('DOMContentLoaded', function() {
    loadProgressData();
    setupEventListeners();
});

function setupEventListeners() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreHistory);
    
    const modalClose = document.getElementById('modal-close');
    if (modalClose) modalClose.addEventListener('click', closeModal);
    
    const modal = document.getElementById('quiz-details-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    }
}

function closeModal() {
    const modal = document.getElementById('quiz-details-modal');
    if (modal) modal.style.display = 'none';
}

// Load progress data
async function loadProgressData() {
    try {
        showLoadingState(true);

        const data = await window.apiFetch('/quizzes/progress');
        
        if (!data || !data.success) {
            throw new Error(data?.message || 'Failed to load data');
        }

        // --- FIX: Robust Data Handling ---
        updateProgressStats(data.stats || {});
        
        inProgressQuizzes = data.in_progress || [];
        displayInProgressQuizzes();
        
        // Ensure history array exists
        quizHistory = data.history || [];
        totalHistoryCount = data.total_history || quizHistory.length;
        
        // Debug Log
        console.log("Loaded History:", quizHistory);

        displayQuizHistory();
        
    } catch (error) {
        console.error('Error loading progress:', error);
        // Show empty states gracefully instead of crashing
        displayQuizHistory(); 
    } finally {
        showLoadingState(false);
    }
}

async function loadMoreHistory() {
    try {
        currentPage++;
        const btn = document.getElementById('load-more-btn');
        if(btn) {
            btn.innerHTML = '<i class="bx bx-loader-circle bx-spin"></i> Loading...';
            btn.disabled = true;
        }

        const data = await window.apiFetch(`/quizzes/history?page=${currentPage}&limit=${historyPerPage}`);
        
        if(data && data.success) {
            const newHistory = data.history || [];
            quizHistory = [...quizHistory, ...newHistory];
            displayQuizHistory();
        }
        
    } catch (error) {
        console.error('Error loading more:', error);
        if(window.showToast) window.showToast("Failed to load more", "error");
    } finally {
        const btn = document.getElementById('load-more-btn');
        if(btn) {
            const remaining = totalHistoryCount - quizHistory.length;
            btn.innerHTML = remaining > 0 ? `<i class='bx bx-refresh'></i> Load More (${remaining})` : "Load More";
            btn.disabled = false;
        }
    }
}

function showLoadingState(isLoading) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
    const list = document.getElementById('history-list');
    if(list) list.style.opacity = isLoading ? '0.5' : '1';
}

function updateProgressStats(stats) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.textContent = val || '0';
    };
    set('total-quizzes', stats.total_quizzes);
    set('in-progress-count', stats.in_progress);
    set('completed-count', stats.completed);
    
    const avgEl = document.getElementById('avg-score');
    if(avgEl) avgEl.textContent = stats.average_score ? `${Math.round(stats.average_score)}%` : '0%';
}

function displayInProgressQuizzes() {
    const list = document.getElementById('inprogress-list');
    const empty = document.getElementById('inprogress-empty');
    if(!list) return;

    if (!inProgressQuizzes || inProgressQuizzes.length === 0) {
        list.innerHTML = '';
        if(empty) empty.style.display = 'block';
        return;
    }
    
    if(empty) empty.style.display = 'none';
    list.innerHTML = inProgressQuizzes.map(q => generateInProgressCard(q)).join('');
}

function generateInProgressCard(quiz) {
    return `
        <div class="progress-card" onclick="openQuizDetails('${quiz.id}', 'inprogress')">
            <div class="progress-icon"><i class='bx ${getQuizIcon(quiz.category)}'></i></div>
            <div class="progress-info">
                <div class="progress-header">
                    <h3 class="progress-title">${quiz.title}</h3>
                    <span class="progress-badge badge-inprogress">In Progress</span>
                </div>
                <div class="progress-meta">
                    <div class="meta-item"><i class='bx bx-category'></i> ${quiz.category || 'General'}</div>
                    <div class="meta-item"><i class='bx bx-time'></i> ${quiz.time_spent || 0}m / ${quiz.time_limit || 30}m</div>
                </div>
            </div>
            <div class="progress-bar-container">
                <div class="progress-label"><span>Progress</span><span>${quiz.progress || 0}%</span></div>
                <div class="progress-track"><div class="progress-fill" style="width: ${quiz.progress || 0}%"></div></div>
            </div>
            <button class="continue-btn" onclick="continueQuiz('${quiz.id}', event)">
                <i class='bx bx-play-circle'></i> Continue
            </button>
        </div>
    `;
}

// --- FIX: Improved History Display ---
function displayQuizHistory() {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');
    const loadMore = document.getElementById('history-pagination'); // Correct ID for container

    if (!list) return;

    // Check if empty
    if (!quizHistory || quizHistory.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block'; // Ensure empty state is visible
        if (loadMore) loadMore.style.display = 'none';
        return;
    }
    
    // Hide empty state if data exists
    if (empty) empty.style.display = 'none';
    
    // Render list
    list.innerHTML = quizHistory.map(q => generateHistoryCard(q)).join('');
    
    // Handle Load More visibility
    if (loadMore) {
        const remaining = totalHistoryCount - quizHistory.length;
        if(remaining > 0) {
            loadMore.style.display = 'flex';
            const btn = document.getElementById('load-more-btn');
            if(btn) btn.innerHTML = `<i class='bx bx-refresh'></i> Load More (${remaining})`;
        } else {
            loadMore.style.display = 'none';
        }
    }
}

function generateHistoryCard(quiz) {
    const score = Math.round(quiz.score || 0); // Ensure number
    const scoreClass = getScoreClass(score);
    const dateStr = quiz.completed_at ? new Date(quiz.completed_at).toLocaleDateString() : 'N/A';
    
    return `
        <div class="history-card" onclick="openQuizDetails('${quiz.id || quiz._id}', 'history')">
            <div class="history-info">
                <h3 class="history-title">${quiz.title}</h3>
                <div class="history-meta">
                    <div class="meta-item"><i class='bx bx-category'></i> ${quiz.category || 'General'}</div>
                    <div class="meta-item"><i class='bx bx-calendar'></i> ${dateStr}</div>
                    <div class="meta-item"><i class='bx bx-award'></i> ${quiz.score_raw || 0}/${quiz.total_marks || 0} pts</div>
                </div>
            </div>
            <div class="score-badge ${scoreClass}">${score}%</div>
            <button class="view-details-btn" onclick="viewQuizResults('${quiz.result_id || quiz.id}', event)">
                <i class='bx bx-show'></i> Details
            </button>
        </div>
    `;
}

function getQuizIcon(cat) {
    if(!cat) return 'bx-question-mark';
    const c = cat.toLowerCase();
    if(c.includes('tech')) return 'bx-chip';
    if(c.includes('code') || c.includes('program')) return 'bx-code-alt';
    if(c.includes('science')) return 'bx-atom';
    if(c.includes('math')) return 'bx-calculator';
    return 'bx-book-open';
}

function getScoreClass(s) {
    if (s >= 80) return 'score-high';
    if (s >= 50) return 'score-med';
    return 'score-low';
}

// Handlers that prevent bubbling
window.continueQuiz = (id, e) => {
    if(e) e.stopPropagation();
    window.location.href = `attempt-quiz.html?id=${id}`; // Direct to attempt
};

window.viewQuizResults = (resultId, e) => {
    if(e) e.stopPropagation();
    // Redirect to results page for full detail
    window.location.href = `quiz-results.html?resultId=${resultId}`;
};

window.openQuizDetails = (id, type) => {
    // Quick modal view logic from previous file can go here
    // Or just redirect for simplicity
    if(type === 'history') {
        const item = quizHistory.find(q => (q.id === id || q._id === id));
        if(item) window.viewQuizResults(item.result_id || item.id);
    } else {
        window.continueQuiz(id);
    }
};
    
    // Setup event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Load more button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreHistory);
    }
    
    // Modal close
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('quiz-details-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
}

function closeModal() {
    const modal = document.getElementById('quiz-details-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Load progress data from API
async function loadProgressData() {
    try {
        const token = localStorage.getItem('token');
        // Note: auth-guard.js should handle redirection if no token, 
        // but we keep this check just in case or for consistency.
        
        // Show loading state
        showLoadingState(true);

        // Fetch progress data from API
        // We use window.apiFetch if available (from auth-guard), otherwise standard fetch
        let data;
        if (window.apiFetch) {
            data = await window.apiFetch('/quizzes/progress');
        } else {
            const baseUrl = window.API_BASE || 'http://localhost:5000/api';
            const response = await fetch(`${baseUrl}/quizzes/progress`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error(`Failed to load progress data: ${response.status}`);
            data = await response.json();
        }

        if (data.success === false) {
             throw new Error(data.message || 'Failed to load progress data');
        }

        // Update stats
        updateProgressStats(data.stats || {});
        
        // Load in-progress quizzes
        inProgressQuizzes = data.in_progress || [];
        displayInProgressQuizzes();
        
        // Load quiz history
        totalHistoryCount = data.total_history || 0;
        quizHistory = data.history || [];
        displayQuizHistory();
        
        if (window.showToast) window.showToast('Progress data loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error loading progress data:', error);
        
        // NO Sample Data Fallback
        if (window.showToast) window.showToast('Failed to load progress data', 'error');
        
        // Show empty states if failed
        const inProgressList = document.getElementById('inprogress-list');
        if (inProgressList) inProgressList.innerHTML = '';
        
        const inProgressEmpty = document.getElementById('inprogress-empty');
        if (inProgressEmpty) inProgressEmpty.style.display = 'block';
        
        const historyList = document.getElementById('history-list');
        if (historyList) historyList.innerHTML = '';
        
        const historyEmpty = document.getElementById('history-empty');
        if (historyEmpty) historyEmpty.style.display = 'block';
    } finally {
        showLoadingState(false);
    }
}

// Load more history
async function loadMoreHistory() {
    try {
        currentPage++;
        
        const loadMoreBtn = document.getElementById('load-more-btn');
        loadMoreBtn.innerHTML = '<i class="bx bx-loader-circle bx-spin"></i> Loading...';
        loadMoreBtn.disabled = true;
        
        // Fetch more history
        let data;
        if (window.apiFetch) {
            data = await window.apiFetch(`/quizzes/history?page=${currentPage}&limit=${historyPerPage}`);
        } else {
            const token = localStorage.getItem('token');
            const baseUrl = window.API_BASE || 'http://localhost:5000/api';
            const response = await fetch(`${baseUrl}/quizzes/history?page=${currentPage}&limit=${historyPerPage}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error(`Failed to load more history: ${response.status}`);
            data = await response.json();
        }

        const newHistory = data.history || [];
        
        // Append to existing history
        quizHistory = [...quizHistory, ...newHistory];
        
        // Display updated history
        displayQuizHistory();
        
        // Update load more button
        const remaining = totalHistoryCount - quizHistory.length;
        if (remaining > 0) {
            loadMoreBtn.innerHTML = `<i class='bx bx-refresh'></i> Load More (${remaining} remaining)`;
        } else {
            document.getElementById('load-more-container').style.display = 'none';
        }
        
        loadMoreBtn.disabled = false;
        
    } catch (error) {
        console.error('Error loading more history:', error);
        if (window.showToast) window.showToast('Failed to load more history', 'error');
        
        const loadMoreBtn = document.getElementById('load-more-btn');
        loadMoreBtn.innerHTML = '<i class="bx bx-refresh"></i> Load More';
        loadMoreBtn.disabled = false;
    }
}

function showLoadingState(isLoading) {
    const spinner = document.getElementById('loading-spinner');
    const sections = document.querySelectorAll('.progress-section');
    
    if (isLoading) {
        if (spinner) spinner.style.display = 'block';
        sections.forEach(s => s.style.opacity = '0.5');
    } else {
        if (spinner) spinner.style.display = 'none';
        sections.forEach(s => s.style.opacity = '1');
    }
}

// Update progress statistics
function updateProgressStats(stats) {
    const totalEl = document.getElementById('total-quizzes');
    const inProgressEl = document.getElementById('in-progress-count');
    const completedEl = document.getElementById('completed-count');
    const avgScoreEl = document.getElementById('avg-score');

    if (totalEl) totalEl.textContent = stats.total_quizzes || '0';
    if (inProgressEl) inProgressEl.textContent = stats.in_progress || '0';
    if (completedEl) completedEl.textContent = stats.completed || '0';
    if (avgScoreEl) avgScoreEl.textContent = stats.average_score ? `${stats.average_score}%` : '0%';
}

// Display in-progress quizzes
function displayInProgressQuizzes() {
    const inProgressList = document.getElementById('inprogress-list');
    const emptyState = document.getElementById('inprogress-empty');
    
    if (!inProgressList) return;

    if (inProgressQuizzes.length === 0) {
        inProgressList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    let inProgressHTML = '';
    inProgressQuizzes.forEach(quiz => {
        inProgressHTML += generateInProgressCard(quiz);
    });
    
    inProgressList.innerHTML = inProgressHTML;
    
    // Add click handlers
    document.querySelectorAll('.progress-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('button')) {
                const quizId = this.dataset.quizId;
                openQuizDetails(quizId, 'inprogress');
            }
        });
    });
}

// Generate in-progress quiz card
function generateInProgressCard(quiz) {
    const progress = quiz.progress || 0;
    const timeSpent = quiz.time_spent || 0;
    const totalTime = quiz.time_limit || 60;
    
    return `
        <div class="progress-card" data-quiz-id="${quiz.id}">
            <div class="progress-icon">
                <i class='bx ${getQuizIcon(quiz.category)}'></i>
            </div>
            
            <div class="progress-info">
                <div class="progress-header">
                    <h3 class="progress-title">${quiz.title}</h3>
                    <span class="progress-badge badge-inprogress">In Progress</span>
                </div>
                
                <div class="progress-meta">
                    <div class="meta-item">
                        <i class='bx bx-category'></i>
                        <span>${quiz.category || 'General'}</span>
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-time'></i>
                        <span>${timeSpent} min / ${totalTime} min</span>
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-question-mark'></i>
                        <span>${quiz.questions_answered || 0}/${quiz.total_questions || 10} questions</span>
                    </div>
                </div>
            </div>
            
            <div class="progress-bar-container">
                <div class="progress-label">
                    <span>Progress</span>
                    <span>${progress}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            
            <button class="continue-btn" onclick="continueQuiz(${quiz.id})">
                <i class='bx bx-play-circle'></i> Continue
            </button>
        </div>
    `;
}

// Display quiz history
function displayQuizHistory() {
    const historyList = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!historyList) return;

    if (quizHistory.length === 0) {
        historyList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    let historyHTML = '';
    quizHistory.forEach(quiz => {
        historyHTML += generateHistoryCard(quiz);
    });
    
    historyList.innerHTML = historyHTML;
    
    // Show load more button if there are more quizzes
    if (loadMoreContainer) {
        if (quizHistory.length < totalHistoryCount) {
            const remaining = totalHistoryCount - quizHistory.length;
            const btn = document.getElementById('load-more-btn');
            if (btn) btn.innerHTML = `<i class='bx bx-refresh'></i> Load More (${remaining} remaining)`;
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
    
    // Add click handlers
    document.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('button')) {
                const quizId = this.dataset.quizId;
                openQuizDetails(quizId, 'history');
            }
        });
    });
}

// Generate history card
function generateHistoryCard(quiz) {
    const score = quiz.score || 0;
    const scoreClass = getScoreClass(score);
    const completionDate = new Date(quiz.completed_at);
    const formattedDate = completionDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const rawTime = quiz.time_taken || quiz.timeTaken || quiz.time_spent || quiz.time_spent_minutes || quiz.timeTakenMinutes || 0;
    const timeMinutes = rawTime && rawTime > 0 ? rawTime : (quiz.duration || quiz.time_limit || 0);
    const timeLabel = timeMinutes ? `${timeMinutes} min` : '—';
    
    return `
        <div class="history-card" data-quiz-id="${quiz.id}">
            <div class="history-info">
                <h3 class="history-title">${quiz.title}</h3>
                <div class="history-meta">
                    <div class="meta-item">
                        <i class='bx bx-category'></i>
                        <span>${quiz.category || 'General'}</span>
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-calendar'></i>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-time'></i>
                        <span>${timeLabel}</span>
                    </div>
                    <div class="meta-item">
                        <i class='bx bx-award'></i>
                        <span>${quiz.score_raw || 0}/${quiz.total_marks || 0} marks</span>
                    </div>
                </div>
            </div>
            
            <div class="score-badge ${scoreClass}">
                ${score}%
            </div>
            
            <button class="view-details-btn" onclick="viewQuizResults('${quiz.result_id || ''}')">
                <i class='bx bx-show'></i> Details
            </button>
        </div>
    `;
}

// Get quiz icon based on category
function getQuizIcon(category) {
    const iconMap = {
        'Technology': 'bx-chip',
        'Science': 'bx-atom',
        'Mathematics': 'bx-calculator',
        'Business': 'bx-briefcase',
        'Programming': 'bx-code',
        'Web Development': 'bx-globe',
        'Data Science': 'bx-data',
        'AI & ML': 'bx-brain'
    };
    
    if (!category) return 'bx-question-mark';
    
    for (const [key, icon] of Object.entries(iconMap)) {
        if (category.toLowerCase().includes(key.toLowerCase())) {
            return icon;
        }
    }
    
    return 'bx-question-mark';
}

// Get score class based on percentage
function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-med';
    return 'score-low';
}

// Continue quiz
window.continueQuiz = async function(quizId) {
    try {
        const quiz = inProgressQuizzes.find(q => q.id == quizId);
        
        if (!quiz) {
            if (window.showToast) window.showToast('Quiz not found', 'error');
            return;
        }
        
        // Show loading
        if (window.showToast) window.showToast(`Continuing "${quiz.title}"...`, 'info');
        
        // Resume quiz session
        let data;
        if (window.apiFetch) {
            data = await window.apiFetch(`/quizzes/${quizId}/resume`, { method: 'POST' });
        } else {
             const token = localStorage.getItem('token');
             const response = await fetch(`/api/quizzes/${quizId}/resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
             if (!response.ok) throw new Error(`Failed to resume quiz: ${response.status}`);
             data = await response.json();
        }
        
        // Redirect to quiz page
        setTimeout(() => {
            window.location.href = window.getRedirectUrl ? window.getRedirectUrl(`/frontend/user/quiz.html?id=${quizId}&session=${data.session_id}&resume=true`) : `/frontend/user/quiz.html?id=${quizId}&session=${data.session_id}&resume=true`;
        }, 1000);
        
    } catch (error) {
        console.error('Error continuing quiz:', error);
        if (window.showToast) window.showToast('Failed to continue quiz', 'error');
    }
}

// View quiz results
window.viewQuizResults = async function(resultId) {
    try {
        if (!resultId) {
            if (window.showToast) window.showToast('Result not found', 'error');
            return;
        }

        const detailContent = document.getElementById('detail-content');
        if (!detailContent) return;

        // Show loading
        detailContent.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="loading-spinner"></div></div>';
        
        // Switch views
        document.getElementById('progress-dashboard-view').style.display = 'none';
        document.getElementById('result-detail-view').style.display = 'block';

        // Fetch result details
        let data;
        if (window.apiFetch) {
            data = await window.apiFetch(`/results/${resultId}`);
        } else {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/results/${resultId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch result');
            data = await response.json();
        }

        if (!data.success) {
            throw new Error(data.message || 'Failed to fetch details');
        }

        const result = data.result;
        const quiz = result.quiz || result.quizId; 
        
        // Calculate Stats
        const percentage = (result.score / result.totalMarks) * 100;
        const isPassed = percentage >= 40;
        const violationsCount = result.violations ? (result.violations.tabSwitches + result.violations.windowBlurs + (result.violations.suspiciousActivity ? 1 : 0)) : 0;
        
        // Render Header
        let html = `
            <div class="result-detail-header">
                <div>
                    <h2 style="color: var(--osian-cyan); margin-bottom: 5px;">${quiz ? quiz.title : 'Quiz Details'}</h2>
                    <p style="color: var(--text-muted);">Completed on: ${new Date(result.completedAt).toLocaleString()}</p>
                    ${violationsCount > 0 ? `<p style="color: #ff4444;"><i class='bx bx-error'></i> ${violationsCount} Anti-cheat Violations Detected</p>` : ''}
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    ${isPassed ? `
                        <button onclick="downloadCertificate('${result._id}')" class="btn-primary" style="background: var(--osian-cyan); color: var(--osian-dark); border: none; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class='bx bx-certification'></i> Certificate
                        </button>
                    ` : ''}
                    <div class="score-circle" style="--percent: ${percentage}%; background: conic-gradient(${isPassed ? 'var(--osian-cyan)' : '#ff4444'} ${percentage}%, #2a2a2a 0);">
                        <span style="position: absolute; font-size: 1.5rem; font-weight: bold; color: var(--text-main);">${Math.round(percentage)}%</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 2rem;">
                <h3>Performance Breakdown</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px;">
                        <p style="color: var(--text-muted);">Accuracy</p>
                        <h4>${Math.round(result.accuracy || percentage)}%</h4>
                    </div>
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px;">
                        <p style="color: var(--text-muted);">Score</p>
                        <h4>${result.score} / ${result.totalMarks}</h4>
                    </div>
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px;">
                        <p style="color: var(--text-muted);">Status</p>
                        <h4 style="color: ${isPassed ? 'var(--osian-cyan)' : '#ff4444'}">${isPassed ? 'Passed' : 'Failed'}</h4>
                    </div>
                </div>
            </div>
        `;
        
        detailContent.innerHTML = html;
        
    } catch (error) {
        console.error('Error viewing quiz results:', error);
        if (window.showToast) window.showToast('Failed to load quiz results', 'error');
        
        // Go back if error
        backToProgress();
    }
}

// Back to progress list
window.backToProgress = function() {
    const resultView = document.getElementById('result-detail-view');
    if (resultView) resultView.style.display = 'none';
    
    const progressView = document.getElementById('progress-dashboard-view');
    if (progressView) progressView.style.display = 'block';
}

// Download certificate
window.downloadCertificate = async function(resultId) {
    try {
        if (window.showToast) window.showToast('Generating certificate...', 'info');
        
        // First, ensure certificate exists or generate it
        let res;
        if (window.apiFetch) {
            res = await window.apiFetch('/certificates/generate', {
                method: 'POST',
                body: JSON.stringify({ resultId })
            });
        } else {
             const token = localStorage.getItem('token');
             const response = await fetch('/api/certificates/generate', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ resultId })
             });
             res = await response.json();
        }
        
        if (res.success && res.certificate) {
            const certId = res.certificate._id || res.certificate.id;
            
            // Now download the PDF
            const token = localStorage.getItem('token');
            const baseUrl = window.API_BASE || 'http://localhost:5000/api';
            
            const response = await fetch(`${baseUrl}/certificates/download/${certId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Certificate-${res.certificate.certificateCode}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                if (window.showToast) window.showToast('Certificate downloaded!', 'success');
            } else {
                if (window.showToast) window.showToast('Failed to download PDF', 'error');
            }
        } else {
            if (window.showToast) window.showToast('Failed to generate certificate: ' + res.message, 'error');
        }
    } catch (error) {
        console.error(error);
        if (window.showToast) {
            const rawMessage = error && error.message ? error.message : '';
            if (rawMessage.toLowerCase().includes('not eligible for certificate')) {
                window.showToast('You are not eligible for a certificate for this attempt. You must score at least 70% to download a certificate.', 'warning');
            } else if (rawMessage) {
                window.showToast(rawMessage, 'error');
            } else {
                window.showToast('Error generating certificate', 'error');
            }
        }
    }
};

// Open quiz details modal
window.openQuizDetails = async function(quizId, type) {
    try {
        let quiz;
        
        if (type === 'inprogress') {
            quiz = inProgressQuizzes.find(q => q.id == quizId);
        } else {
            quiz = quizHistory.find(q => q.id == quizId);
        }
        
        if (!quiz) {
             if (window.showToast) window.showToast('Quiz not found', 'error');
            return;
        }
        
        // Fetch detailed quiz info
        let quizDetails = quiz;
        try {
            let data;
            if (window.apiFetch) {
                 data = await window.apiFetch(`/quizzes/${quizId}`);
            } else {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/quizzes/${quizId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) data = await response.json();
            }
             if (data && data.quiz) quizDetails = data.quiz;
        } catch(e) { console.error("Could not fetch details, using summary", e); }
        
        // Populate modal
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) modalTitle.textContent = quizDetails.title;
        
        const modalBody = document.getElementById('modal-body');
        if (modalBody) modalBody.innerHTML = generateQuizDetailsHTML(quizDetails, type);
        
        // Show modal
        const modal = document.getElementById('quiz-details-modal');
        if (modal) modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading quiz details:', error);
        if (window.showToast) window.showToast('Failed to load quiz details', 'error');
    }
}

// Generate quiz details HTML
function generateQuizDetailsHTML(quiz, type) {
    const isInProgress = type === 'inprogress';
    const scoreClass = getScoreClass(quiz.score || 0);
    
    return `
        <div class="quiz-details">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div class="progress-icon" style="margin: 0 auto 1rem; width: 60px; height: 60px;">
                    <i class='bx ${getQuizIcon(quiz.category)}' style="font-size: 28px;"></i>
                </div>
                <h3 style="color: var(--text-main); margin-bottom: 0.5rem;">${quiz.title}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">${quiz.description || 'No description available'}</p>
            </div>
            
            <div style="background: rgba(95, 251, 241, 0.1); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Category:</span>
                        <span style="color: var(--text-main); font-weight: 600;">${quiz.category || 'General'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted);">Questions:</span>
                        <span style="color: var(--text-main); font-weight: 600;">${quiz.total_questions || 10}</span>
                    </div>
                    ${isInProgress ? `
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Progress:</span>
                            <span style="color: var(--osian-cyan); font-weight: 600;">${quiz.progress || 0}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Time Spent:</span>
                            <span style="color: var(--text-main); font-weight: 600;">${quiz.time_spent || 0} min</span>
                        </div>
                    ` : `
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Score:</span>
                            <span class="score-badge ${scoreClass}" style="padding: 4px 8px; font-size: 12px;">${quiz.score || 0}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);">Time Taken:</span>
                            <span style="color: var(--text-main); font-weight: 600;">${quiz.time_taken || 0} min</span>
                        </div>
                    `}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: center;">
                ${isInProgress ? `
                    <button onclick="continueQuiz(${quiz.id})" style="
                        padding: 0.75rem 1.5rem;
                        background: linear-gradient(135deg, var(--osian-cyan), var(--osian-mint));
                        color: var(--bg-main);
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    ">
                        <i class='bx bx-play-circle'></i> Continue Quiz
                    </button>
                ` : `
                    <button onclick="viewQuizResults('${quiz.result_id || ''}')" style="
                        padding: 0.75rem 1.5rem;
                        background: rgba(95, 251, 241, 0.1);
                        color: var(--osian-cyan);
                        border: 1px solid rgba(95, 251, 241, 0.3);
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    ">
                        <i class='bx bx-show'></i> View Results
                    </button>
                `}
                <button onclick="closeModal()" style="
                    padding: 0.75rem 1.5rem;
                    background: rgba(239, 68, 68, 0.1);
                    color: #EF4444;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.3s;
                ">
                    Close
                </button>
            </div>
        </div>
    `;
}
