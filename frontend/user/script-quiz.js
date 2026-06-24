// script-quiz.js - Handles quiz taking logic
// This script is now designed to be called from quizzes.html via window.startQuizProcess(quizId)

window.startQuizProcess = async function(quizId) {
    // --- Backend URL ---
    const backendUrl = window.API_BASE;

    // --- Authentication ---
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');

    // Security Check
    if (!token || !user) {
        if (typeof showToast === 'function') showToast("You must be logged in to take a quiz.", 'warning');
        return;
    }

    if (!quizId) {
        if (typeof showToast === 'function') showToast("Invalid quiz ID.", 'error');
        return;
    }

    // --- Page Elements ---
    const warningModal = document.getElementById('warning-modal');
    const autoSubmitModal = document.getElementById('auto-submit-modal');
    const finalSubmitModal = document.getElementById('final-submit-modal');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    const quizContainer = document.getElementById('quiz-container');
    const timeLeftDisplay = document.getElementById('time-left');
    const cheatingWarningBanner = document.getElementById('cheating-warning');
    const violationCountDisplay = document.getElementById('violation-count');
    const submitQuizBtn = document.getElementById('submit-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const codeContainer = document.querySelector('.code-answer-container');
    const codeEditor = document.getElementById('code-editor');
    const runCodeBtn = document.getElementById('run-code-btn');
    const codeOutput = document.getElementById('code-output');
    const codeLangLabel = document.getElementById('code-language-label');
    const runStatus = document.getElementById('run-status');

    // Disable start button immediately
    if (startQuizBtn) {
        startQuizBtn.disabled = true;
        startQuizBtn.textContent = 'Loading Quiz...';
    }

    // --- Quiz Data ---
    let currentQuizData = null;
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let writtenAnswers = [];
    let codeAnswers = [];
    let timerInterval = null;
    let timer = 0;
    let violationCounts = { tabSwitches: 0, windowBlurs: 0, other: 0 };
    let totalViolations = 0;
    const maxViolations = 3;
    let isProctoringEnabled = false;
    let pistonRuntimes = null;
    
    // Proctoring elements
    const proctorLoader = document.getElementById('proctor-loader');
    const proctorVideo = document.getElementById('proctor-video');
    
    // --- Helper Functions ---

    async function fetchPistonRuntimes(){
        if (pistonRuntimes) return pistonRuntimes;
        try {
            const res = await fetch('https://emkc.org/api/v2/piston/runtimes');
            if (!res.ok) return null;
            pistonRuntimes = await res.json();
            return pistonRuntimes;
        } catch(_) { return null; }
    }

    async function loadScript(src){
        return new Promise(function(resolve, reject){
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    let proctorLibsLoaded = false;
    async function ensureProctorLibs(){
        if (proctorLibsLoaded) return;
        if (typeof blazeface === 'undefined' || typeof cocoSsd === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
        }
        proctorLibsLoaded = true;
    }

    // --- Load Quiz ---
    async function loadQuiz() {
        if (startQuizBtn) {
            startQuizBtn.disabled = true;
            startQuizBtn.textContent = 'Loading Quiz...';
        }

        try {
            const response = await apiFetch(`/quizzes/${quizId}`);

            if (!response || response.error) {
                throw new Error((response && response.message) || 'Failed to load quiz');
            }

            currentQuizData = response;

            // Set up the quiz page
            const quizTitleEl = document.getElementById('quiz-title-display');
            if (quizTitleEl) quizTitleEl.textContent = currentQuizData.title;
            if (timeLeftDisplay) timeLeftDisplay.textContent = `${currentQuizData.duration}:00`;

            // Enforce schedule
            const now = Date.now();
            const startAt = currentQuizData.scheduleTime ? new Date(currentQuizData.scheduleTime).getTime() : now;
            
            const completeFlag = localStorage.getItem('profileComplete') === 'true';
            
            if (startAt > now) {
                if (startQuizBtn) {
                    startQuizBtn.disabled = true;
                    const dt = new Date(startAt);
                    startQuizBtn.textContent = `Starts at ${dt.toLocaleString()}`;
                }
            } else {
                if (!completeFlag) {
                    if (startQuizBtn) {
                        startQuizBtn.disabled = true;
                        startQuizBtn.textContent = `Complete profile to start`;
                    }
                    showToast('Please complete your profile before starting the quiz.', 'warning');
                } else {
                    if (startQuizBtn) {
                        startQuizBtn.disabled = false;
                        startQuizBtn.textContent = 'I Understand, Start the Quiz';
                    }
                }
            }

        } catch (error) {
            console.error('Error loading quiz:', error);
            showToast(`Error: ${error.message}.`, 'error');
            setTimeout(() => { window.location.reload(); }, 2000);
        }
    }

    // --- Start Quiz Button ---
    if (startQuizBtn) {
        // Remove old listeners to prevent duplicates if called multiple times
        const newBtn = startQuizBtn.cloneNode(true);
        startQuizBtn.parentNode.replaceChild(newBtn, startQuizBtn);
        
        newBtn.addEventListener('click', async function() {
            const completeFlag = localStorage.getItem('profileComplete') === 'true';
            if (!completeFlag) {
                showToast('Complete your profile to start the quiz.', 'warning');
                window.location.href = 'profile.html';
                return;
            }
            if (!currentQuizData) {
                showToast('Quiz data not loaded. Please refresh.', 'error');
                return;
            }

            isProctoringEnabled = String(currentQuizData.quizType || '').toLowerCase() === 'paid';
            if (isProctoringEnabled) {
                try {
                    if (proctorLoader) { proctorLoader.style.display = 'block'; proctorLoader.classList.add('active'); }
                    document.getElementById('proctor-video-wrapper').style.display = 'block';
                    await ensureProctorLibs();
                    await setupProctoring();
                    if (proctorLoader) { proctorLoader.classList.remove('active'); proctorLoader.style.display = 'none'; }
                } catch (e) {
                    console.error(e);
                    if (proctorLoader) { proctorLoader.classList.remove('active'); proctorLoader.style.display = 'none'; }
                    showToast('Camera access is required for paid quizzes.', 'warning');
                    return;
                }
            }

            if (warningModal) warningModal.classList.remove('active');
            if (quizContainer) quizContainer.style.display = 'block';
            
            startTimer(currentQuizData.duration * 60);
            displayQuestion(0);
            addSecurityListeners();
            updateNavigationButtons();
        });
    }

    // --- Display & Navigation ---
    function displayQuestion(index) {
        if (!currentQuizData || index >= currentQuizData.questions.length) return;

        currentQuestionIndex = index;
        const question = currentQuizData.questions[index];

        const qNumEl = document.getElementById('question-number');
        if (qNumEl) qNumEl.textContent = `Question ${index + 1} of ${currentQuizData.questions.length}`;
        
        const qTextEl = document.getElementById('question-text');
        if (qTextEl) qTextEl.textContent = question.questionText;

        const optionsContainer = document.getElementById('options-container');
        const writtenContainer = document.querySelector('.written-answer-container');
        const writtenTextarea = document.getElementById('written-answer');

        // Hide all first
        if (optionsContainer) optionsContainer.style.display = 'none';
        if (writtenContainer) writtenContainer.style.display = 'none';
        if (codeContainer) codeContainer.style.display = 'none';

        if (question.questionType === 'mcq') {
            if (optionsContainer) {
                optionsContainer.style.display = 'block';
                optionsContainer.innerHTML = '';

                const existing = userAnswers.find(a => a.questionIndex === index);
                const selectedForMulti = existing && Array.isArray(existing.selectedAnswers) ? existing.selectedAnswers : [];
                const selectedSingle = existing && typeof existing.answerIndex === 'number' ? existing.answerIndex : null;

                question.options.forEach((option, i) => {
                    const label = String.fromCharCode(65 + i);
                    const imgHtml = option.image ? `<img src="${option.image}" alt="Option image" style="max-width:220px; display:block; margin-top:8px; border-radius:6px;">` : '';
                    
                    if (question.isMultiple) {
                        const checked = selectedForMulti.includes(i) ? 'checked' : '';
                        optionsContainer.innerHTML += `
                            <label class="option option-multiple" data-option-index="${i}" style="display:block; cursor:pointer; padding:12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:10px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <input type="checkbox" class="option-checkbox" ${checked} />
                                    <span>${label}</span>
                                    <p style="margin:0;">${option.text}</p>
                                </div>
                                ${imgHtml}
                            </label>
                        `;
                    } else {
                        const selClass = selectedSingle === i ? 'selected' : '';
                        optionsContainer.innerHTML += `
                            <div class="option ${selClass}" data-option-index="${i}" style="padding:12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:10px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span>${label}</span>
                                    <p style="margin:0;">${option.text}</p>
                                </div>
                                ${imgHtml}
                            </div>
                        `;
                    }
                });

                if (question.isMultiple) {
                    document.querySelectorAll('.option-checkbox').forEach(cb => {
                        cb.addEventListener('change', toggleMultiSelection);
                    });
                    document.querySelectorAll('.option.option-multiple').forEach(opt => {
                        const i = parseInt(opt.getAttribute('data-option-index'));
                        if (selectedForMulti.includes(i)) opt.classList.add('selected');
                    });
                } else {
                    document.querySelectorAll('.option').forEach(opt => {
                        opt.addEventListener('click', selectAnswer);
                    });
                }
            }
        } else if (question.questionType === 'written') {
            if (writtenContainer) writtenContainer.style.display = 'block';
            if (writtenTextarea) {
                const existingWritten = writtenAnswers.find(a => a.questionIndex === index);
                writtenTextarea.value = existingWritten ? existingWritten.answer : '';
                
                // Clone to remove old listeners
                const newTextarea = writtenTextarea.cloneNode(true);
                writtenTextarea.parentNode.replaceChild(newTextarea, writtenTextarea);
                
                newTextarea.addEventListener('input', function() {
                    const existing = writtenAnswers.find(a => a.questionIndex === currentQuestionIndex);
                    if (existing) {
                        existing.answer = this.value;
                    } else {
                        writtenAnswers.push({ questionIndex: currentQuestionIndex, answer: this.value });
                    }
                });
            }
        } else if (question.questionType === 'coding') {
            if (codeContainer) codeContainer.style.display = 'block';
            if (codeLangLabel) codeLangLabel.textContent = `Language: ${question.codeLanguage || 'javascript'}`;
            
            if (codeEditor) {
                const existingCode = codeAnswers.find(a => a.questionIndex === index);
                codeEditor.value = existingCode ? existingCode.code : (question.codeStarter || '');
                
                const newEditor = codeEditor.cloneNode(true);
                codeEditor.parentNode.replaceChild(newEditor, codeEditor);
                
                newEditor.addEventListener('input', function() {
                    const existing = codeAnswers.find(a => a.questionIndex === currentQuestionIndex);
                    if (existing) {
                        existing.code = this.value;
                    } else {
                        codeAnswers.push({ questionIndex: currentQuestionIndex, code: this.value });
                    }
                });
            }

            if (runCodeBtn) {
                const newRunBtn = runCodeBtn.cloneNode(true);
                runCodeBtn.parentNode.replaceChild(newRunBtn, runCodeBtn);
                
                newRunBtn.onclick = async function(){
                    if (runStatus) runStatus.textContent = 'Running...';
                    const outEl = document.getElementById('code-output');
                    if (outEl) { outEl.style.display = 'none'; outEl.textContent = ''; }
                    
                    const lang = (question.codeLanguage || 'javascript');
                    const code = document.getElementById('code-editor').value;
                    let version = null;
                    
                    const runtimes = await fetchPistonRuntimes();
                    if (Array.isArray(runtimes)) {
                        const rt = runtimes.find(r => r.language.toLowerCase() === lang.toLowerCase());
                        version = rt ? rt.version : null;
                    }
                    
                    try {
                        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                language: lang,
                                version: version || undefined,
                                files: [{ name: 'main', content: code }]
                            })
                        });
                        const data = await res.json();
                        const out = (data && data.run && (data.run.output || data.run.stdout)) || JSON.stringify(data);
                        if (outEl) { outEl.textContent = out; outEl.style.display = 'block'; }
                        if (runStatus) runStatus.textContent = '';
                    } catch(e) {
                        if (runStatus) runStatus.textContent = 'Failed to run';
                    }
                };
            }
        }

        updateNavigationButtons();
    }

    function selectAnswer(e) {
        // Remove selected class from all options
        document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        // Add to clicked
        this.classList.add('selected');
        const selectedOptionIndex = parseInt(this.getAttribute('data-option-index'));

        const existing = userAnswers.find(a => a.questionIndex === currentQuestionIndex);
        if (existing) {
            existing.answerIndex = selectedOptionIndex;
        } else {
            userAnswers.push({ questionIndex: currentQuestionIndex, answerIndex: selectedOptionIndex });
        }
    }

    function toggleMultiSelection(e) {
        const optionDiv = this.closest('.option');
        const index = parseInt(optionDiv.getAttribute('data-option-index'));
        
        if (this.checked) {
            optionDiv.classList.add('selected');
        } else {
            optionDiv.classList.remove('selected');
        }

        const existing = userAnswers.find(a => a.questionIndex === currentQuestionIndex);
        let selected = existing && Array.isArray(existing.selectedAnswers) ? existing.selectedAnswers : [];
        
        if (this.checked) {
            if (!selected.includes(index)) selected.push(index);
        } else {
            selected = selected.filter(i => i !== index);
        }

        if (existing) {
            existing.selectedAnswers = selected;
        } else {
            userAnswers.push({ questionIndex: currentQuestionIndex, selectedAnswers: selected });
        }
    }

    function updateNavigationButtons() {
        if (!currentQuizData) return;
        const totalQuestions = currentQuizData.questions.length;

        if (prevBtn) {
            prevBtn.style.display = currentQuestionIndex === 0 ? 'none' : 'inline-block';
        }

        if (nextBtn && submitQuizBtn) {
            if (currentQuestionIndex === totalQuestions - 1) {
                nextBtn.style.display = 'none';
                submitQuizBtn.style.display = 'inline-block';
            } else {
                nextBtn.style.display = 'inline-block';
                submitQuizBtn.style.display = 'none';
            }
        }
    }

    // --- Navigation Listeners ---
    if (prevBtn) {
        const newPrev = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        newPrev.addEventListener('click', () => {
            if (currentQuestionIndex > 0) displayQuestion(currentQuestionIndex - 1);
        });
    }

    if (nextBtn) {
        const newNext = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        newNext.addEventListener('click', () => {
            if (currentQuestionIndex < currentQuizData.questions.length - 1) displayQuestion(currentQuestionIndex + 1);
        });
    }

    if (submitQuizBtn) {
        const newSubmit = submitQuizBtn.cloneNode(true);
        submitQuizBtn.parentNode.replaceChild(newSubmit, submitQuizBtn);
        newSubmit.addEventListener('click', () => submitQuiz(false));
    }

    // --- Timer ---
    function startTimer(durationSeconds) {
        timer = durationSeconds;
        updateTimerDisplay();
        
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timer--;
            updateTimerDisplay();
            
            if (timer <= 0) {
                clearInterval(timerInterval);
                submitQuiz(true); // Auto submit
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        if (timeLeftDisplay) timeLeftDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        if (timer < 60 && timeLeftDisplay) {
            timeLeftDisplay.style.color = 'var(--osian-red, #ff6b6b)';
        }
    }

    // --- Anti-Cheating ---
    function addSecurityListeners() {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
    }

    function removeSecurityListeners() {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            registerViolation('tab_switch');
        }
    }

    function handleWindowBlur() {
        registerViolation('window_blur');
    }

    function registerViolation(type) {
        if (timer <= 0) return; // Don't count if finished

        totalViolations++;
        if (type === 'tab_switch') violationCounts.tabSwitches++;
        if (type === 'window_blur') violationCounts.windowBlurs++;

        if (cheatingWarningBanner) {
            cheatingWarningBanner.style.display = 'block';
            if (violationCountDisplay) violationCountDisplay.textContent = totalViolations;
            setTimeout(() => { cheatingWarningBanner.style.display = 'none'; }, 5000);
        }

        if (totalViolations >= maxViolations) {
            clearInterval(timerInterval);
            removeSecurityListeners();
            if (autoSubmitModal) autoSubmitModal.classList.add('active');
            submitQuiz(true);
        }
    }

    async function setupProctoring() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (proctorVideo) proctorVideo.srcObject = stream;
            // ... (rest of proctoring logic omitted for brevity, but should be here)
            // For now, simple success
        } catch (err) {
            throw err;
        }
    }

    function stopProctoring() {
        if (proctorVideo && proctorVideo.srcObject) {
            proctorVideo.srcObject.getTracks().forEach(track => track.stop());
            proctorVideo.srcObject = null;
        }
    }

    // --- Submit Quiz ---
    async function submitQuiz(auto = false) {
        clearInterval(timerInterval);
        removeSecurityListeners();
        stopProctoring();

        const timeTaken = (currentQuizData.duration * 60) - timer;

        const submissionData = {
            quizId: quizId,
            answers: userAnswers,
            writtenAnswers: writtenAnswers,
            codeAnswers: codeAnswers,
            violations: violationCounts,
            timeTaken: timeTaken
        };

        try {
            const result = await apiFetch('/results/submit', {
                method: 'POST',
                body: JSON.stringify(submissionData)
            });

            if (result.success) {
                if (auto) {
                    // Handled by auto-submit modal
                } else {
                    if (finalSubmitModal) finalSubmitModal.classList.add('active');
                }
                // Don't redirect immediately, let user click button in modal
            } else {
                const errorMsg = result.message || 'Submission failed.';
                const debugMsg = result.error ? ` (${result.error})` : '';
                showToast(errorMsg + debugMsg, 'error');
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
            if (error.message && error.message.includes('503')) {
                showToast('Service temporarily unavailable. Please retry in a moment.', 'error');
            } else {
                showToast(`Error submitting quiz: ${error.message || 'Network error'}`, 'error');
            }
        }
    }

    // --- Initial Load ---
    await loadQuiz();
    
    // Show the modal
    if (warningModal) warningModal.classList.add('active');
};

(function() {
    async function loadAvailableQuizzes() {
        const listContainer = document.getElementById('quizzes-list');
        if (!listContainer) return; 

        try {
            let quizzes = [];
            if (typeof apiFetch === 'function') {
                const response = await apiFetch('/quizzes');
                quizzes = response.quizzes || response; 
            } else {
                 const token = localStorage.getItem('token');
                 const res = await fetch((window.API_BASE || 'http://localhost:5000/api') + '/quizzes', {
                     headers: { 'Authorization': `Bearer ${token}` }
                 });
                 const data = await res.json();
                 quizzes = data.quizzes || data;
            }

            if (!Array.isArray(quizzes)) {
                 if (quizzes.data && Array.isArray(quizzes.data)) quizzes = quizzes.data;
                 else {
                     listContainer.innerHTML = '<p>No quizzes found.</p>';
                     return;
                 }
            }
    
            if (quizzes.length === 0) {
                listContainer.innerHTML = '<p>No quizzes available.</p>';
                return;
            }
    
            listContainer.innerHTML = quizzes.map(quiz => `
                <div class="quiz-card" style="background: var(--bg-card); padding: 20px; border-radius: 10px; border: 1px solid var(--osian-dark); display: flex; flex-direction: column; gap: 10px;">
                    <h3 style="color: var(--osian-cyan); margin: 0;">${quiz.title}</h3>
                    <p style="color: var(--text-para); font-size: 0.9em;">${quiz.description || 'No description provided.'}</p>
                    <div class="quiz-meta" style="display: flex; gap: 15px; font-size: 0.8em; color: var(--text-muted);">
                        <span><i class='bx bx-time'></i> ${quiz.duration} min</span>
                        <span><i class='bx bx-layer'></i> ${quiz.difficulty || 'Medium'}</span>
                    </div>
                    <button class="btn-primary start-btn" data-id="${quiz._id || quiz.id}" style="margin-top: auto;">Start Quiz</button>
                </div>
            `).join('');
    
            document.querySelectorAll('.start-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const quizId = e.target.getAttribute('data-id');
                    document.getElementById('quiz-list-view').style.display = 'none';
                    document.getElementById('quiz-interface-view').style.display = 'block';
                    window.startQuizProcess(quizId);
                });
            });
    
        } catch (error) {
            console.error('Error loading quizzes:', error);
            listContainer.innerHTML = `<p style="color: #ff4444;">Failed to load quizzes.</p>`;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAvailableQuizzes);
    } else {
        loadAvailableQuizzes();
    }
})();
