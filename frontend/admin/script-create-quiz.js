// script-create-quiz.js
// FIXED: Ensures 'Department' scope is sent correctly so it appears in the User's Department section.

document.addEventListener('DOMContentLoaded', function() {
    initQuizCreationSystem();
});

// Global functions for Sidebar/Logout
window.toggleSidebar = function() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('open');
};

window.logout = function() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('authToken'); 
    } catch(e){}
    window.location.href = '/frontend/auth/login.html';
};

// Global state
let csvBufferQuestions = [];
let defaultCategoryId = null; 

async function initQuizCreationSystem() {
    const createQuizView = document.getElementById('create-quiz-view');
    if (!createQuizView) return;

    // 0. AUTH CHECK
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("No token found. Redirecting...");
        window.logout();
        return;
    }

    console.log('Initializing Quiz Creation System...');

    // 1. Initialize Form & Event Listeners
    setupEventListeners();

    // 2. Check Profile & Sync Department Data
    await checkAndEnforceProfile();

    // 3. Load Data
    await loadInitialData();
}

// --- 1. Event Listeners ---

function setupEventListeners() {
    // CSV Controls
    const csvUpload = document.getElementById('csv-upload');
    const btnParse = document.getElementById('btn-parse-csv');
    const btnImport = document.getElementById('btn-use-csv');
    const btnClear = document.getElementById('btn-clear-csv');

    if (csvUpload) csvUpload.addEventListener('change', (e) => handleCSVFileSelect(e));
    if (btnParse) {
        btnParse.addEventListener('click', () => {
            if (csvUpload.files[0]) handleCSVFileSelect({ target: { files: csvUpload.files } });
            else showToast('Please select a CSV file first', 'warning');
        });
    }
    if (btnImport) btnImport.addEventListener('click', importCSVToForm);
    if (btnClear) btnClear.addEventListener('click', clearCSVData);

    // Manual Question Add
    const btnAddManual = document.getElementById('add-question-btn');
    if (btnAddManual) btnAddManual.addEventListener('click', () => addQuestionCard());

    // Form Submit
    const form = document.getElementById('create-quiz-form');
    if (form) form.addEventListener('submit', handleFormSubmit);

    // Price Toggle
    const typeSelect = document.getElementById('quiz-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', function() {
            const priceGroup = document.getElementById('quiz-price-group');
            if (priceGroup) priceGroup.style.display = this.value === 'paid' ? 'block' : 'none';
        });
    }

    // Cover Image Preview
    const coverInput = document.getElementById('quiz-cover');
    if (coverInput) {
        coverInput.addEventListener('change', handleImagePreview);
    }

    // Initial Question Card
    if (document.getElementById('questions-container') && document.getElementById('questions-container').children.length === 0) {
        addQuestionCard();
    }
}

function handleImagePreview(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('cover-preview-container');
    const previewImage = document.getElementById('cover-preview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewContainer.style.display = 'flex';
        }
        reader.readAsDataURL(file);
    } else {
        previewImage.src = '';
        previewContainer.style.display = 'none';
    }
}

// --- 2. Load Data ---

async function loadInitialData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return; 

        // SILENT FETCH: Get categories
        try {
            if (window.apiFetch) {
                const catRes = await apiFetch('/quizzes/categories');
                const catData = catRes;
                const cats = catData.categories || catData || [];
                
                if (cats.length > 0) {
                    defaultCategoryId = cats[0]._id || cats[0].id;
                }
            }
        } catch (catErr) {
            console.warn("Could not auto-fetch categories:", catErr);
        }
    } catch (e) {
        console.error('Load Data Error:', e);
    }
}

// --- 3. Profile Check ---

async function checkAndEnforceProfile() {
    try {
        // Force refresh user profile from server to ensure we have data
        if(window.apiFetch) {
            const res = await window.apiFetch('/users/profile');
            if(res && res.user) {
                let userDept = res.user.department;
                // If department is an object, extract the string
                if (userDept && typeof userDept === 'object') {
                    userDept = userDept.name || userDept.code || userDept._id || 'General';
                    res.user.department = userDept;
                }
                localStorage.setItem('user', JSON.stringify(res.user));
            }
        }
    } catch(e) {
        console.warn("Could not sync profile, using cached data.");
    }
}

// --- 4. CSV Logic ---
function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        previewRawCSV(content);
        const parsed = parseCSVContent(content);
        csvBufferQuestions = parsed;
        updateCSVStatus(parsed.length);
    };
    reader.readAsText(file);
}

function parseCSVContent(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const hasHeader = lines[0].toLowerCase().includes('question');
    const startRow = hasHeader ? 1 : 0;
    
    const questions = [];
    for (let i = startRow; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        if (cells.length < 3) continue;

        questions.push({
            question: cells[0] || '',
            options: [cells[1]||'', cells[2]||'', cells[3]||'', cells[4]||''],
            correctIndex: 0,
            difficulty: 'medium',
            marks: 1
        });
    }
    return questions;
}

function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuote && text[i+1] === '"') { cur += '"'; i++; } 
            else { inQuote = !inQuote; }
        } else if (char === ',' && !inQuote) {
            result.push(cur); cur = '';
        } else { cur += char; }
    }
    result.push(cur);
    return result;
}

function previewRawCSV(content) {
    const preview = document.getElementById('csv-preview');
    if (!preview) return;
    const lines = content.split(/\r?\n/).slice(0, 5);
    const escaped = lines.map(l => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    preview.innerHTML = `<pre style="font-size:0.8rem; color:var(--text-muted); background:rgba(0,0,0,0.2); padding:10px;">${escaped.join('\n')}...</pre>`;
}

function updateCSVStatus(count) {
    const status = document.getElementById('csv-status');
    if (status) status.innerHTML = count > 0 ? `<div style="color:#00ff9d;">✅ Parsed ${count} questions</div>` : `<div style="color:#ff6b6b;">⚠️ No valid questions</div>`;
}

function importCSVToForm() {
    if (csvBufferQuestions.length === 0) { showToast('No questions to import', 'warning'); return; }
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    csvBufferQuestions.forEach(q => addQuestionCard(q));
    showToast(`Imported ${csvBufferQuestions.length} questions!`, 'success');
    updateQuestionsCount();
    clearCSVData();
}

function clearCSVData() {
    csvBufferQuestions = [];
    document.getElementById('csv-preview').innerHTML = '';
    document.getElementById('csv-status').innerHTML = '';
    document.getElementById('csv-upload').value = '';
}

// --- 5. Question Card Logic ---

function addQuestionCard(data = null) {
    const container = document.getElementById('questions-container');
    if (!container) return;
    const index = container.children.length + 1;
    const card = document.createElement('div');
    card.className = 'question-card';
    card.style.cssText = `background: var(--bg-main); border: 1px solid rgba(95, 251, 241, 0.1); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; position: relative;`;

    const q = data || { question: '', options: ['', '', '', ''], correctIndex: 0, difficulty: 'medium', marks: 1, explanation: '' };
    const esc = (s) => (s || '').replace(/"/g, '&quot;');

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
            <h4 style="color: var(--osian-cyan); margin:0;">Question <span class="q-num">${index}</span></h4>
            <button type="button" class="btn-remove-q" style="background:none; border:none; color:#ff6b6b; cursor:pointer;"><i class='bx bx-trash'></i></button>
        </div>
        <div style="margin-bottom: 1rem;">
            <label style="display:block; color:var(--text-muted); margin-bottom:5px;">Question Text *</label>
            <textarea class="q-text" rows="2" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); border-radius:6px;">${q.question}</textarea>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
            ${q.options.map((opt, i) => `
                <div><label style="display:block; color:var(--text-muted); margin-bottom:5px;">Option ${['A','B','C','D'][i]}</label>
                <input type="text" class="q-opt-${i}" value="${esc(opt)}" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); border-radius:6px;"></div>
            `).join('')}
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
            <div><label style="display:block; color:var(--text-muted); margin-bottom:5px;">Correct Answer</label>
            <select class="q-correct" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); border-radius:6px;">
                <option value="0" ${q.correctIndex === 0 ? 'selected' : ''}>Option A</option>
                <option value="1" ${q.correctIndex === 1 ? 'selected' : ''}>Option B</option>
                <option value="2" ${q.correctIndex === 2 ? 'selected' : ''}>Option C</option>
                <option value="3" ${q.correctIndex === 3 ? 'selected' : ''}>Option D</option>
            </select></div>
            <div><label style="display:block; color:var(--text-muted); margin-bottom:5px;">Difficulty</label>
            <select class="q-diff" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); border-radius:6px;">
                <option value="basic" ${q.difficulty === 'basic' ? 'selected' : ''}>Basic</option>
                <option value="medium" ${q.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="hard" ${q.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
            </select></div>
            <div><label style="display:block; color:var(--text-muted); margin-bottom:5px;">Marks</label>
            <input type="number" class="q-marks" value="${q.marks}" min="1" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); border-radius:6px;"></div>
        </div>
        <div style="margin-top:1rem;"><label style="display:block; color:var(--text-muted); margin-bottom:5px;">Explanation</label>
        <textarea class="q-expl" rows="2" style="width:100%; padding:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-main); border-radius:6px;">${q.explanation}</textarea></div>
    `;

    card.querySelector('.btn-remove-q').addEventListener('click', () => { card.remove(); updateQuestionsCount(); });
    container.appendChild(card);
    updateQuestionsCount();
}

function updateQuestionsCount() {
    const count = document.querySelectorAll('.question-card').length;
    const el = document.getElementById('questions-count');
    if (el) el.textContent = `(${count} questions)`;
}

// --- 6. Form Submit (Fixes: Enforcing Department Scope) ---

async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('.btn-submit');
    const originalBtnText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validating...';

        const title = document.getElementById('quiz-title').value.trim();
        if (!title) throw new Error('Quiz Title is required');

        // Questions gathering logic...
        const questionCards = document.querySelectorAll('.question-card');
        const finalQuestions = [];
        
        questionCards.forEach((card, idx) => {
            const qText = card.querySelector('.q-text').value.trim();
            const opts = [
                card.querySelector('.q-opt-0').value.trim(),
                card.querySelector('.q-opt-1').value.trim(),
                card.querySelector('.q-opt-2').value.trim(),
                card.querySelector('.q-opt-3').value.trim()
            ];
            if (!qText && opts.every(o => !o)) return;
            if (!qText || opts.some(o => !o)) throw new Error(`Question ${idx + 1} is incomplete.`);
            finalQuestions.push({
                questionText: qText,
                options: opts,
                correctOptionIndex: parseInt(card.querySelector('.q-correct').value),
                difficulty: card.querySelector('.q-diff').value,
                marks: parseInt(card.querySelector('.q-marks').value) || 1,
                explanation: card.querySelector('.q-expl').value.trim()
            });
        });

        if (finalQuestions.length === 0) throw new Error('Add at least one question.');

        submitBtn.textContent = 'Creating...';

        const formData = new FormData();
        formData.append('title', title);
        
        // --- KEY FIX: DEPARTMENT & SCOPE ASSIGNMENT ---
        const deptSelect = document.getElementById('quiz-department');
        let targetDept = deptSelect ? deptSelect.value : null;

        // Fallback to Profile Department if manual selection is empty
        if (!targetDept) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            let userDept = user.department;
            if (userDept && typeof userDept === 'object') {
                userDept = userDept.name || userDept.code || userDept._id;
            }
            targetDept = userDept;
        }

        // === CRITICAL FIX: Explicitly set Scope ===
        if (targetDept && targetDept !== 'Global' && targetDept !== 'Select Department') {
            console.log("Creating Department Quiz for:", targetDept);
            formData.append('scope', 'Department'); // This tells the backend it's NOT global
            formData.append('department', targetDept);
        } else {
            console.log("Creating Global Quiz");
            formData.append('scope', 'Global');
        }

        // Default Category
        if (defaultCategoryId) {
            formData.append('category', defaultCategoryId);
        } else {
            formData.append('category', 'General'); 
        }
        formData.append('field', 'General');

        formData.append('type', document.getElementById('quiz-type').value);
        if (document.getElementById('quiz-type').value === 'paid') {
            formData.append('price', document.getElementById('quiz-price').value || 0);
        }

        const visEl = document.getElementById('quiz-visibility');
        const visibilityValue = visEl ? visEl.value : 'public';
        formData.append('visibility', visibilityValue);

        formData.append('difficulty', document.getElementById('quiz-difficulty').value);
        formData.append('duration', document.getElementById('quiz-duration').value);
        formData.append('maxAttempts', document.getElementById('quiz-attempts').value);
        formData.append('numQuestionsToShow', document.getElementById('num-questions').value);
        
        const certPassInput = document.getElementById('certificate-pass-percentage');
        if (certPassInput && certPassInput.value !== '') {
            formData.append('certificatePassPercentage', certPassInput.value);
        }
        
        formData.append('randomizeQuestions', document.getElementById('randomize-questions').value === 'true');
        formData.append('randomizeOptions', document.getElementById('randomize-options').value === 'true');
        
        const sched = document.getElementById('quiz-schedule').value;
        if (sched) formData.append('scheduleTime', new Date(sched).toISOString());

        const cover = document.getElementById('quiz-cover');
        if (cover.files[0]) formData.append('coverImage', cover.files[0]);

        formData.append('questions', JSON.stringify(finalQuestions));

        const response = await apiFetch('/quizzes', { method: 'POST', body: formData });

        window.showToast('Quiz created successfully!', 'success');
        setTimeout(() => {
            if (confirm('Quiz Created! Go to Dashboard?')) {
                window.location.href = 'dashboard.html';
            }
        }, 1000);

    } catch (error) {
        console.error('Quiz Create Error:', error);
        const msg = error.message || '';
        showToast(msg || 'Error creating quiz', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

function showToast(msg, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `background: ${type === 'error' ? '#ff6b6b' : (type === 'success' ? '#00c853' : '#333')}; color: white; padding: 12px 24px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); animation: slideIn 0.3s ease;`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
document.head.appendChild(style);