document.addEventListener("DOMContentLoaded", function() {
    const token = localStorage.getItem('token');
    
    // Auth check handled by auth-guard
    if (!token) return;

    // Initialize Dashboard
    initDashboard();

    async function initDashboard() {
        try {
            await Promise.all([
                loadSuperAdminKpis(),
                loadActivityChart()
            ]);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            if (window.showToast) window.showToast('Failed to load dashboard data', 'error');
        }
    }

    async function loadSuperAdminKpis() {
        try {
            const data = await apiFetch('/analytics/superadmin-kpis');
            
            if (data.success && data.kpis) {
                const k = data.kpis;
                
                // Animate numbers
                animateValue('sup-kpi-total-users', 0, k.totalUsers || 0, 1000);
                animateValue('sup-kpi-total-admins', 0, k.totalAdmins || 0, 1000);
                animateValue('sup-kpi-live-quizzes', 0, k.liveQuizzes || 0, 1000);
                animateValue('sup-kpi-active-users', 0, k.activeUsersNow || 0, 1000);
                
                // New metrics (try to find them if available, else 0)
                animateValue('sup-kpi-total-attempts', 0, k.totalAttempts || 0, 1000);
                animateValue('sup-kpi-categories', 0, k.totalCategories || 0, 1000);
            }
        } catch (e) {
            console.error('Error loading KPIs:', e);
        }
    }

    async function loadActivityChart() {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        try {
            const data = await apiFetch('/analytics/charts');
            
            if (!data.success || !data.charts) {
                 console.error('Invalid chart data');
                 return;
            }
            
            // Premium Colors
            const osianCyan = '#5FFBF1';
            const osianCyanAlpha = 'rgba(95, 251, 241, 0.2)';
            const textMuted = '#8FA9C4';
            const gridColor = 'rgba(255, 255, 255, 0.05)';
            
            // Prepare data
            const chartData = {
                labels: data.charts.months || [],
                datasets: [{
                    label: 'New Users',
                    data: data.charts.userCount || [],
                    backgroundColor: osianCyanAlpha,
                    borderColor: osianCyan,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: osianCyan,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: osianCyan
                }]
            };

            new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textMuted, font: { family: 'Inter' } },
                            border: { display: false }
                        },
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textMuted, font: { family: 'Inter' } },
                            border: { display: false }
                        }
                    },
                    plugins: {
                        legend: { 
                            labels: { 
                                color: '#E6F1FF',
                                font: { family: 'Inter', size: 12 }
                            } 
                        },
                        tooltip: {
                            backgroundColor: 'rgba(13, 20, 34, 0.9)',
                            titleColor: '#E6F1FF',
                            bodyColor: '#BFD3E6',
                            borderColor: 'rgba(95, 251, 241, 0.2)',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return `New Users: ${context.parsed.y}`;
                                }
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                }
            });

        } catch (e) {
            console.error('Error loading chart:', e);
        }
    }

    function animateValue(id, start, end, duration) {
        const obj = document.getElementById(id);
        if (!obj) return;
        
        // Ensure end is a number
        end = parseInt(end, 10);
        if (isNaN(end)) end = 0;
        
        if (start === end) {
            obj.textContent = end.toLocaleString();
            return;
        }

        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.textContent = Math.floor(progress * (end - start) + start).toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.textContent = end.toLocaleString();
            }
        };
        window.requestAnimationFrame(step);
    }
});
