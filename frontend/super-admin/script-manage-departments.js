document.addEventListener('DOMContentLoaded', () => {
    fetchDepartments();

    document.getElementById('departmentForm').addEventListener('submit', handleFormSubmit);
});

async function fetchDepartments() {
    const tbody = document.getElementById('departments-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const data = await window.apiFetch('/departments');
        if (data && data.success) {
            renderDepartments(data.departments);
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Failed to load departments.</td></tr>';
        }
    } catch (error) {
        console.error('Error fetching departments:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Error loading departments.</td></tr>';
    }
}

function renderDepartments(departments) {
    const tbody = document.getElementById('departments-body');
    if (!departments || departments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No departments found.</td></tr>';
        return;
    }

    tbody.innerHTML = departments.map(dept => `
        <tr>
            <td>${dept.name}</td>
            <td><span style="background: rgba(134,253,232,0.1); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${dept.code || '—'}</span></td>
            <td>
                ${dept.customFields && dept.customFields.length > 0 
                    ? dept.customFields.map(f => `<span style="display: inline-block; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 4px; margin-bottom: 2px;">${f.label}</span>`).join('') 
                    : '<span style="color: var(--text-muted); font-size: 0.85rem;">None</span>'}
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick='editDepartment(${JSON.stringify(dept).replace(/'/g, "&#39;")})' style="padding: 0.4rem;">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteDepartment('${dept._id}')" style="padding: 0.4rem;">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Modal & Form Handling
let customFields = [];

function openModal() {
    document.getElementById('departmentForm').reset();
    document.getElementById('deptId').value = '';
    document.getElementById('modalTitle').textContent = 'Add Department';
    
    // Reset custom fields
    customFields = [];
    renderCustomFieldsInputs();
    
    document.getElementById('departmentModal').classList.add('active');
}

function closeModal() {
    document.getElementById('departmentModal').classList.remove('active');
}

function editDepartment(dept) {
    document.getElementById('deptId').value = dept._id;
    document.getElementById('deptName').value = dept.name;
    document.getElementById('deptCode').value = dept.code || '';
    document.getElementById('modalTitle').textContent = 'Edit Department';
    
    customFields = dept.customFields ? JSON.parse(JSON.stringify(dept.customFields)) : [];
    renderCustomFieldsInputs();
    
    document.getElementById('departmentModal').classList.add('active');
}

async function deleteDepartment(id) {
    if (!confirm('Are you sure you want to delete this department? Users in this department may be affected.')) return;

    try {
        const res = await window.apiFetch(`/departments/${id}`, {
            method: 'DELETE'
        });
        
        if (res.success) {
            showToast('Department deleted successfully');
            fetchDepartments();
        } else {
            showToast(res.message || 'Failed to delete department', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Error deleting department', 'error');
    }
}

// Custom Fields Logic
function addCustomField() {
    customFields.push({
        label: '',
        key: '',
        type: 'text',
        required: false,
        options: []
    });
    renderCustomFieldsInputs();
}

function removeCustomField(index) {
    customFields.splice(index, 1);
    renderCustomFieldsInputs();
}

function updateCustomField(index, field, value) {
    customFields[index][field] = value;
    
    // Auto-generate key from label if key is empty
    if (field === 'label' && !customFields[index].key) {
        const key = value.toLowerCase().replace(/[^a-z0-9]/g, '');
        customFields[index].key = key;
        // Re-render to show key? Maybe not necessary to be aggressive
    }
}

function renderCustomFieldsInputs() {
    const container = document.getElementById('customFieldsContainer');
    
    if (customFields.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem; font-size: 0.9rem;">No custom fields defined.</p>';
        return;
    }

    container.innerHTML = customFields.map((field, index) => `
        <div class="field-row" style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end;">
            <div style="flex: 2; min-width: 150px;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Label</label>
                <input type="text" value="${field.label}" onchange="updateCustomField(${index}, 'label', this.value)" placeholder="Field Label (e.g. Roll No)" style="width: 100%;">
            </div>
            <div style="flex: 1; min-width: 100px;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Type</label>
                <select onchange="updateCustomField(${index}, 'type', this.value)" style="width: 100%;">
                    <option value="text" ${field.type === 'text' ? 'selected' : ''}>Text</option>
                    <option value="number" ${field.type === 'number' ? 'selected' : ''}>Number</option>
                    <option value="date" ${field.type === 'date' ? 'selected' : ''}>Date</option>
                    <option value="select" ${field.type === 'select' ? 'selected' : ''}>Dropdown</option>
                </select>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <input type="checkbox" id="req-${index}" ${field.required ? 'checked' : ''} onchange="updateCustomField(${index}, 'required', this.checked)">
                <label for="req-${index}" style="font-size: 0.85rem; margin-left: 0.25rem; color: var(--text-main);">Required</label>
            </div>
            <button type="button" class="btn btn-danger" onclick="removeCustomField(${index})" style="padding: 0.25rem 0.5rem;">
                <i class='bx bx-trash'></i>
            </button>
            
            ${field.type === 'select' ? `
                <div style="width: 100%; margin-top: 0.5rem;">
                    <label style="font-size: 0.8rem; color: var(--text-muted);">Options (comma separated)</label>
                    <input type="text" value="${field.options ? field.options.join(', ') : ''}" 
                        onchange="updateCustomField(${index}, 'options', this.value.split(',').map(s => s.trim()).filter(Boolean))" 
                        placeholder="Option 1, Option 2, Option 3" style="width: 100%;">
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('deptId').value;
    const name = document.getElementById('deptName').value;
    const code = document.getElementById('deptCode').value;

    // Validate fields
    const validFields = customFields.filter(f => f.label.trim() !== '');
    // Ensure keys
    validFields.forEach(f => {
        if (!f.key) f.key = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
    });

    const payload = {
        name,
        code,
        customFields: validFields
    };

    try {
        let res;
        if (id) {
            res = await window.apiFetch(`/departments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await window.apiFetch('/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (res.success) {
            showToast(`Department ${id ? 'updated' : 'created'} successfully`);
            closeModal();
            fetchDepartments();
        } else {
            showToast(res.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Submit error:', error);
        showToast('Error submitting form', 'error');
    }
}
