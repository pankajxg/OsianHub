// Global variables for pagination and filtering
let currentPage = 1;
let itemsPerPage = 10;
let allResults = [];
let filteredResults = [];
let currentQuizId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/auth/login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentQuizId = urlParams.get('quizId') || urlParams.get('id');

    if (!currentQuizId) {
        // Show "Select Quiz" state
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="header">
                    <div class="page-title">
                        <h1>Quiz Results</h1>
                    </div>
                </div>
                <div class="card" style="text-align: center; padding: 4rem;">
                    <i class='bx bxs-bar-chart-alt-2' style="font-size: 4rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3>No Quiz Selected</h3>
                    <p style="color: var(--text-muted); margin-bottom: 2rem;">Please select a quiz to view its results.</p>
                    <a href="my-quiz.html" class="btn">
                        <i class='bx bx-list-ul'></i> Go to My Quizzes
                    </a>
                </div>
            `;
        }
        return;
    }

    // Initialize
    await loadResults();
    
    // Setup Real-time updates
    setupWebSocket();

    // Setup event listeners for filters
    const filterStatus = document.getElementById('filterStatus');
    const filterDepartment = document.getElementById('filterDepartment');
    const filterSort = document.getElementById('filterSort');
    const resetBtn = document.querySelector('.btn-outline[onclick="resetFilters()"]');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const exportBtn = document.querySelector('.btn[onclick="exportResults()"]'); 

    if (filterStatus) filterStatus.addEventListener('change', filterResults);
    if (filterDepartment) filterDepartment.addEventListener('change', filterResults);
    if (filterSort) filterSort.addEventListener('change', sortResults);
    
    // Attach event listeners safely
    if (resetBtn) {
        resetBtn.removeAttribute('onclick');
        resetBtn.addEventListener('click', resetFilters);
    }
    if (prevBtn) {
        prevBtn.removeAttribute('onclick');
        prevBtn.addEventListener('click', () => changePage(-1));
    }
    if (nextBtn) {
        nextBtn.removeAttribute('onclick');
        nextBtn.addEventListener('click', () => changePage(1));
    }
    if (exportBtn) {
        exportBtn.removeAttribute('onclick');
        exportBtn.addEventListener('click', exportResults);
    }
});

async function loadResults() {
    try {
        // Show loading state
        const tbody = document.getElementById('resultsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 3rem;">
                        <div class="loading">
                            <i class='bx bx-loader-circle'></i>
                            <p>Loading results...</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        // Fetch Quiz Details
        try {
            const quizData = await apiFetch(`/quizzes/${currentQuizId}`);
            if (quizData && quizData.quiz) {
                const titleEl = document.getElementById('quizTitle');
                if (titleEl) titleEl.textContent = `Results for: ${quizData.quiz.title}`;
            }
        } catch (e) {
            console.error('Error fetching quiz details:', e);
        }

        // Fetch Results
        const data = await apiFetch(`/results/quiz/${currentQuizId}`);
        
        if (!data.results) {
            throw new Error('No results data received');
        }

        allResults = data.results.map(r => {
            // Safe User Extraction
            const userObj = r.user || {};
            const profileObj = userObj.profile || {};

            return {
                id: r._id,
                user: userObj.name || 'Unknown User',
                email: userObj.email || '-',
                // ✅ Extracted University ID & Phone
                universityId: userObj.universityId || profileObj.universityId || '-', 
                phone: userObj.phone || profileObj.phone || '-',
                department: userObj.department || '-',
                score: r.score,
                totalScore: r.totalMarks || 100,
                timeTaken: Number(r.timeTaken) || 0, // Ensure number
                submittedAt: r.completedAt,
                violations: (r.violations?.tabSwitches || 0) + (r.violations?.windowBlurs || 0),
                status: determineStatus(r),
                rawResult: r 
            };
        });

        // Populate Department Filter
        populateDepartmentFilter();

        // Initial Filter & Render
        filteredResults = [...allResults];
        updateTable();
        updateStats();

    } catch (error) {
        console.error('Error loading results:', error);
        
        if (error.message === 'Unauthorized') {
            handleSessionExpired();
            return;
        }

        if (typeof showToast === 'function') {
            showToast('Failed to load results: ' + error.message, 'error');
        }
        const tbody = document.getElementById('resultsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--danger); padding: 2rem;">
                        <i class='bx bx-error-circle' style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <p>Failed to load results: ${error.message}</p>
                    </td>
                </tr>
            `;
        }
    }
}

function handleSessionExpired() {
    const tbody = document.getElementById('resultsTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 3rem;">
                    <div style="color: var(--warning);">
                        <i class='bx bx-log-out-circle' style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h3>Session Expired</h3>
                        <p style="margin-bottom: 1.5rem;">Your session has expired. Please login again to view results.</p>
                        <a href="/frontend/auth/login.html" class="btn">
                            Login Again
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }
}

function determineStatus(r) {
    if (r.cheatingViolation || (r.violations && (r.violations.tabSwitches > 3 || r.violations.windowBlurs > 3))) {
        return 'cheating';
    }
    return 'completed'; 
}

function populateDepartmentFilter() {
    const filterDepartment = document.getElementById('filterDepartment');
    if (!filterDepartment) return;

    const departments = [...new Set(allResults.map(r => r.department).filter(d => d !== '-'))];
    const currentVal = filterDepartment.value;
    
    filterDepartment.innerHTML = '<option value="">All Departments</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        filterDepartment.appendChild(option);
    });

    if (departments.includes(currentVal)) {
        filterDepartment.value = currentVal;
    }
}

function updateTable() {
    const tbody = document.getElementById('resultsTableBody');
    const noResultsDiv = document.getElementById('noResults');
    const tableContainer = document.querySelector('.results-table-container');
    
    if (!tbody) return;

    if (filteredResults.length === 0) {
        tbody.innerHTML = '';
        if (tableContainer) tableContainer.style.display = 'none';
        if (noResultsDiv) noResultsDiv.style.display = 'block';
        return;
    }

    if (noResultsDiv) noResultsDiv.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageResults = filteredResults.slice(startIndex, endIndex);

    let html = '';
    pageResults.forEach(result => {
        const scorePercentage = result.totalScore > 0 ? (result.score / result.totalScore * 100).toFixed(1) : 0;
        
        // ✅ FIX 1: Clean Date Formatting
        const dateOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        const dateFormatted = new Date(result.submittedAt).toLocaleString('en-US', dateOptions);
        
        // ✅ FIX 2: Better Time Duration Formatting
        const timeFormatted = formatTime(result.timeTaken);
        
        // Determine score class
        let scoreClass = 'score-medium';
        if (scorePercentage >= 80) scoreClass = 'score-high';
        else if (scorePercentage < 60) scoreClass = 'score-low';

        // Determine status badge
        let statusBadge = '';
        if (result.status === 'completed') {
            statusBadge = scorePercentage >= 40 ? 
                '<span class="status-badge status-passed"><i class="bx bx-check"></i> Passed</span>' :
                '<span class="status-badge status-failed"><i class="bx bx-x"></i> Failed</span>';
        } else if (result.status === 'incomplete') {
            statusBadge = '<span class="status-badge status-incomplete"><i class="bx bx-time"></i> Incomplete</span>';
        } else if (result.status === 'cheating') {
            statusBadge = '<span class="status-badge status-cheating"><i class="bx bx-error"></i> Cheating</span>';
        }

        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--osian-gradient); display: flex; align-items: center; justify-content: center; color: var(--bg-sidebar); font-weight: 600; font-size: 0.875rem;">
                            ${result.user.charAt(0).toUpperCase()}
                        </div>
                        <span>${result.user}</span>
                    </div>
                </td>
                <td>${result.email}</td>
                <td>${result.universityId}</td> <td>${result.phone}</td>        <td>${result.department}</td>
                <td class="${scoreClass}">${scorePercentage}% (${result.score}/${result.totalScore})</td>
                <td><span class="time-badge">${timeFormatted}</span></td>
                <td>${dateFormatted}</td>
                <td>${result.violations}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    updatePagination();
}

function updateStats() {
    if (filteredResults.length === 0) {
        setTextContent('totalParticipants', '0');
        setTextContent('avgScore', '0');
        setTextContent('avgTime', '0s');
        setTextContent('completionRate', '0%');
        return;
    }

    const completedResults = filteredResults.filter(r => r.status === 'completed' || r.status === 'cheating'); 
    const totalParticipants = filteredResults.length;
    
    const avgScore = completedResults.length > 0 ? 
        (completedResults.reduce((sum, r) => sum + (r.totalScore > 0 ? (r.score/r.totalScore*100) : 0), 0) / completedResults.length).toFixed(1) : 0;
        
    // Avg Time Calculation
    const avgTime = completedResults.length > 0 ? 
        formatTime(Math.round(completedResults.reduce((sum, r) => sum + r.timeTaken, 0) / completedResults.length)) : '0s';
        
    const completionRate = ((completedResults.length / totalParticipants) * 100).toFixed(1);

    setTextContent('totalParticipants', totalParticipants);
    setTextContent('avgScore', avgScore);
    setTextContent('avgTime', avgTime);
    setTextContent('completionRate', completionRate + '%');
}

function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function updatePagination() {
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    updateTable();
}

function filterResults() {
    const statusFilter = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';
    const deptFilter = document.getElementById('filterDepartment') ? document.getElementById('filterDepartment').value : '';

    filteredResults = allResults.filter(result => {
        if (statusFilter && result.status !== statusFilter) return false;
        if (deptFilter && result.department !== deptFilter) return false;
        return true;
    });

    currentPage = 1;
    updateTable();
    updateStats();
}

function sortResults() {
    const sortValue = document.getElementById('filterSort') ? document.getElementById('filterSort').value : '';
    if (!sortValue) return;

    const [field, direction] = sortValue.split('-');
    
    filteredResults.sort((a, b) => {
        let valA, valB;
        switch(field) {
            case 'score':
                valA = a.totalScore > 0 ? (a.score / a.totalScore) : 0;
                valB = b.totalScore > 0 ? (b.score / b.totalScore) : 0;
                break;
            case 'time':
                valA = a.timeTaken;
                valB = b.timeTaken;
                break;
            case 'date':
                valA = new Date(a.submittedAt).getTime();
                valB = new Date(b.submittedAt).getTime();
                break;
            default:
                return 0;
        }
        return direction === 'asc' ? valA - valB : valB - valA;
    });

    updateTable();
}

function resetFilters() {
    const filterStatus = document.getElementById('filterStatus');
    const filterDepartment = document.getElementById('filterDepartment');
    const filterSort = document.getElementById('filterSort');

    if (filterStatus) filterStatus.value = '';
    if (filterDepartment) filterDepartment.value = '';
    if (filterSort) filterSort.value = 'score-desc';

    filteredResults = [...allResults];
    currentPage = 1;
    updateTable();
    updateStats();
}

// ✅ FIX 3: Robust Time Formatter (Handles Hours, Minutes, Seconds)
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0s';
    
    // Remove decimals by flooring
    const totalSeconds = Math.floor(seconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function setupWebSocket() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const isProd = (location.hostname.endsWith('vercel.app') || location.hostname.endsWith('github.io') || location.hostname.includes('osianoffical'));
    const wsBase = isProd ? 'wss://osianoffical-hfp9.vercel.app' : 'ws://localhost:5000';

    const ws = new WebSocket(`${wsBase}/ws?token=${token}`);

    ws.onopen = () => { console.log('Connected to WebSocket for results'); };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'participant_submitted' || data.type === 'quiz_updated') {
                if (!data.quizId || data.quizId === currentQuizId) {
                    if (window.showToast) window.showToast('New result received!', 'info');
                    loadResults();
                }
            }
        } catch (e) { console.error('WS message error', e); }
    };

    ws.onclose = () => { setTimeout(setupWebSocket, 5000); };
    ws.onerror = (err) => { console.error('WebSocket error:', err); };
}

function exportResults() {
    if (!filteredResults || filteredResults.length === 0) {
        if(window.showToast) window.showToast('No results to export.', 'info');
        return;
    }

    const rows = [];
    const headers = [
        'User Name', 
        'Email', 
        'University ID', 
        'Phone', 
        'Department', 
        'Score', 
        'Total Marks', 
        'Percentage', 
        'Time Taken', 
        'Submitted At', 
        'Violations', 
        'Status'
    ];
    rows.push(headers.join(','));

    filteredResults.forEach(r => {
        const percentage = r.totalScore > 0 ? (r.score / r.totalScore * 100).toFixed(1) : 0;
        
        const row = [
            `"${r.user.replace(/"/g, '""')}"`,
            `"${r.email.replace(/"/g, '""')}"`,
            `"${r.universityId.replace(/"/g, '""')}"`, 
            `"${r.phone.replace(/"/g, '""')}"`,
            `"${r.department.replace(/"/g, '""')}"`,
            r.score,
            r.totalScore,
            `${percentage}%`,
            `"${formatTime(r.timeTaken)}"`,
            `"${new Date(r.submittedAt).toLocaleString().replace(/"/g, '""')}"`,
            r.violations,
            `"${r.status}"`
        ];
        rows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `quiz_${currentQuizId}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Make functions available globally
window.changePage = changePage;
window.filterResults = filterResults;
window.sortResults = sortResults;
window.resetFilters = resetFilters;
window.exportResults = exportResults;
