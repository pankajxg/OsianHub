document.addEventListener('DOMContentLoaded', function() {
    // loadSidebar(); // Handled by shared-init.js
    fetchCertificates();
    setInterval(fetchCertificates, 60000);


    async function fetchCertificates() {
        const grid = document.getElementById('certificates-grid');
        try {
            const data = await window.apiFetch('/certificates');
            
            if (data && data.success && data.certificates && data.certificates.length > 0) {
                renderCertificates(data.certificates);
            } else {
                renderEmptyState();
            }
        } catch (error) {
            console.error('Error fetching certificates:', error);
            // Fallback for demo if API fails
            renderEmptyState();
        }
    }

    function renderCertificates(certs) {
        const grid = document.getElementById('certificates-grid');
        grid.innerHTML = certs.map(cert => `
            <div class="certificate-card">
                <div class="cert-preview">
                    <i class='bx bx-award'></i>
                    <div class="cert-seal"><i class='bx bx-check'></i></div>
                </div>
                <div class="cert-content">
                    <h3 class="cert-title">${(cert.quiz && cert.quiz.title) || cert.quizTitle || 'Certificate of Achievement'}</h3>
                    <span class="cert-date">Issued on ${new Date(cert.createdAt || cert.issuedAt || Date.now()).toLocaleDateString()}</span>
                    <div class="cert-actions">
                        <button class="cert-btn btn-download" onclick="downloadCertificate('${cert._id || cert.id}')">
                            <i class='bx bx-download'></i> Download
                        </button>
                        <button class="cert-btn btn-share" onclick="window.showToast('Link copied to clipboard!', 'success')">
                            <i class='bx bx-share-alt'></i> Share
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    window.downloadCertificate = async function(certId) {
        try {
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
                a.download = `Certificate-${certId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                if (window.showToast) window.showToast('Failed to download certificate', 'error');
            }
        } catch (e) {
            console.error('Download error', e);
            if (window.showToast) window.showToast('Error downloading certificate', 'error');
        }
    }

    function renderEmptyState() {
        const grid = document.getElementById('certificates-grid');
        grid.innerHTML = `
            <div class="content-box" style="grid-column: 1 / -1; text-align: center; padding: 50px;">
                <i class='bx bx-certification' style="font-size: 48px; color: var(--text-muted); margin-bottom: 20px;"></i>
                <h3>No certificates yet</h3>
                <p>Complete quizzes with a passing score to earn certificates.</p>
                <a href="global-quizzes.html" class="start-btn" style="max-width: 200px; margin: 20px auto;">Start Learning</a>
            </div>
        `;
    }
});
