document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('eventsBody');
  const modal = document.getElementById('eventModal');
  const btnNew = document.getElementById('btnNew');
  const eventForm = document.getElementById('eventForm');
  const btnCancel = document.getElementById('btnCancel');
  const modalTitle = document.getElementById('modalTitle');
  let editingId = null;

  // Form Fields
  const fTitle = document.getElementById('fTitle');
  const fCategory = document.getElementById('fCategory');
  const fType = document.getElementById('fType');
  const fVenue = document.getElementById('fVenue');
  const fStart = document.getElementById('fStart');
  const fEnd = document.getElementById('fEnd');
  const fRegStart = document.getElementById('fRegStart');
  const fRegEnd = document.getElementById('fRegEnd');
  const fMax = document.getElementById('fMax');
  const fFee = document.getElementById('fFee');
  const fImage = document.getElementById('fImage');
  const fDesc = document.getElementById('fDesc');
  const fRegClosed = document.getElementById('fRegClosed');

  // New Fields
  const fAskSkills = document.getElementById('fAskSkills');
  const fAskExp = document.getElementById('fAskExp');
  const customQuestionsContainer = document.getElementById('customQuestionsContainer');
  const btnAddQuestion = document.getElementById('btnAddQuestion');
  
  // Advanced Form Builder
  const formBuilderContainer = document.getElementById('formBuilderContainer');
  const btnAddField = document.getElementById('btnAddField');
  let formConfig = [];

  const imgPreview = document.getElementById('imgPreview');

  fetchAll();

  // --- Image Preview Logic ---
  if(fImage) {
    fImage.addEventListener('change', () => {
      const file = fImage.files[0];
      if(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imgPreview.src = e.target.result;
          imgPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        imgPreview.style.display = 'none';
      }
    });
  }

  // --- Form Builder Logic ---
  if (btnAddField) {
    btnAddField.addEventListener('click', () => {
      formConfig.push({
        id: 'field_' + Date.now(),
        type: 'text',
        label: '',
        required: false,
        options: []
      });
      renderFormBuilder();
    });
  }

  function renderFormBuilder() {
    formBuilderContainer.innerHTML = '';
    formConfig.forEach((field, index) => {
      const div = document.createElement('div');
      div.className = 'form-builder-item';
      div.style.border = '1px solid var(--border)';
      div.style.padding = '1rem';
      div.style.borderRadius = '8px';
      div.style.background = 'rgba(255,255,255,0.02)';

      // Type Selector
      const typeSelect = `
        <select class="field-type" onchange="updateFieldType(${index}, this.value)" style="padding:0.3rem; margin-bottom:0.5rem; width: 100%; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border);">
          <option value="text" ${field.type === 'text' ? 'selected' : ''}>Short Text</option>
          <option value="textarea" ${field.type === 'textarea' ? 'selected' : ''}>Long Text</option>
          <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
          <option value="number" ${field.type === 'number' ? 'selected' : ''}>Number</option>
          <option value="dropdown" ${field.type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
          <option value="multiselect" ${field.type === 'multiselect' ? 'selected' : ''}>Multi-select</option>
          <option value="checkbox" ${field.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
          <option value="radio" ${field.type === 'radio' ? 'selected' : ''}>Radio Buttons</option>
        </select>
      `;

      // Label Input
      const labelInput = `
        <input type="text" value="${field.label}" placeholder="Question / Label" oninput="updateFieldLabel(${index}, this.value)" style="width:100%; padding:0.5rem; margin-bottom:0.5rem; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border);">
      `;

      // Options Input (for Dropdown/Radio/Checkbox)
      let optionsInput = '';
      if (['dropdown', 'radio', 'checkbox'].includes(field.type)) {
        optionsInput = `
          <textarea placeholder="Options (comma separated)" oninput="updateFieldOptions(${index}, this.value)" style="width:100%; padding:0.5rem; margin-bottom:0.5rem; height: 60px; background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border);">${field.options ? field.options.join(', ') : ''}</textarea>
        `;
      }

      // Controls (Required + Delete)
      const controls = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem;">
            <input type="checkbox" ${field.required ? 'checked' : ''} onchange="updateFieldRequired(${index}, this.checked)"> Required
          </label>
          <button type="button" class="btn btn-danger" onclick="removeField(${index})" style="padding:0.3rem 0.6rem; font-size:0.8rem;">
            <i class='bx bx-trash'></i> Delete
          </button>
        </div>
      `;

      div.innerHTML = typeSelect + labelInput + optionsInput + controls;
      formBuilderContainer.appendChild(div);
    });
  }

  // Expose helpers to window
  window.updateFieldType = (index, val) => { formConfig[index].type = val; renderFormBuilder(); };
  window.updateFieldLabel = (index, val) => { formConfig[index].label = val; };
  window.updateFieldOptions = (index, val) => { formConfig[index].options = val.split(',').map(s => s.trim()).filter(s => s); };
  window.updateFieldRequired = (index, val) => { formConfig[index].required = val; };
  window.removeField = (index) => { formConfig.splice(index, 1); renderFormBuilder(); };


  // --- Custom Questions Logic (Legacy) ---
  if(btnAddQuestion) {
    btnAddQuestion.addEventListener('click', () => addQuestionInput());
  }

  function addQuestionInput(val = '', required = false) {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '0.5rem';
    div.style.marginBottom = '0.5rem';
    
    div.innerHTML = `
      <input type="text" class="q-text" placeholder="Enter Question" value="${val}" required style="flex:1;">
      <label style="display:flex;align-items:center;gap:0.2rem;font-size:0.8rem;white-space:nowrap;">
        <input type="checkbox" class="q-req" ${required ? 'checked' : ''}> Required
      </label>
      <button type="button" class="btn btn-danger" style="padding:0.5rem;" onclick="this.parentElement.remove()">
        <i class='bx bx-trash'></i>
      </button>
    `;
    customQuestionsContainer.appendChild(div);
  }

  function openModal(edit, ev) {
    editingId = edit ? ev._id : null;
    modalTitle.textContent = edit ? 'Edit Event' : 'Create Event';
    modal.classList.add('open');
    
    // Standard Fields
    fTitle.value = edit ? (ev.title || '') : '';
    fCategory.value = edit ? (ev.category || 'Tech') : 'Tech';
    fType.value = edit ? (ev.eventType || 'Online') : 'Online';
    fVenue.value = edit ? (ev.venue || '') : '';
    fStart.value = edit && ev.startDate ? toLocal(ev.startDate) : '';
    fEnd.value = edit && ev.endDate ? toLocal(ev.endDate) : '';
    fRegStart.value = edit && ev.registrationStart ? toLocal(ev.registrationStart) : '';
    fRegEnd.value = edit && ev.registrationEnd ? toLocal(ev.registrationEnd) : '';
    fMax.value = edit ? (ev.maxParticipants || 0) : 0;
    fFee.value = edit ? (ev.registrationFee || 'Free') : 'Free';
    // Image handling for edit: Show preview if exists
    fImage.value = ''; // Reset file input
    if(edit && ev.eventImage) {
      imgPreview.src = ev.eventImage;
      imgPreview.style.display = 'block';
    } else {
      imgPreview.style.display = 'none';
    }

    fDesc.value = edit ? (ev.description || '') : '';
    if(fRegClosed) fRegClosed.checked = edit ? (!!ev.registrationClosed) : false;


    // Registration Fields (Legacy)
    fAskSkills.checked = edit && ev.registrationFields ? !!ev.registrationFields.askSkills : false;
    fAskExp.checked = edit && ev.registrationFields ? !!ev.registrationFields.askExperience : false;
    
    customQuestionsContainer.innerHTML = '';
    if(edit && ev.registrationFields && ev.registrationFields.customQuestions) {
      ev.registrationFields.customQuestions.forEach(q => addQuestionInput(q.question, q.required));
    }

    // New Form Builder
    formConfig = edit && ev.registrationFormConfig ? JSON.parse(JSON.stringify(ev.registrationFormConfig)) : [];
    renderFormBuilder();
  }

  function closeModal(){ modal.classList.remove('open'); }
  
  function toLocal(dateStr){
    if(!dateStr) return '';
    const d = new Date(dateStr);
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function fetchAll(){
    try {
      const res = await apiFetch('/superadmin/events/all');
      const events = res.success ? res.events : [];
      render(events);
    } catch (e) {
      if (body) body.innerHTML = '<tr><td colspan="9">Failed to load.</td></tr>';
    }
  }

  function render(events){
    body.innerHTML = '';
    if (!events || events.length === 0){
      body.innerHTML = '<tr><td colspan="9">No events found.</td></tr>';
      return;
    }
    events.forEach(ev => {
      const tr = document.createElement('tr');
      const s = new Date(ev.startDate);
      const e = new Date(ev.endDate);
      const rs = new Date(ev.registrationStart);
      const re = new Date(ev.registrationEnd);
      const slotText = `${ev.registeredCount||0}/${ev.maxParticipants||'∞'}`;
      
      // Determine status badge class
      let badgeClass = 'status-draft';
      if(ev.status === 'Live') badgeClass = 'status-active';
      else if(ev.status === 'Upcoming') badgeClass = 'status-upcoming';
      else if(ev.status === 'Completed') badgeClass = 'status-ended';

      tr.innerHTML = `
        <td><div style="font-weight:600;">${ev.title||''}</div></td>
        <td><span class="category-badge">${ev.category||''}</span></td>
        <td><span class="type-badge type-${(ev.eventType||'online').toLowerCase()}">${ev.eventType||''}</span></td>
        <td><span class="status-badge ${badgeClass}">${ev.status||''}</span></td>
        <td>${s.toLocaleDateString()}</td>
        <td>${e.toLocaleDateString()}</td>
        <td>${rs.toLocaleDateString()} - ${re.toLocaleDateString()}</td>
        <td>${slotText}</td>
        <td class="actions">
          <button class="btn-action edit btn-edit" data-id="${ev._id}" title="Edit"><i class='bx bx-edit'></i></button>
          <button class="btn-action delete btn-delete" data-id="${ev._id}" title="Delete"><i class='bx bx-trash'></i></button>
          <button class="btn-action btn-toggle" data-id="${ev._id}" title="Toggle Registration"><i class='bx bx-power-off'></i></button>
          <a href="../super-admin/event-registrations.html?id=${ev._id}" class="btn-action" title="View Registrations" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;"><i class='bx bx-list-ul'></i></a>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  async function save(e){
    if(e) e.preventDefault();

    // Gather Custom Questions
    const customQs = [];
    const qDivs = customQuestionsContainer.querySelectorAll('div');
    qDivs.forEach(div => {
      const txt = div.querySelector('.q-text').value.trim();
      const req = div.querySelector('.q-req').checked;
      if(txt) customQs.push({ question: txt, required: req });
    });

    const formData = new FormData();
    
    // Basic Fields
    formData.append('title', fTitle.value.trim());
    formData.append('category', fCategory.value);
    formData.append('eventType', fType.value);
    formData.append('venue', fVenue.value.trim());
    formData.append('startDate', fStart.value ? new Date(fStart.value).toISOString() : '');
    formData.append('endDate', fEnd.value ? new Date(fEnd.value).toISOString() : '');
    formData.append('registrationStart', fRegStart.value ? new Date(fRegStart.value).toISOString() : '');
    formData.append('registrationEnd', fRegEnd.value ? new Date(fRegEnd.value).toISOString() : '');
    formData.append('maxParticipants', fMax.value || 0);
    formData.append('registrationFee', fFee.value);
    formData.append('description', fDesc.value.trim());
    formData.append('registrationClosed', fRegClosed ? fRegClosed.checked : false);

    // Image Upload
    if (fImage.files[0]) {
      formData.append('eventImage', fImage.files[0]);
    }

    // Legacy Registration Fields
    const regFields = {
      askName: true,
      askEmail: true,
      askPhone: true,
      askSkills: fAskSkills.checked,
      askExperience: fAskExp.checked,
      customQuestions: customQs
    };
    formData.append('registrationFields', JSON.stringify(regFields));

    // New Dynamic Config
    formData.append('registrationFormConfig', JSON.stringify(formConfig));

    if (!fTitle.value.trim() || !fStart.value || !fEnd.value) {
      if(window.showToast) window.showToast('Please fill all required fields (Title, Start Date, End Date).', 'error');
      return;
    }

    try {
      if (editingId){
        await apiFetch(`/superadmin/events/update/${editingId}`, { method: 'PUT', body: formData });
      } else {
        await apiFetch('/superadmin/events/create', { method: 'POST', body: formData });
      }
      closeModal();
      fetchAll();
      if(window.showToast) window.showToast('Event saved successfully', 'success');
    } catch (error) {
      console.error(error);
      if(window.showToast) window.showToast('Failed to save event: ' + error.message, 'error');
    }
  }

  async function del(id){
    if(!confirm('Are you sure you want to delete this event?')) return;
    try { 
      await apiFetch(`/superadmin/events/delete/${id}`, { method: 'DELETE' }); 
      fetchAll(); 
      if(window.showToast) window.showToast('Event deleted successfully', 'success');
    } catch(e){ 
      if(window.showToast) window.showToast('Failed to delete: ' + e.message, 'error');
    }
  }

  async function toggle(id){
    try {
      const res = await apiFetch(`/events/${id}`);
      if (!res.success) return;
      const ev = res.event;
      
      const currentState = !!ev.registrationClosed;
      const newState = !currentState;
      
      // Use FormData to ensure compatibility with multer middleware on the update route
      const formData = new FormData();
      formData.append('registrationClosed', newState);

      await apiFetch(`/superadmin/events/update/${id}`, { 
        method: 'PUT', 
        body: formData
      });
      
      if(window.showToast) window.showToast(`Registration ${newState ? 'Closed' : 'Opened'}`, 'success');
      
      fetchAll();
    } catch (e) { 
      if(window.showToast) window.showToast('Failed to toggle: ' + e.message, 'error');
    }
  }

  if (btnNew) btnNew.addEventListener('click', ()=>openModal(false, null));
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (eventForm) eventForm.addEventListener('submit', save);

  body.addEventListener('click', (e) => {
    // Traverse up to find button in case icon is clicked
    const t = e.target.closest('button');
    if (!t) return;

    if (t.classList.contains('btn-edit')) {
      const id = t.getAttribute('data-id');
      apiFetch(`/events/${id}`).then(res => { if(res.success) openModal(true, res.event); });
    } else if (t.classList.contains('btn-delete')) {
      const id = t.getAttribute('data-id');
      del(id);
    } else if (t.classList.contains('btn-toggle')) {
      const id = t.getAttribute('data-id');
      toggle(id);
    }
  });
});
