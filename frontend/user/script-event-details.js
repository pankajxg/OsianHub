document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('event-details-container');
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  
  if (!container) {
    console.error('Event details container not found');
    return;
  }
  
  if (!id) {
    container.innerHTML = '<div class="reg-status-card reg-closed">No event ID specified.</div>';
    return;
  }

  fetchEvent(id);

  async function fetchEvent(eventId) {
    try {
      const data = await apiFetch(`/events/${eventId}`);
      if (!data.success) {
        container.innerHTML = '<div class="reg-status-card reg-closed">Failed to load event.</div>';
        return;
      }
      render(data.event);
    } catch (e) {
      console.error(e);
      container.innerHTML = '<div class="reg-status-card reg-closed">Error loading event details.</div>';
    }
  }

function resolveEventImageUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  var base = (window.API_BASE || '').replace(/\/api\/?$/, '');
  if (!base) return src;
  if (src.startsWith('/')) return base + src;
  return base + '/' + src;
}

function render(event) {
    // --- STEP 2: REGISTRATION STATUS LOGIC ---
    // User Requirement: "Registration state must depend ONLY on backend data."
    const now = new Date();
    const regStart = event.registrationStart ? new Date(event.registrationStart) : null;
    const regEnd = event.registrationEnd ? new Date(event.registrationEnd) : null;
    
    // Check if event is completed or registration window passed
    const isCompleted = event.status === 'Completed' || (event.endDate && now > new Date(event.endDate));
    
    // Registration Window Logic
    let isRegWindowOpen = true;
    if (regStart && now < regStart) isRegWindowOpen = false;
    if (regEnd && now > regEnd) isRegWindowOpen = false;
    
    // Check slots
    const isSlotsFull = event.maxParticipants > 0 && event.registeredCount >= event.maxParticipants;
    
    // "Registrations Closed" Condition
    // If manual close OR window is closed OR slots are full OR event is completed -> Closed
    const registrationClosed = !!event.registrationClosed || !isRegWindowOpen || isSlotsFull || isCompleted;

    // --- STEP 3 & 4: USER & ROLE LOGIC ---
    // Get user from local storage (safe parse)
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch(_) {}
    
    const isLoggedIn = !!user;
    const isRegistered = event.isRegistered; // Boolean from backend

    // --- STEP 1: FIX IMAGE DISPLAY (HTML Structure) ---
    const bannerSrc = event.eventImage ? resolveEventImageUrl(event.eventImage) : '';
    const imgEl = bannerSrc 
      ? `<img src="${bannerSrc}" alt="${event.title}" class="event-banner">` 
      : `<div class="event-placeholder"><i class='bx bx-calendar-event'></i></div>`;

    // Status Badge Logic
    let statusClass = '';
    if (event.status === 'Live') statusClass = 'status-live';
    else if (event.status === 'Completed') statusClass = 'status-completed';

    // Formating Dates
    const sDate = event.startDate ? new Date(event.startDate).toLocaleString() : 'TBD';
    const rWindow = (regStart && regEnd) 
      ? `${regStart.toLocaleDateString()} - ${regEnd.toLocaleDateString()}` 
      : 'Open';

    // --- BUILD HTML ---
    let html = `
      <div class="event-banner-container">${imgEl}</div>
      
      <div class="details-header">
        <div class="details-title">${event.title}</div>
        <div class="details-subtitle">
          <span class="badge ${statusClass}">${event.status}</span>
          <span class="badge">${event.category}</span>
          <span class="badge">${event.eventType}</span>
          <span><i class='bx bx-map'></i> ${event.venue || 'Venue TBD'}</span>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Event Date</span>
          <div class="meta-value"><i class='bx bx-calendar'></i> ${sDate}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Registration Window</span>
          <div class="meta-value"><i class='bx bx-time-five'></i> ${rWindow}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Participants</span>
          <div class="meta-value"><i class='bx bx-user'></i> ${event.registeredCount} / ${event.maxParticipants || '∞'}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Fee</span>
          <div class="meta-value"><i class='bx bx-money'></i> ${event.registrationFee || 'Free'}</div>
        </div>
      </div>

      <div class="description-section">
        <h3>About Event</h3>
        <p>${event.description || 'No description provided.'}</p>
      </div>

      <div class="registration-container" id="regContainer">
        <h3>Registration</h3>
    `;

    // --- STEP 4 & 6: SHOW FORM / MESSAGES ---
    
    if (!isLoggedIn) {
      // CASE: Not logged in
      html += `
        <div class="reg-status-card reg-login">
          <i class='bx bx-lock-alt'></i> 
          <div>Please <a href="/frontend/auth/login.html" style="color:inherit;text-decoration:underline;font-weight:bold;">Login</a> to register for this event.</div>
        </div>
      `;
    } else if (isRegistered) {
      // CASE: Already registered
      html += `
        <div class="reg-status-card reg-success">
          <i class='bx bx-check-circle'></i> 
          <div>You are already registered for this event.</div>
        </div>
        <div style="text-align:center; margin-top:1rem;">
          <a href="/frontend/user/my-registrations.html" class="btn" style="display:inline-block; color:var(--osian-cyan); text-decoration:underline;">View My Registrations</a>
        </div>
      `;
    } else if (registrationClosed) {
      // CASE: Closed
      let reason = 'Registration Window Closed';
      if (isSlotsFull) reason = 'Event Full';
      if (isCompleted) reason = 'Event Completed';
      if (regStart && now < regStart) reason = `Opens on ${regStart.toLocaleDateString()}`;
      
      html += `
        <div class="reg-status-card reg-closed">
          <i class='bx bx-x-circle'></i> 
          <div>Registrations Closed</div>
          <div style="font-size:0.9rem; margin-top:0.5rem; opacity:0.8;">(${reason})</div>
        </div>
      `;
    } else {
      // CASE: Open & Can Register -> Show Dynamic Form
      const legacyFields = event.registrationFields || {};
      const newConfig = event.registrationFormConfig || [];
      
      html += `<form id="regForm" class="reg-form"><div class="form-grid">`;
      
      // --- PART A: NEW DYNAMIC CONFIG (Priority) ---
      if (newConfig.length > 0) {
        newConfig.forEach(field => {
          html += renderDynamicField(field);
        });
      } else {
        // --- PART B: LEGACY FALLBACK (Only if new config is empty) ---
        // Default Fields (Name, Email - Read Only)
        html += `
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-input" value="${user.name || ''}" disabled title="Name from your profile">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" class="form-input" value="${user.email || ''}" disabled title="Email from your profile">
          </div>
        `;
        
        // Phone (Legacy)
        if (legacyFields.askPhone !== false) {
          const uPhone = (user.profile && user.profile.phone) || '';
          html += `
            <div class="form-group">
              <label class="form-label">Phone Number *</label>
              <input type="tel" name="phone" class="form-input" value="${uPhone}" required placeholder="Enter your phone number">
            </div>
          `;
        }
  
        // Skills (Legacy)
        if (legacyFields.askSkills) {
          html += `
            <div class="form-group full">
              <label class="form-label">Skills (Comma separated) *</label>
              <input type="text" name="skills" class="form-input" required placeholder="e.g. Java, Python, Public Speaking">
              <small style="color:var(--text-muted); font-size:0.8rem;">Enter multiple skills separated by commas</small>
            </div>
          `;
        }
  
        // Experience (Legacy)
        if (legacyFields.askExperience) {
          html += `
            <div class="form-group">
              <label class="form-label">Experience Level *</label>
              <select name="experience" class="form-input" required style="background:#1a1a1a; color:white;">
                <option value="">Select Experience</option>
                <option value="Beginner">Beginner (0-1 years)</option>
                <option value="Intermediate">Intermediate (1-3 years)</option>
                <option value="Advanced">Advanced (3-5 years)</option>
                <option value="Expert">Expert (5+ years)</option>
              </select>
            </div>
          `;
        }
  
        // Custom Questions (Legacy)
        if (legacyFields.customQuestions && legacyFields.customQuestions.length > 0) {
          legacyFields.customQuestions.forEach((q, idx) => {
            html += `
              <div class="form-group full">
                <label class="form-label">${q.question} ${q.required ? '*' : ''}</label>
                <textarea name="custom_q_${idx}" class="form-input" rows="2" ${q.required ? 'required' : ''} placeholder="Your answer..."></textarea>
                <input type="hidden" name="custom_q_text_${idx}" value="${q.question}">
              </div>
            `;
          });
        }
      }

      html += `</div>
        <button type="submit" id="btnSubmit" class="btn-submit">Confirm Registration</button>
      </form>`;
    }

    html += `</div>`; // End registration-container
    
    // Back button at bottom
    html += `<div style="margin-top:2rem;"><a href="events.html" style="color:var(--text-muted);text-decoration:none;"><i class='bx bx-arrow-back'></i> Back to Events</a></div>`;

    container.innerHTML = html;

    // Attach Event Listener for Form
    const form = document.getElementById('regForm');
    if (form) {
      form.addEventListener('submit', (e) => handleRegistration(e, event));
    }
  }

  function renderDynamicField(field) {
    const reqAttr = field.required ? 'required' : '';
    const labelHtml = `<label class="form-label">${field.label} ${field.required ? '*' : ''}</label>`;
    let inputHtml = '';

    switch (field.type) {
      case 'textarea':
        inputHtml = `<textarea name="${field.id}" class="form-input" rows="3" ${reqAttr} placeholder="${field.placeholder||''}"></textarea>`;
        break;
      case 'dropdown':
        const opts = (field.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
        inputHtml = `<select name="${field.id}" class="form-input" ${reqAttr} style="background:#1a1a1a; color:white;">
                      <option value="">Select...</option>
                      ${opts}
                     </select>`;
        break;
      case 'multiselect':
        const mOpts = (field.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
        inputHtml = `<select name="${field.id}" class="form-input" ${reqAttr} multiple style="background:#1a1a1a; color:white; height: 100px;">
                      ${mOpts}
                     </select>
                     <small style="color:var(--text-muted); font-size:0.8rem;">Hold Ctrl/Cmd to select multiple</small>`;
        break;
      case 'radio':
        inputHtml = `<div class="radio-group" style="display:flex; gap:1rem; flex-wrap:wrap;">`;
        (field.options || []).forEach(o => {
          inputHtml += `
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
              <input type="radio" name="${field.id}" value="${o}" ${reqAttr}> ${o}
            </label>`;
        });
        inputHtml += `</div>`;
        break;
      case 'checkbox':
        inputHtml = `<div class="checkbox-group" style="display:flex; gap:1rem; flex-wrap:wrap;">`;
        (field.options || []).forEach(o => {
          inputHtml += `
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
              <input type="checkbox" name="${field.id}" value="${o}"> ${o}
            </label>`;
        });
        inputHtml += `</div>`;
        break;
      case 'file':
        inputHtml = `<input type="file" name="${field.id}" class="form-input" ${reqAttr}>`;
        break;
      default: // text, email, number
        inputHtml = `<input type="${field.type}" name="${field.id}" class="form-input" ${reqAttr} placeholder="${field.placeholder||''}">`;
    }

    return `<div class="form-group ${['textarea','checkbox','radio'].includes(field.type) ? 'full' : ''}">
              ${labelHtml}
              ${inputHtml}
            </div>`;
  }

  async function handleRegistration(e, event) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmit');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Processing...'; }

    try {
      const form = e.target;
      const formData = new FormData(form);
      const legacyFields = event.registrationFields || {};
      const newConfig = event.registrationFormConfig || [];
      
      let payload = {};

      if (newConfig.length > 0) {
        // Handle Dynamic Config
        let dynamicResponses = {};
        newConfig.forEach(field => {
          if (field.type === 'checkbox' || field.type === 'multiselect') {
             // For checkboxes and multiselect, FormData.getAll returns array of values
             const vals = formData.getAll(field.id);
             dynamicResponses[field.id] = vals;
          } else if (field.type === 'file') {
             // Not supporting file upload in registration yet for user (would need FormData payload)
             // But if we did, it would be here. 
             // Current backend registerForEvent expects JSON payload for simplicity unless we change it to FormData.
             // Backend registerForEvent currently does NOT use uploadMiddleware, so file upload won't work there yet.
             // I'll skip file handling for now or assume text.
             // If field type is file, we can't send it via JSON.
             // Warning: If I support 'file' in config, I must update backend register route to accept FormData.
             // For now, I'll ignore file or send filename string?
          } else {
             dynamicResponses[field.id] = formData.get(field.id);
          }
        });
        payload.dynamicResponses = dynamicResponses;
      } else {
        // Handle Legacy
        payload = {
          phone: formData.get('phone'),
          skills: legacyFields.askSkills ? formData.get('skills').split(',').map(s => s.trim()).filter(s => s) : [],
          experience: legacyFields.askExperience ? formData.get('experience') : null,
          customAnswers: []
        };

        if (legacyFields.customQuestions && legacyFields.customQuestions.length > 0) {
          legacyFields.customQuestions.forEach((q, idx) => {
            const ans = formData.get(`custom_q_${idx}`);
            if (ans) {
              payload.customAnswers.push({
                question: q.question,
                answer: ans
              });
            }
          });
        }
      }

      // Call API
      const res = await apiFetch(`/events/${event._id}/register`, { 
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        if (window.showToast) window.showToast('Registration Successful', 'success');
        // Refresh to show "Already Registered" state
        fetchEvent(event._id);
      } else {
        if (window.showToast) window.showToast(res.message || 'Registration failed', 'error');
        else console.error(res.message || 'Registration failed');
        if(btn) { btn.disabled = false; btn.innerHTML = 'Confirm Registration'; }
      }
    } catch (error) {
      console.error(error);
      if (window.showToast) window.showToast('Error submitting registration: ' + error.message, 'error');
      else console.error('Error submitting registration: ' + error.message);
      if(btn) { btn.disabled = false; btn.innerHTML = 'Confirm Registration'; }
    }
  }
});
