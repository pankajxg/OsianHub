document.addEventListener('DOMContentLoaded', () => {
    // Auth check handled by auth-guard
    loadCategories();

    // Form Submit
    const form = document.getElementById('categoryForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
});

let isEditing = false;

async function loadCategories() {
    const container = document.getElementById('categories-container');
    
    try {
        const data = await apiFetch('/categories'); // Uses shared apiFetch
        
        if (!data.categories || data.categories.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No categories found. Create one!</div>';
            return;
        }

        container.innerHTML = data.categories.map(cat => {
            const isImage = cat.icon && (cat.icon.startsWith('data:image') || cat.icon.startsWith('http'));
            const iconHtml = isImage 
                ? `<img src="${cat.icon}" class="category-icon" style="width: 48px; height: 48px; object-fit:cover; border-radius:8px;">`
                : `<i class='bx ${cat.icon || 'bx-folder'} category-icon'></i>`;
            
            return `
            <div class="category-card">
                ${iconHtml}
                <div class="category-name">${cat.name}</div>
                <div class="category-desc">${cat.description || 'No description provided.'}</div>
                <div class="category-actions">
                    <button class="btn-icon" onclick="editCategory('${cat._id}', '${cat.name}', '${cat.description || ''}', '${cat.icon || ''}')" title="Edit">
                        <i class='bx bx-edit-alt'></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteCategory('${cat._id}')" title="Delete">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </div>
        `}).join('');

    } catch (error) {
        console.error('Error loading categories:', error);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ff6b6b;">Failed to load categories.</div>';
    }
}

function openModal() {
    isEditing = false;
    document.getElementById('modalTitle').textContent = 'Add Category';
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryModal').classList.add('active');
}

window.editCategory = function(id, name, desc, icon) {
    isEditing = true;
    document.getElementById('modalTitle').textContent = 'Edit Category';
    document.getElementById('categoryId').value = id;
    document.getElementById('catName').value = name;
    document.getElementById('catDesc').value = desc;
    document.getElementById('catIcon').value = icon;
    document.getElementById('categoryModal').classList.add('active');
};

window.closeModal = function() {
    document.getElementById('categoryModal').classList.remove('active');
};

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Category';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';
    }
    
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('catName').value.trim();
    const description = document.getElementById('catDesc').value;
    const iconClass = document.getElementById('catIcon').value;
    const imageInput = document.getElementById('catImageInput');

    if (!name) {
        if(window.showToast) window.showToast('Category name is required', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
        return;
    }

    let imageBase64 = '';
    if (imageInput && imageInput.files && imageInput.files[0]) {
        try {
            imageBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(imageInput.files[0]);
            });
        } catch (e) {
            console.error("Image read error", e);
        }
    }

    const payload = { 
        name, 
        description, 
        icon: imageBase64 || iconClass 
    };
    
    try {
        let res;
        if (isEditing && id) {
            // Edit Mode
            res = await apiFetch(`/categories/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            // Create Mode
            res = await apiFetch('/categories', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        if (res.success || res._id) { // Some endpoints return object directly
            if(window.showToast) window.showToast(`Category ${isEditing ? 'updated' : 'created'} successfully!`, 'success');
            closeModal();
            loadCategories();
        } else {
             if(window.showToast) window.showToast(res.message || 'Operation failed', 'error');
        }

    } catch (error) {
        console.error('Save error:', error);
        let msg = error.message || 'An error occurred.';
        if (msg.includes('Conflict') || msg.includes('already exists')) {
            msg = 'A category with this name already exists. Please check the list or choose a different name.';
        }
        if(window.showToast) window.showToast(msg, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

window.deleteCategory = async function(id) {
    if (!confirm('Are you sure you want to delete this category? This might affect quizzes linked to it.')) return;

    try {
        const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
        if (res.success) {
            if(window.showToast) window.showToast('Category deleted.', 'success');
            loadCategories();
        } else {
            if(window.showToast) window.showToast(res.message || 'Failed to delete.', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
};
