function resolveEventImageUrl(src) {
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    var base = (window.API_BASE || '').replace(/\/api\/?$/, '');
    if (!base) return src;
    if (src.startsWith('/')) return base + src;
    return base + '/' + src;
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');

    async function fetchEvents() {
        const container = document.getElementById('events-list');
        if (!container) return;

        try {
            const params = new URLSearchParams();
            if (searchInput && searchInput.value) params.set('q', searchInput.value);
            if (categoryFilter && categoryFilter.value) params.set('category', categoryFilter.value);
            if (statusFilter && statusFilter.value) params.set('status', statusFilter.value);
            if (dateFrom && dateFrom.value) params.set('dateFrom', dateFrom.value);
            if (dateTo && dateTo.value) params.set('dateTo', dateTo.value);
            const data = await apiFetch(`/events?${params.toString()}`);
            if (data.success) {
                renderEvents(data.events, container);
            } else {
                container.innerHTML = '<p class="text-muted">Failed to load events.</p>';
            }
        } catch (error) {
            console.error('Events fetch error:', error);
            container.innerHTML = '<p class="text-muted">Error loading events.</p>';
        }
    }

    function renderEvents(events, container) {
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="bx bx-calendar-x"></i><h3>No Events Found</h3><p>Try adjusting your filters.</p></div>';
            return;
        }

        container.innerHTML = events.map(event => {
            const sDate = new Date(event.startDate);
            const date = sDate.toLocaleDateString();
            const time = sDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const now = new Date();
            
            // Registration Window Logic
            const regStart = event.registrationStart ? new Date(event.registrationStart) : null;
            const regEnd = event.registrationEnd ? new Date(event.registrationEnd) : null;
            
            let isRegWindowOpen = true;
            if (regStart && now < regStart) isRegWindowOpen = false;
            if (regEnd && now > regEnd) isRegWindowOpen = false;

            const slotsOpen = !event.maxParticipants || event.registeredCount < event.maxParticipants;
            const isCompleted = event.status === 'Completed';
            
            // "Registrations Closed" Condition (Backend Flag + Logic)
            const registrationClosed = !!event.registrationClosed || !isRegWindowOpen || !slotsOpen || isCompleted;

            const canRegister = !event.isRegistered && !registrationClosed;

            let actionBtn = '';
            if (event.isRegistered) {
                actionBtn = `<button class="btn-register btn-disabled" disabled>Registered</button>`;
            } else if (canRegister) {
                // Link to details page for dynamic form
                actionBtn = `<a href="event-details.html?id=${event._id}" class="btn-register">Register Now</a>`;
            } else {
                let reason = 'Closed';
                if (!!event.registrationClosed) reason = 'Closed';
                else if (!isRegWindowOpen) {
                    if (regStart && now < regStart) reason = 'Not Started';
                    else reason = 'Closed';
                }
                else if (!slotsOpen) reason = 'Full';
                else if (isCompleted) reason = 'Completed';
                
                actionBtn = `<button class="btn-register btn-disabled" disabled>${reason}</button>`;
            }

            const imgSrc = event.eventImage ? resolveEventImageUrl(event.eventImage) : '';

            return `
            <div class="event-card">
                <div class="event-image">
                    ${imgSrc ? `<img src="${imgSrc}" alt="${event.title}">` : `<i class='bx bx-calendar-event'></i>`}
                </div>
                <div class="event-content">
                    <div class="event-header">
                        <div class="event-title">${event.title}</div>
                        <div style="display:flex;gap:5px;">
                             <span class="event-badge ${event.status === 'Live' ? 'badge-live' : 'badge-upcoming'}">${event.status}</span>
                        </div>
                    </div>
                    
                    <div class="event-meta">
                        <div class="meta-item"><i class='bx bx-category'></i> ${event.category}</div>
                        <div class="meta-item"><i class='bx bx-calendar'></i> ${date} at ${time}</div>
                        <div class="meta-item"><i class='bx bx-map'></i> ${event.venue || 'Online'}</div>
                    </div>
                    
                    <div class="event-description">
                        ${event.description || 'No description available.'}
                    </div>
                    
                    <div class="event-footer">
                        <div class="event-stats">
                            <div class="stat-item"><i class='bx bx-user'></i> ${event.registeredCount || 0} Reg</div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            ${actionBtn}
                            <a class="btn-view-details" href="event-details.html?id=${event._id}">Details</a>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    if (searchInput) searchInput.addEventListener('input', () => fetchEvents());
    if (categoryFilter) categoryFilter.addEventListener('change', () => fetchEvents());
    if (statusFilter) statusFilter.addEventListener('change', () => fetchEvents());
    if (dateFrom) dateFrom.addEventListener('change', () => fetchEvents());
    if (dateTo) dateTo.addEventListener('change', () => fetchEvents());
    
    // Initial Load
    fetchEvents();
});
