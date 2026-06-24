document.addEventListener('DOMContentLoaded', async () => {
    // State management
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const noDataState = document.getElementById('noDataState');
    const resultsTable = document.getElementById('resultsTable');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const errorMessage = document.getElementById('errorMessage');

    // Ensure we are superadmin (double check, auth-guard handles basic)
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'superadmin') {
        window.location.href = '../auth/login.html';
        return;
    }

    // Helper Functions
    function showLoading() {
        if(loadingState) loadingState.style.display = 'flex';
        if(errorState) errorState.style.display = 'none';
        if(noDataState) noDataState.style.display = 'none';
        if(resultsTable) resultsTable.style.display = 'none';
    }

    function showError(message) {
        if(loadingState) loadingState.style.display = 'none';
        if(errorState) errorState.style.display = 'block';
        if(noDataState) noDataState.style.display = 'none';
        if(resultsTable) resultsTable.style.display = 'none';
        if(errorMessage) errorMessage.textContent = message;
    }

    function showNoData() {
        if(loadingState) loadingState.style.display = 'none';
        if(errorState) errorState.style.display = 'none';
        if(noDataState) noDataState.style.display = 'block';
        if(resultsTable) resultsTable.style.display = 'none';
    }

    function showResults() {
        if(loadingState) loadingState.style.display = 'none';
        if(errorState) errorState.style.display = 'none';
        if(noDataState) noDataState.style.display = 'none';
        if(resultsTable) resultsTable.style.display = 'table';
    }

    function getInitials(name) {
        if (!name) return 'U';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    function getScoreClass(score, total) {
        if (!total) return 'score-low';
        const percentage = (score / total) * 100;
        if (percentage >= 70) return 'score-high';
        if (percentage >= 40) return 'score-medium';
        return 'score-low';
    }

    function getStatus(score, total, passingThreshold = 40) {
        if (!total) return 'Fail';
        const percentage = (score / total) * 100;
        return percentage >= passingThreshold ? 'Pass' : 'Fail';
    }

    async function loadResults() {
        showLoading();
        
        try {
            // Use /results/global to fetch Global Quiz results
            // Use apiFetch which handles base URL and auth headers
            const data = await apiFetch('/results/global');

            if (!data || !data.success) {
                throw new Error(data?.message || 'Failed to fetch results');
            }

            const results = data.results;

            if (!results || results.length === 0) {
                showNoData();
                return;
            }

            // Clear previous results
            if(resultsTableBody) resultsTableBody.innerHTML = '';

            // Populate table with results
            results.forEach(result => {
                const row = document.createElement('tr');
                
                // Extract User Info safely
                const userName = result.user ? result.user.name : 'Unknown User';
                const userEmail = result.user ? result.user.email : 'N/A';
                
                // Extract Quiz Info safely
                const quizTitle = result.quiz ? result.quiz.title : 'Deleted Quiz';

                // Create student avatar and name
                const studentCell = document.createElement('td');
                studentCell.innerHTML = `
                    <div class="student-info">
                        <div class="student-avatar">${getInitials(userName)}</div>
                        <span>${userName}</span>
                    </div>
                `;
                
                // Email
                const emailCell = document.createElement('td');
                emailCell.textContent = userEmail;
                
                // Quiz title
                const quizCell = document.createElement('td');
                quizCell.textContent = quizTitle;
                
                // Score
                const scoreCell = document.createElement('td');
                const score = result.score || 0;
                const totalMarks = result.totalMarks || 100; // fallback
                const scoreClass = getScoreClass(score, totalMarks);
                
                scoreCell.innerHTML = `
                    <span class="score-cell ${scoreClass}">
                        ${score}/${totalMarks}
                    </span>
                `;
                
                // Date
                const dateCell = document.createElement('td');
                const dateStr = result.completedAt ? new Date(result.completedAt).toLocaleDateString() : 'N/A';
                dateCell.textContent = dateStr;
                
                // Status
                const statusCell = document.createElement('td');
                const status = getStatus(score, totalMarks);
                statusCell.innerHTML = `
                    <span class="status-badge status-${status.toLowerCase()}">
                        ${status}
                    </span>
                `;
                
                // Append all cells to row
                row.appendChild(studentCell);
                row.appendChild(emailCell);
                row.appendChild(quizCell);
                row.appendChild(scoreCell);
                row.appendChild(dateCell);
                row.appendChild(statusCell);
                
                // Add row to table
                if(resultsTableBody) resultsTableBody.appendChild(row);
            });

            showResults();

        } catch (error) {
            console.error('Error loading results:', error);
            showError(error.message || 'Failed to load results');
        }
    }

    // Expose loadResults globally for Retry button
    window.loadResults = loadResults;

    // Initial load
    loadResults();
});
