document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('id');
  const titleEl = document.getElementById('event-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const loading = document.getElementById('loading-state');
  const errorBox = document.getElementById('error-state');
  const errorText = document.getElementById('error-text');
  const table = document.getElementById('reg-table');
  const tbody = document.getElementById('reg-body');
  if (!eventId) {
    if (errorBox) {
      errorText.textContent = 'Missing event id';
      errorBox.style.display = 'block';
    }
    if (loading) loading.style.display = 'none';
    return;
  }
  try {
    const evRes = await window.apiFetch('/events/' + encodeURIComponent(eventId));
    if (evRes && evRes.success && evRes.event) {
      titleEl.textContent = evRes.event.title || 'Event';
      pageSubtitle.textContent = evRes.event.category || '';
    }
  } catch (_) {}
  try {
    const res = await window.apiFetch('/events/' + encodeURIComponent(eventId) + '/registrations');
    const regs = res && res.success && Array.isArray(res.registrations) ? res.registrations : [];
    if (regs.length === 0) {
      if (errorBox) {
        errorText.textContent = 'No registrations found';
        errorBox.style.display = 'block';
      }
      if (loading) loading.style.display = 'none';
      return;
    }
    tbody.innerHTML = regs.map(r => {
      const u = r.user || {};
      const d = r.registrationData || {};
      const when = r.registeredAt ? new Date(r.registeredAt).toLocaleString() : '';
      const name = u.name || d.fullName || '-';
      const email = u.email || d.email || '-';
      const phone = (d.phone || (u.profile && u.profile.phone) || '-') + '';
      const skills = Array.isArray(d.skills) ? d.skills.join(', ') : (d.skills || '');
      const exp = d.experience || '';
      const dyn = Array.isArray(d.dynamicResponses) ? d.dynamicResponses : [];
      const custom = Array.isArray(d.customAnswers) ? d.customAnswers : [];
      const detailsRows = [];
      if (d.fullName) detailsRows.push('<div><strong>Name:</strong> ' + d.fullName + '</div>');
      if (d.email) detailsRows.push('<div><strong>Email:</strong> ' + d.email + '</div>');
      if (d.phone) detailsRows.push('<div><strong>Phone:</strong> ' + d.phone + '</div>');
      if (skills) detailsRows.push('<div><strong>Skills:</strong> ' + skills + '</div>');
      if (exp) detailsRows.push('<div><strong>Experience:</strong> ' + exp + '</div>');
      if (dyn.length) {
        detailsRows.push('<div><strong>Submitted Fields:</strong></div>');
        detailsRows.push('<div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:6px;">' +
          dyn.map(dr => {
            const label = dr.label || dr.fieldId || '';
            const val = Array.isArray(dr.value) ? dr.value.join(', ') : (dr.value ?? '');
            return '<div style="background:rgba(95,251,241,0.08); border:1px solid rgba(95,251,241,0.2); border-radius:6px; padding:6px 8px;">'
              + '<div style="font-size:12px; color:#9fb6cc;">' + label + '</div>'
              + '<div style="font-weight:600;">' + val + '</div>'
              + '</div>';
          }).join('') + '</div>');
      }
      if (custom.length) {
        detailsRows.push('<div style="margin-top:8px;"><strong>Custom Answers:</strong></div>');
        detailsRows.push('<div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">' +
          custom.map(ca => {
            return '<div style="background:rgba(159,182,204,0.08); border:1px solid rgba(159,182,204,0.2); border-radius:6px; padding:6px 8px;">'
              + '<div style="font-size:12px; color:#9fb6cc;">' + (ca.question || '') + '</div>'
              + '<div style="font-weight:600;">' + (ca.answer || '') + '</div>'
              + '</div>';
          }).join('') + '</div>');
      }
      const detailsHtml = detailsRows.length ? detailsRows.join('') : '<span style="color:#9fb6cc;">No additional details</span>';
      return (
        '<tr>' +
          '<td>' + name + '</td>' +
          '<td>' + email + '</td>' +
          '<td>' + phone + '</td>' +
          '<td>' + when + '</td>' +
          '<td style="max-width:640px;">' + detailsHtml + '</td>' +
        '</tr>'
      );
    }).join('');
    if (table) table.style.display = 'table';
  } catch (e) {
    if (errorBox) {
      errorText.textContent = e.message || 'Failed to load registrations';
      errorBox.style.display = 'block';
    }
  } finally {
    if (loading) loading.style.display = 'none';
  }
});
