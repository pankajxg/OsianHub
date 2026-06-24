/* =========================================================================
   OSIAN Quiz Attempt Script (Final Path Fix: quiz-results.html)
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Check
    if (typeof window.checkAuth === 'function') window.checkAuth();

    // 2. Global State
    const quizId = new URLSearchParams(window.location.search).get('id');
    
    let state = {
        questions: [],
        currentQuestionIndex: 0,
        userAnswers: {}, 
        timerInterval: null,
        timeLeft: 0,
        isSubmitting: false,
        isQuizActive: false,
        violationCount: 0,
        maxViolations: 3
    };

    // 3. DOM Elements
    const ui = {
        instContainer: document.getElementById('instructions-container'),
        instDetailsPanel: document.getElementById('inst-details-panel'),
        instError: document.getElementById('inst-error'),
        instErrorMsg: document.getElementById('inst-error-msg'),
        
        quizWrapper: document.getElementById('quiz-content'),
        fullscreenPrompt: document.getElementById('fullscreen-prompt'),
        warningOverlay: document.getElementById('warning-overlay'),
        submitModal: document.getElementById('submit-confirm-modal'),
        submitMsg: document.getElementById('submit-msg'),
        
        // Quiz Elements
        instTitle: document.getElementById('inst-quiz-title'),
        instDesc: document.getElementById('inst-quiz-desc'),
        instDuration: document.getElementById('inst-duration'),
        instQuestions: document.getElementById('inst-questions'),
        
        questionNumber: document.getElementById('question-number'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        timerDisplay: document.getElementById('timer'),
        
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        submitBtn: document.getElementById('submit-btn'),
        
        trackerGrid: document.getElementById('tracker-grid'),
        progressFill: document.getElementById('progress-fill'),
        answeredCount: document.getElementById('answered-count'),
        totalCount: document.getElementById('total-count'),
        quizTitleHeader: document.getElementById('quiz-title')
    };

    if (!quizId) {
        showError("No quiz ID provided.");
        return;
    }

    initQuizLoad();

    // --- INIT ---
    async function initQuizLoad() {
        try {
            if (window.self !== window.top) throw new Error("Frame embedding disallowed.");

            const response = await window.apiFetch(`/quizzes/${quizId}/attempt`);
            
            // Validate response
            if (!response || !response.quiz) {
                throw new Error("Invalid response from server");
            }

            const quiz = response.quiz;

            // HANDLE "ALREADY ATTEMPTED"
            if (quiz.canAttempt === false) {
                ui.instTitle.textContent = quiz.title;
                ui.instDesc.innerHTML = `<span style="color:#ff4444; font-weight:bold;">${quiz.message || "You have already attempted this quiz."}</span>`;
                ui.instDuration.textContent = "--";
                ui.instQuestions.textContent = "--";
                ui.instDetailsPanel.style.display = 'block';

                const startBtn = document.getElementById('start-btn');
                const checkbox = document.getElementById('agreement-check');
                
                if (startBtn) {
                    startBtn.innerHTML = "<i class='bx bx-lock-alt'></i> Already Attempted";
                    startBtn.disabled = true;
                    startBtn.style.background = "#333";
                    startBtn.style.color = "#888";
                    startBtn.style.cursor = "not-allowed";
                    startBtn.style.boxShadow = "none";
                }
                if (checkbox) {
                    checkbox.disabled = true;
                    checkbox.parentElement.style.display = 'none';
                }
                return;
            }

            // NORMAL LOAD
            state.questions = quiz.questions || [];
            state.timeLeft = (quiz.duration || 30) * 60;

            ui.instTitle.textContent = quiz.title;
            ui.instDesc.textContent = quiz.description || "Review rules below.";
            ui.instDuration.textContent = `${quiz.duration}`;
            ui.instQuestions.textContent = `${state.questions.length}`;
            
            ui.instDetailsPanel.style.display = 'block';
            if(ui.quizTitleHeader) ui.quizTitleHeader.textContent = quiz.title;

        } catch (error) {
            console.error("Init Error:", error);
            showError("Failed to load quiz. Please check your connection.");
        }
    }

    // --- ACTIONS ---
    window.toggleStartBtn = () => {
        const check = document.getElementById('agreement-check');
        const btn = document.getElementById('start-btn');
        if(check && btn) btn.disabled = !check.checked;
    };

    window.proceedToFullscreen = () => {
        const el = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if(rfs) {
            rfs.call(el).then(startQuiz).catch(() => alert("Fullscreen required."));
        } else {
            startQuiz();
        }
    };
    
    window.enableFullscreen = window.proceedToFullscreen;

    function startQuiz() {
        ui.instContainer.classList.remove('active');
        if(ui.instContainer.style.display) ui.instContainer.style.display = 'none'; 
        
        ui.fullscreenPrompt.classList.remove('active');
        if(ui.fullscreenPrompt.style.display) ui.fullscreenPrompt.style.display = 'none';

        ui.quizWrapper.style.display = 'flex';
        
        state.isQuizActive = true;
        enableSecurity();
        renderTracker();
        startTimer();
        loadQuestion(0);
        updateProgress();
    }

    // --- SECURITY ---
    function enableSecurity() {
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('copy', e => e.preventDefault());
        document.addEventListener('paste', e => e.preventDefault());
        document.addEventListener('visibilitychange', () => {
            if(document.hidden && state.isQuizActive) recordViolation("Tab switch");
        });
        document.addEventListener('fullscreenchange', () => {
            if(!document.fullscreenElement && state.isQuizActive) {
                ui.quizWrapper.style.display = 'none';
                ui.fullscreenPrompt.style.display = 'flex';
                ui.fullscreenPrompt.classList.add('active');
                recordViolation("Exited fullscreen");
            }
        });
    }

    function recordViolation(reason) {
        state.violationCount++;
        const left = state.maxViolations - state.violationCount;
        
        ui.warningOverlay.innerHTML = `
            <div style="background:#2a0000; border:2px solid #ff4444; padding:20px; border-radius:12px; text-align:center; color:#fff;">
                <h2 style="color:#ff4444; margin-bottom:10px;">⚠️ WARNING</h2>
                <p>${reason}</p>
                <p style="color:#ccc;">Strikes: ${state.violationCount}/${state.maxViolations}</p>
                ${left <= 0 ? '<p style="color:red; font-weight:bold;">Submitting...</p>' : ''}
            </div>
        `;
        ui.warningOverlay.style.display = 'flex';
        ui.warningOverlay.classList.add('active');
        
        if(left > 0) {
            setTimeout(() => {
                ui.warningOverlay.style.display = 'none';
                ui.warningOverlay.classList.remove('active');
            }, 3000);
        } else {
            confirmSubmitQuiz(true, "Security Violation");
        }
    }

    // --- LOGIC ---
    function startTimer() {
        updateTimerUI();
        state.timerInterval = setInterval(() => {
            if(state.timeLeft <= 0) {
                clearInterval(state.timerInterval);
                confirmSubmitQuiz(true, "Time Up");
            } else {
                state.timeLeft--;
                updateTimerUI();
            }
        }, 1000);
    }

    function updateTimerUI() {
        const m = Math.floor(state.timeLeft / 60);
        const s = state.timeLeft % 60;
        if(ui.timerDisplay) {
            ui.timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
            if(state.timeLeft < 60) ui.timerDisplay.style.color = '#ff4444';
        }
    }

    function loadQuestion(idx) {
        if(idx < 0 || idx >= state.questions.length) return;
        state.currentQuestionIndex = idx;
        const q = state.questions[idx];
        
        ui.questionNumber.textContent = `Question ${idx + 1}`;
        ui.questionText.textContent = q.questionText;
        
        ui.prevBtn.disabled = idx === 0;
        if(idx === state.questions.length - 1) {
            ui.nextBtn.style.display = 'none';
            ui.submitBtn.style.display = 'flex';
        } else {
            ui.nextBtn.style.display = 'flex';
            ui.submitBtn.style.display = 'none';
        }
        
        renderOptions(q);
        highlightTracker(idx);
    }

    function renderOptions(q) {
        ui.optionsContainer.innerHTML = '';
        q.options.forEach((opt, i) => {
            const div = document.createElement('div');
            const sel = state.userAnswers[q._id] === i;
            div.className = `option-card ${sel ? 'selected' : ''}`;
            div.innerHTML = `<div class="option-circle">${sel ? '<div class="dot"></div>' : ''}</div><span>${opt}</span>`;
            div.onclick = () => {
                if(!state.isQuizActive) return;
                state.userAnswers[q._id] = i;
                renderOptions(q);
                updateProgress();
                const tr = document.getElementById(`tracker-${state.currentQuestionIndex}`);
                if(tr) tr.classList.add('answered');
            };
            ui.optionsContainer.appendChild(div);
        });
    }

    // --- MODAL & SUBMISSION ---
    window.openSubmitModal = function() {
        const ans = Object.keys(state.userAnswers).length;
        ui.submitMsg.textContent = `You have answered ${ans} out of ${state.questions.length} questions.`;
        ui.submitModal.classList.add('active');
        ui.submitModal.style.display = 'flex';
    };

    window.closeSubmitModal = function() {
        ui.submitModal.classList.remove('active');
        ui.submitModal.style.display = 'none';
    };

    window.confirmSubmitQuiz = async function(auto = false, reason = "User Submitted") {
        if(state.isSubmitting) return;
        state.isSubmitting = true;
        state.isQuizActive = false;
        clearInterval(state.timerInterval);
        
        window.closeSubmitModal();
        
        // Loader
        const loader = document.createElement('div');
        loader.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;justify-content:center;align-items:center;color:#fff;font-size:1.5rem;";
        loader.innerHTML = `<i class='bx bx-loader-alt bx-spin' style="margin-right:10px;"></i> Submitting...`;
        document.body.appendChild(loader);

        const payload = {
            quizId: quizId,
            answers: Object.keys(state.userAnswers).map(qId => ({
                questionId: qId,
                selectedOptionIndex: state.userAnswers[qId]
            })),
            timeTaken: (state.questions.length * 60) - state.timeLeft,
            submissionReason: reason
        };

        try {
            const res = await window.apiFetch('/results/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // --- FIX: Redirect to 'quiz-results.html' ---
            if(res.success && res.resultId) {
                window.location.replace(`quiz-results.html?id=${res.resultId}`);
            } else {
                alert("Submission saved but no ID returned. Redirecting...");
                window.location.replace('dashboard.html');
            }
        } catch(err) {
            console.error("Submit Error:", err);
            document.body.removeChild(loader);

            // FIX: Handle "Already Submitted" or 409
            const msg = (err.message || "").toLowerCase();
            if (err.status === 409 || msg.includes('already') || msg.includes('duplicate')) {
                // Redirect to results list if duplicate
                window.location.replace(`quiz-results.html?quizId=${quizId}`); 
            } else {
                alert("Network error: " + msg);
                state.isSubmitting = false;
            }
        }
    };

    // --- HELPERS ---
    function renderTracker() {
        ui.trackerGrid.innerHTML = '';
        state.questions.forEach((_, i) => {
            const d = document.createElement('div');
            d.className = 'question-indicator';
            d.id = `tracker-${i}`;
            d.textContent = i + 1;
            d.onclick = () => loadQuestion(i);
            ui.trackerGrid.appendChild(d);
        });
    }

    function highlightTracker(idx) {
        document.querySelectorAll('.question-indicator').forEach(e => e.classList.remove('current'));
        const el = document.getElementById(`tracker-${idx}`);
        if(el) el.classList.add('current');
    }

    function updateProgress() {
        const ans = Object.keys(state.userAnswers).length;
        if(ui.progressFill) ui.progressFill.style.width = `${(ans/state.questions.length)*100}%`;
        if(ui.answeredCount) ui.answeredCount.textContent = ans;
    }

    function showError(msg) {
        if(ui.instDetailsPanel) ui.instDetailsPanel.style.display = 'none';
        if(ui.instError) {
            ui.instError.style.display = 'block';
            ui.instErrorMsg.textContent = msg;
        }
    }

    window.nextQuestion = () => loadQuestion(state.currentQuestionIndex + 1);
    window.prevQuestion = () => loadQuestion(state.currentQuestionIndex - 1);
    window.toggleMobileMap = () => document.getElementById('side-panel').classList.toggle('active');
    window.attemptSubmit = window.openSubmitModal; 
});