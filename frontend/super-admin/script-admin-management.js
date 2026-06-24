document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('admin-list-body');
  const searchInput = document.getElementById('admin-search');
  let admins = [];

  function cell(content) {
    return `<td>${content}</td>`;
  }

  function badge(active) {
    const cls = active ? 'status-published' : 'status-draft';
    const txt = active ? 'Active' : 'Inactive';
    return `<span class="status-badge ${cls}">${txt}</span>`;
  }

  function getDept(u) {
    const p = u.profile || {};
    return u.department || p.department || '';
  }

  function render(list) {
    if (!tbody) return;
    if (!Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem; text-align:center; color: var(--text-muted);">No admins found.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(u => {
      const actions = `<div class="action-buttons"></div>`;
      return `<tr>${cell(u.name || '—')}${cell(u.email || '—')}${cell(getDept(u) || '—')}${cell(badge(u.isActive !== false))}${cell(actions)}</tr>`;
    }).join('');
  }

  async function loadAdminManagement() {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem; text-align:center; color: var(--text-muted);">Loading admins...</td></tr>`;
    }
    try {
      const data = await window.apiFetch('/users/admins');
      admins = Array.isArray(data) ? data : (data && Array.isArray(data.admins) ? data.admins : []);
      render(admins);
    } catch (e) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem; text-align:center; color:#ff6b6b;">Failed to load admins.</td></tr>`;
      }
    }
  }

  if (searchInput) {
    let t;
    searchInput.addEventListener('input', e => {
      clearTimeout(t);
      const q = String(e.target.value || '').toLowerCase();
      t = setTimeout(() => {
        const filtered = admins.filter(u => {
          const name = String(u.name || '').toLowerCase();
          const email = String(u.email || '').toLowerCase();
          const dept = String(getDept(u) || '').toLowerCase();
          return name.includes(q) || email.includes(q) || dept.includes(q);
        });
        render(filtered);
      }, 200);
    });
  }

  window.loadAdminManagement = loadAdminManagement;
});
