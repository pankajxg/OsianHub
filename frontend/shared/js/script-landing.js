document.addEventListener('DOMContentLoaded', () => {
    // Hamburger Menu Logic
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        }));
    }

    // Navbar Scroll Effect
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Smooth Scroll for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Adjust for fixed header
                const headerHeight = document.querySelector('.header').offsetHeight;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // Check Auth State for Navbar Buttons
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const navLogin = document.getElementById('nav-login');
    const navSignup = document.getElementById('nav-signup');
    const navLogout = document.getElementById('nav-logout');

    if (token && user) {
        if (navLogin) navLogin.style.display = 'none';
        if (navSignup) navSignup.style.display = 'none';
        if (navLogout) {
            navLogout.style.display = 'inline-block';
            navLogout.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.reload();
            });
        }
        
        // Optional: Add "Go to Dashboard" button
        const navButtons = document.querySelector('.nav-buttons');
        if (navButtons) {
            const dashboardBtn = document.createElement('a');
            dashboardBtn.className = 'btn btn-primary';
            dashboardBtn.textContent = 'Dashboard';
            
            if (user.role === 'superadmin') dashboardBtn.href = '/frontend/super-admin/dashboard.html';
            else if (user.role === 'admin') dashboardBtn.href = '/frontend/admin/dashboard.html';
            else dashboardBtn.href = '/frontend/user/dashboard.html';
            
            navButtons.insertBefore(dashboardBtn, navLogout);
        }
    }
});
