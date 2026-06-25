document.addEventListener("DOMContentLoaded", function() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = window.getRedirectUrl ? window.getRedirectUrl('/frontend/auth/login.html') : '/frontend/auth/login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const openResultId = params.get('open');

    // Initialize View
    initMobileMenu();
    fetchHistory().finally(() => {
        if (openResultId) {
            window.viewResultDetail(openResultId);
        }
    });

    function initMobileMenu() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar'); // This might need to be added dynamically if not present
        const overlay = document.getElementById('overlay'); // Ensure this exists in HTML
        
        // If sidebar/overlay don't exist in results.html, we might need to inject them or handle differently.
        // results.html usually doesn't have the full sidebar markup unless injected.
        // Let's assume shared-init.js or similar handles injection, or we check if they exist.
        
        if (menuBtn && sidebar && overlay) {
             menuBtn.addEventListener('click', () => {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            });
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        } else {
             // Try to load sidebar if missing (similar to dashboard)
             if(!document.getElementById('sidebar-container')) {
                 // logic to load sidebar if needed, but results.html usually links back to dashboard
             }
        }
    }

    window.backToList = function() {
        document.getElementById('results-detail-view').style.display = 'none';
        document.getElementById('results-list-view').style.display = 'block';
    };

    async function fetchHistory() {
        const tbody = document.getElementById('historyTableBody');
        
        try {
            const data = await apiFetch('/results/my-results');

            if (data.success) {
                renderHistory(data.results);
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Failed to load history: ${data.message}</td></tr>`;
            }
        } catch (error) {
            console.error("Error fetching history:", error);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Error connecting to server.</td></tr>`;
        }
    }

    function renderHistory(results) {
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        if (!results || results.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No quiz attempts yet. Go to <a href="quizzes.html" style="color: var(--osian-cyan);">Quizzes</a> to start one!</td></tr>`;
            return;
        }

        results.forEach(result => {
            const tr = document.createElement('tr');
            
            const date = new Date(result.completedAt).toLocaleDateString() + ' ' + new Date(result.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const score = result.score;
            const total = result.totalMarks || 0;
            const percentage = total > 0 ? (score / total) * 100 : 0;
            const passed = percentage >= 40; // 40% passing criteria
            
            const statusBadge = passed 
                ? `<span class="status-badge status-pass">Passed</span>`
                : `<span class="status-badge status-fail">Failed</span>`;

            const quizTitle = result.quiz ? result.quiz.title : (result.quizId ? result.quizId.title : '<span style="color:red;">Deleted Quiz</span>');

            tr.innerHTML = `
                <td><strong>${quizTitle}</strong></td>
                <td>${date}</td>
                <td>${score} / ${total} <span style="color: var(--text-muted); font-size: 0.8em;">(${Math.round(percentage)}%)</span></td>
                <td>${statusBadge}</td>
                <td>
                    <button onclick="viewResultDetail('${result._id}')" class="view-btn">
                        View Details
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.viewResultDetail = async function(resultId) {
        const detailContainer = document.getElementById('detail-content');
        if (!detailContainer) return;
        
        detailContainer.innerHTML = '<div style="text-align:center;"><i class="bx bx-loader-alt bx-spin" style="font-size: 3rem; color: var(--osian-cyan);"></i></div>';
        
        const listView = document.getElementById('results-list-view');
        const detailView = document.getElementById('results-detail-view');
        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'block';

        try {
            const response = await apiFetch(`/results/${resultId}`);
            
            if (!response.success) {
                throw new Error(response.message || 'Failed to fetch details');
            }

            const result = response.result;
            const quiz = result.quiz || result.quizId; // Handle populated vs id
            
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
            
            detailContainer.innerHTML = html;

        } catch (error) {
            console.error(error);
            detailContainer.innerHTML = '<p class="text-danger">Error loading details.</p>';
        }
    };

    window.downloadCertificate = async function(resultId) {
        try {
            // First, ensure certificate exists or generate it
            const res = await apiFetch('/certificates/generate', {
                method: 'POST',
                body: JSON.stringify({ resultId })
            });
            
            if (res.success && res.certificate) {
                const certId = res.certificate._id || res.certificate.id;
                
                // Now download the PDF
                const token = localStorage.getItem('token');
                 const baseUrl = window.API_BASE || 'https://osianoffical-hfp9.vercel.app/api';
                
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
                    if (window.showToast) window.showToast('Certificate downloaded successfully!', 'success');
                } else {
                    if (window.showToast) window.showToast('Failed to download PDF.', 'error');
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
});
