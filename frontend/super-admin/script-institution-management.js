;(function(){
  const token = localStorage.getItem('token');
  let user = null; try { user = JSON.parse(localStorage.getItem('user')||'{}'); } catch(_){ }
  if (!token || !user || String(user.role||'').toLowerCase() !== 'superadmin') {
    window.location.replace('login.html');
    return;
  }
  const body = document.getElementById('instBody');
  const modal = document.getElementById('instModal');
  const btnNew = document.getElementById('btnNewInstitution');
  const cancel = document.getElementById('instCancel');
  const createBtn = document.getElementById('instCreate');
  const msg = document.getElementById('instMsg');
  function show(){ modal.style.display='block'; }
  function hide(){ modal.style.display='none'; }
  if (btnNew) btnNew.onclick = show;
  if (cancel) cancel.onclick = hide;

  async function load(){
    if (!body) return;
    try {
      const res = await apiFetch('/institutions');
      const items = Array.isArray(res?.institutions) ? res.institutions : [];
      if (!items.length){ body.innerHTML = '<tr><td colspan="7">No institutions</td></tr>'; return; }
      body.innerHTML = '';
      items.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i.name||''}</td><td>${i.code||''}</td><td>${i.domain||''}</td><td>${i.status||''}</td><td>${i.isEnabled?'Yes':'No'}</td><td>${i.statusReason||''}</td>
          <td style="display:flex; gap:8px;">
            <button class="btn-create" data-act="approve" data-id="${i._id}">Approve</button>
            <button class="btn-edit" data-act="reject" data-id="${i._id}">Reject</button>
          </td>`;
        body.appendChild(tr);
      });
    } catch(e){ body.innerHTML = '<tr><td colspan="7">Failed to load</td></tr>'; }
  }

  async function create(){
    msg.textContent='';
    const nameEl = document.getElementById('instName');
    const codeEl = document.getElementById('instCode');
    const domainEl = document.getElementById('instDomain');
    const logoEl = document.getElementById('instLogo');

    if (!nameEl) return;

    const name = nameEl.value.trim();
    const code = codeEl ? codeEl.value.trim() : '';
    const domain = domainEl ? domainEl.value.trim() : '';
    const logo = logoEl ? logoEl.value.trim() : '';

    if (!name){ msg.textContent='Name is required'; return; }
    try {
      const res = await apiFetch('/institutions', { method:'POST', body: JSON.stringify({ name, code, domain, logo }) });
      if (res && res.success){ hide(); await load(); }
      else { msg.textContent = (res && res.message) ? res.message : 'Failed to create'; }
    } catch(e){ msg.textContent = 'Error: '+e.message; }
  }
  if (createBtn) createBtn.onclick = create;

  document.addEventListener('click', async (ev) => {
    const t = ev.target;
    const act = t && t.getAttribute('data-act');
    const id = t && t.getAttribute('data-id');
    if (!act || !id) return;
    const reason = act==='reject' ? (prompt('Enter rejection reason')||'') : '';
    try {
      const path = act==='approve' ? '/institutions/approve' : '/institutions/reject';
      const res = await apiFetch(path, { method:'PUT', body: JSON.stringify({ id, reason }) });
      if (res && res.success){ 
          await load(); 
          if(window.showToast) window.showToast('Action successful', 'success');
      }
      else { 
          const m = (res && res.message) ? res.message : 'Failed';
          if(window.showToast) window.showToast(m, 'error');
          else console.error(m);
      }
    } catch(e){ 
        if(window.showToast) window.showToast('Error: '+e.message, 'error');
        else console.error('Error: '+e.message); 
    }
  });

  load();
})();
