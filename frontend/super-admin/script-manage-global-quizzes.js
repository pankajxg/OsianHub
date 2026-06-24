document.addEventListener('DOMContentLoaded', () => {
    loadGlobalQuizzes();
});

async function loadGlobalQuizzes() {
    const tbody = document.getElementById('quiz-table-body');
    if (!tbody) return;
    
    try {
        // Fetch all quizzes with type=Global
        // The /quizzes endpoint filters by user role.
        // As SuperAdmin, we might need a specific endpoint or just rely on /quizzes returns all?
        // quizController.js getQuizzes: "SuperAdmin sees all"
        // But we want ONLY Global here to separate management.
        // We can pass ?type=Global
        
        const data = await apiFetch('/quizzes?type=Global');
        
        if (!data.quizzes || data.quizzes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No global quizzes found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.quizzes.map(quiz => `
            <tr>
                <td>
                    <div style="font-weight: 600;">${quiz.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${quiz.description ? quiz.description.substring(0, 50) + '...' : ''}</div>
                </td>
                <td>${quiz.category ? quiz.category.name : 'Uncategorized'}</td>
                <td>${quiz.questions ? quiz.questions.length : 0}</td>
                <td>${quiz.duration}m</td>
                <td><span class="status-badge ${quiz.status === 'published' ? 'status-published' : 'status-draft'}">${quiz.status}</span></td>
                <td style="display: flex; gap: 0.5rem;">
                    <button class="btn-action" onclick="window.location.href='/frontend/super-admin/create-quiz.html?edit=${quiz._id}'" title="Edit">
                        <i class='bx bx-edit-alt'></i>
                    </button>
                    <button class="btn-action" onclick="window.location.href='/frontend/super-admin/all-results.html?quizId=${quiz._id}'" title="Results">
                        <i class='bx bx-bar-chart-alt-2'></i>
                    </button>
                    <button class="btn-action delete" onclick="deleteQuiz('${quiz._id}')" title="Delete">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading quizzes:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #ff6b6b;">Error loading data.</td></tr>';
    }
}

window.deleteQuiz = async function(id) {
    if (!confirm('Are you sure you want to delete this quiz? All results associated with it will be lost.')) return;

    try {
        const res = await apiFetch(`/quizzes/${id}`, { method: 'DELETE' });
        if (res.success) {
            if(window.showToast) window.showToast('Quiz deleted.', 'success');
            loadGlobalQuizzes();
        } else {
            if(window.showToast) window.showToast(res.message || 'Failed to delete.', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
};
