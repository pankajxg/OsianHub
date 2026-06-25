function resolveEventImageUrl(src) {
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    var base = (window.API_BASE || '').replace(/\/api\/?$/, '');
    if (!base) return src;
    if (src.startsWith('/')) return base + src;
    return base + '/' + src;
}

document.addEventListener('DOMContentLoaded', function () {
    var token = localStorage.getItem('token');
    if (!token) {
        window.location.href = window.getRedirectUrl ? window.getRedirectUrl('/frontend/auth/login.html') : '/frontend/auth/login.html';
        return;
    }

    initMobileMenu();
    loadRegistrations();

    function initMobileMenu() {
        var menuBtn = document.getElementById('mobile-menu-btn');
        var sidebar = document.querySelector('.sidebar');
        var overlay = document.getElementById('overlay');
        if (menuBtn && sidebar && overlay) {
            menuBtn.addEventListener('click', function () {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            });
            overlay.addEventListener('click', function () {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }
    }

    async function loadRegistrations() {
        var container = document.getElementById('registrations-list');
        var empty = document.getElementById('registrations-empty');
        if (!container) return;
        container.innerHTML = "<div class=\"registration-card\"><div class=\"registration-body\"><div>Loading registrations...</div></div></div>";
        try {
            var res = await apiFetch('/events/my-registrations');
            if (!res || !res.success) {
                container.innerHTML = "<div class=\"registration-card\"><div class=\"registration-body\"><div>Failed to load registrations.</div></div></div>";
                return;
            }
            var regs = res.registrations || [];
            if (!regs.length) {
                container.innerHTML = '';
                if (empty) empty.style.display = 'block';
                return;
            }
            if (empty) empty.style.display = 'none';
            renderRegistrations(regs, container);
        } catch (e) {
            container.innerHTML = "<div class=\"registration-card\"><div class=\"registration-body\"><div>Error loading registrations.</div></div></div>";
        }
    }

    function renderRegistrations(regs, container) {
        container.innerHTML = '';
        regs.forEach(function (r) {
            var ev = r.event || {};
            var data = r.registrationData || {};
            var bannerSrc = ev.eventImage ? resolveEventImageUrl(ev.eventImage) : '';
            var card = document.createElement('div');
            card.className = 'registration-card';
            var regDate = r.registeredAt ? new Date(r.registeredAt) : null;
            var eventDate = ev.startDate ? new Date(ev.startDate) : null;
            var statusClass = 'badge-status-upcoming';
            if (ev.status === 'Live') statusClass = 'badge-status-live';
            if (ev.status === 'Completed') statusClass = 'badge-status-completed';
            var skillsText = Array.isArray(data.skills) && data.skills.length ? data.skills.join(', ') : '';
            var dynamicList = '';
            if (Array.isArray(data.dynamicResponses) && data.dynamicResponses.length) {
                dynamicList = data.dynamicResponses.map(function (d) {
                    return "<div class=\"registration-details-row\"><div class=\"registration-details-label\">" + (d.label || d.fieldId || '') + "</div><div class=\"registration-details-value\">" + formatValue(d.value) + "</div></div>";
                }).join('');
            }
            var customList = '';
            if (Array.isArray(data.customAnswers) && data.customAnswers.length) {
                customList = data.customAnswers.map(function (d) {
                    return "<div class=\"registration-details-row\"><div class=\"registration-details-label\">" + (d.question || '') + "</div><div class=\"registration-details-value\">" + (d.answer || '') + "</div></div>";
                }).join('');
            }
            card.innerHTML =
                "<div class=\"registration-banner\">" +
                (bannerSrc ? "<img src=\"" + bannerSrc + "\" alt=\"" + (ev.title || 'Event') + "\">" : "<i class='bx bx-calendar-event'></i>") +
                "</div>" +
                "<div class=\"registration-body\">" +
                "<div class=\"registration-title\">" + (ev.title || 'Event') + "</div>" +
                "<div class=\"registration-meta\">" +
                "<div class=\"registration-meta-item\"><i class='bx bx-calendar'></i><span>" + (eventDate ? eventDate.toLocaleString() : 'Date TBD') + "</span></div>" +
                "<div class=\"registration-meta-item\"><i class='bx bx-map'></i><span>" + (ev.venue || 'Online') + "</span></div>" +
                "<div class=\"registration-meta-item\"><i class='bx bx-time-five'></i><span>Registered " + (regDate ? regDate.toLocaleString() : '') + "</span></div>" +
                "</div>" +
                "<div class=\"registration-tags\">" +
                (ev.category ? "<span class=\"registration-tag\">" + ev.category + "</span>" : "") +
                (ev.eventType ? "<span class=\"registration-tag\">" + ev.eventType + "</span>" : "") +
                "</div>" +
                "<div class=\"registration-details\">" +
                (data.fullName ? "<div class=\"registration-details-row\"><div class=\"registration-details-label\">Name</div><div class=\"registration-details-value\">" + data.fullName + "</div></div>" : "") +
                (data.email ? "<div class=\"registration-details-row\"><div class=\"registration-details-label\">Email</div><div class=\"registration-details-value\">" + data.email + "</div></div>" : "") +
                (data.phone ? "<div class=\"registration-details-row\"><div class=\"registration-details-label\">Phone</div><div class=\"registration-details-value\">" + data.phone + "</div></div>" : "") +
                (skillsText ? "<div class=\"registration-details-row\"><div class=\"registration-details-label\">Skills</div><div class=\"registration-details-value\">" + skillsText + "</div></div>" : "") +
                (data.experience ? "<div class=\"registration-details-row\"><div class=\"registration-details-label\">Experience</div><div class=\"registration-details-value\">" + data.experience + "</div></div>" : "") +
                dynamicList +
                customList +
                "</div>" +
                "</div>" +
                "<div class=\"registration-footer\">" +
                "<div><span class=\"badge-status " + statusClass + "\">" + (ev.status || 'Upcoming') + "</span></div>" +
                "<a href=\"event-details.html?id=" + (ev._id || '') + "\" style=\"color: var(--osian-cyan); text-decoration: none; display:flex; align-items:center; gap:0.3rem;\"><i class='bx bx-link-external'></i><span>View Event</span></a>" +
                "</div>";
            container.appendChild(card);
        });
    }

    function formatValue(v) {
        if (Array.isArray(v)) return v.join(', ');
        if (v === null || v === undefined) return '';
        return String(v);
    }
});

