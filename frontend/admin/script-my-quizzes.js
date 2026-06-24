
// Quiz status mapping
const QUIZ_STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    SCHEDULED: 'scheduled',
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

// Quiz types
const QUIZ_TYPES = {
    REGULAR: 'regular',
    LIVE: 'live',
    PAID: 'paid',
    GAME: 'game'
};

// Format date utility
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format duration utility
function formatDuration(minutes) {
    if (!minutes) return '-';
    if (minutes < 60) {
        return `${minutes} mins`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }
}

// Calculate completion rate
function calculateCompletionRate(participants) {
    if (!participants || participants.length === 0) return 0;
    const completed = participants.filter(p => p.status === 'completed').length;
    return Math.round((completed / participants.length) * 100);
}

// Get quiz statistics (Helper for client-side calculation if needed)
function getQuizStats(quizzes) {
    if (!quizzes) return { totalQuizzes: 0, activeQuizzes: 0, totalParticipants: 0, avgCompletion: 0 };
    
    const totalQuizzes = quizzes.length;
    const activeQuizzes = quizzes.filter(q => q.status === QUIZ_STATUS.ACTIVE).length;
    
    let totalParticipants = 0;
    quizzes.forEach(quiz => {
        totalParticipants += quiz.participants?.length || 0;
    });
    
    let totalCompletion = 0;
    quizzes.forEach(quiz => {
        totalCompletion += calculateCompletionRate(quiz.participants);
    });
    const avgCompletion = totalQuizzes > 0 ? Math.round(totalCompletion / totalQuizzes) : 0;
    
    return {
        totalQuizzes,
        activeQuizzes,
        totalParticipants,
        avgCompletion
    };
}

// Extract unique categories from quizzes
function extractCategories(quizzes) {
    if (!quizzes) return [];
    const categories = new Set();
    quizzes.forEach(quiz => {
        if (quiz.category) {
            categories.add(quiz.category);
        }
    });
    return Array.from(categories).sort();
}

// Fetch My Quizzes
async function fetchMyQuizzes() {
    try {
        // Use apiFetch which handles auth headers and base URL
        const response = await apiFetch('/quizzes/my-quizzes');
        
        // Ensure response has expected structure
        // If backend returns just array, wrap it
        if (Array.isArray(response)) {
             return {
                 quizzes: response,
                 stats: getQuizStats(response),
                 categories: extractCategories(response)
             };
        }
        
        return response;
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        throw error; // Propagate error, DO NOT fallback to mock data
    }
}

// Update quiz status
async function updateQuizStatus(quizId, status) {
    try {
        const response = await apiFetch(`/quizzes/${quizId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        return response;
    } catch (error) {
        console.error('Error updating quiz status:', error);
        throw error;
    }
}

// Delete quiz
async function deleteQuiz(quizId) {
    try {
        await apiFetch(`/quizzes/${quizId}`, {
            method: 'DELETE'
        });
        return true;
    } catch (error) {
        console.error('Error deleting quiz:', error);
        throw error;
    }
}

// Duplicate quiz
async function duplicateQuiz(quizId) {
    try {
        const response = await apiFetch(`/quizzes/${quizId}/duplicate`, {
            method: 'POST'
        });
        return response;
    } catch (error) {
        console.error('Error duplicating quiz:', error);
        throw error;
    }
}

// Get quiz participants
async function getQuizParticipants(quizId) {
    try {
        const response = await apiFetch(`/quizzes/${quizId}/participants`);
        return response;
    } catch (error) {
        console.error('Error fetching participants:', error);
        throw error;
    }
}

// Export quiz results
async function exportQuizResults(quizId, format = 'csv') {
    try {
        // For blob/download, apiFetch might need adjustment or use raw fetch with token
        // But apiFetch usually parses JSON. 
        // We'll use raw fetch here because we need blob for CSV
        
        const token = localStorage.getItem('token');
        
        // Use window.API_BASE or fallback to production
        const baseUrl = window.API_BASE || 'https://osianoffical-hfp9.vercel.app/api';

        const response = await fetch(`${baseUrl}/quizzes/${quizId}/export`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': format === 'csv' ? 'text/csv' : 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Failed to export results: ${response.status}`);
        }

        if (format === 'csv') {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quiz-results-${quizId}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            return await response.json();
        }
    } catch (error) {
        console.error('Error exporting results:', error);
        if (typeof showToast === 'function') showToast(error.message, 'error');
        throw error;
    }
}

// Real-time updates using WebSocket
function setupWebSocket() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Use correct WS URL
    const isProd = (location.hostname.endsWith('vercel.app') || location.hostname.endsWith('github.io') || location.hostname.includes('osianoffical'));
    const wsBase = isProd ? 'wss://osianoffical-hfp9.vercel.app' : 'ws://localhost:5000'; // Port 5000 for backend

    const ws = new WebSocket(`${wsBase}/ws?token=${token}`);

    ws.onopen = () => {
        console.log('WebSocket connected for real-time updates');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'quiz_created':
                case 'quiz_updated':
                case 'quiz_deleted':
                    // Refresh quizzes list if function exists
                    if (typeof window.fetchQuizzes === 'function') {
                        window.fetchQuizzes();
                    } else if (typeof fetchMyQuizzes === 'function') {
                        // If we are in a context where we manage state manually
                        fetchMyQuizzes().then(data => {
                             // Dispatch event or update UI if possible
                             // This is harder without a framework
                        });
                    }
                    break;
                case 'participant_joined':
                case 'participant_submitted':
                    // Update specific quiz stats
                    if (data.quizId) updateQuizStats(data.quizId);
                    break;
            }
        } catch (e) {
            console.error('WS message error', e);
        }
    };

    ws.onclose = () => {
        // Reconnect after delay
        setTimeout(setupWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Update specific quiz stats
async function updateQuizStats(quizId) {
    try {
        const response = await apiFetch(`/quizzes/${quizId}/stats`);
        if (response) {
            updateQuizCard(quizId, response);
        }
    } catch (error) {
        console.error('Error updating quiz stats:', error);
    }
}

// Update specific quiz card in UI
function updateQuizCard(quizId, stats) {
    const quizCard = document.querySelector(`[data-quiz-id="${quizId}"]`);
    if (quizCard) {
        const participantsEl = quizCard.querySelector('.participant-count');
        const completionEl = quizCard.querySelector('.completion-rate');
        
        if (participantsEl && stats.participantsCount !== undefined) {
            participantsEl.textContent = `${stats.participantsCount} Participants`;
        }
        
        if (completionEl && stats.completionRate !== undefined) {
            completionEl.textContent = `${stats.completionRate}%`;
            const progressBar = quizCard.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${stats.completionRate}%`;
            }
        }
    }
}

// Initialize real-time updates
function initializeRealTimeUpdates() {
    if ('WebSocket' in window) {
        setupWebSocket();
    } else {
        // Fallback to polling
        setInterval(() => {
            if (typeof window.fetchQuizzes === 'function') {
                window.fetchQuizzes();
            }
        }, 30000); 
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        // Let auth-guard handle redirect usually, but just in case
        return; 
    }

    // Initial fetch of quizzes
    if (typeof fetchMyQuizzes === 'function') {
        fetchMyQuizzes().then(data => {
            // If the page has a function to render the data, call it.
            // Since this script seems to be a helper library, we need to know how it's used.
            // But looking at my-quiz.html, it likely has its own script or expects this one to do the rendering.
            // Wait, script-my-quizzes.js seems to be a module of helpers, NOT the main page script.
            // The main page script is likely inline in my-quiz.html or another file.
            // Let's check my-quiz.html content again.
        }).catch(console.error);
    }

    // Start real-time updates
    initializeRealTimeUpdates();
});

// Export functions for use in HTML
window.quizManager = {
    fetchMyQuizzes,
    updateQuizStatus,
    deleteQuiz,
    duplicateQuiz,
    getQuizParticipants,
    exportQuizResults,
    formatDate,
    formatDuration,
    calculateCompletionRate
};
