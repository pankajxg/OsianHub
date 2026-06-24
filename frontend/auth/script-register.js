document.addEventListener("DOMContentLoaded", function() {

    const registerForm = document.getElementById("register-form");
    const registerBtn = document.getElementById("register-btn");
    const passwordInput = document.getElementById("password");
    const deptSelect = document.getElementById("department");
    const customFieldsContainer = document.getElementById("custom-fields-container");
    
    let departmentsMap = {}; // Store dept info for custom fields

    // --- Load Departments --- (Removed)
    /*
    async function loadDepartments() {
       ...
    }
    loadDepartments();
    */

    // --- Handle Department Change ---
    if (deptSelect) {
        deptSelect.addEventListener('change', function() {
            const deptName = this.value;
            const dept = departmentsMap[deptName];
            renderCustomFields(dept);
        });
    }

    function renderCustomFields(dept) {
        customFieldsContainer.innerHTML = '';
        if (!dept || !dept.customFields || dept.customFields.length === 0) return;

        dept.customFields.forEach(field => {
            const group = document.createElement('div');
            group.className = 'input-group';
            
            const label = document.createElement('label');
            label.textContent = field.label + (field.required ? ' *' : '');
            label.htmlFor = `field_${field.key}`;
            group.appendChild(label);

            const wrap = document.createElement('div');
            wrap.className = 'input-wrap';
            
            // Icon based on type? Default to 'bx-edit'
            const icon = document.createElement('i');
            icon.className = 'bx bx-edit-alt input-icon';
            wrap.appendChild(icon);

            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.id = `field_${field.key}`;
                input.name = `custom_${field.key}`;
                if (field.required) input.required = true;
                
                // Style match
                input.style.width = '100%';
                input.style.padding = '12px 12px 12px 40px';
                input.style.background = 'transparent';
                input.style.border = 'none';
                input.style.color = 'inherit';
                input.style.outline = 'none';
                input.style.appearance = 'none';

                const defOpt = document.createElement('option');
                defOpt.value = "";
                defOpt.textContent = `Select ${field.label}`;
                defOpt.disabled = true;
                defOpt.selected = true;
                input.appendChild(defOpt);

                if (field.options && Array.isArray(field.options)) {
                    field.options.forEach(optVal => {
                        const opt = document.createElement('option');
                        opt.value = optVal;
                        opt.textContent = optVal;
                        input.appendChild(opt);
                    });
                }
                
                // Add chevron for select
                const chevron = document.createElement('i');
                chevron.className = 'bx bx-chevron-down';
                chevron.style.position = 'absolute';
                chevron.style.right = '12px';
                chevron.style.top = '50%';
                chevron.style.transform = 'translateY(-50%)';
                chevron.style.pointerEvents = 'none';
                chevron.style.color = '#666';
                wrap.appendChild(chevron);

            } else {
                input = document.createElement('input');
                input.type = field.type === 'date' ? 'date' : (field.type === 'number' ? 'number' : 'text');
                input.id = `field_${field.key}`;
                input.name = `custom_${field.key}`;
                input.placeholder = `Enter ${field.label}`;
                if (field.required) input.required = true;
            }

            // Mark as custom field for collection
            input.dataset.isCustom = 'true';
            input.dataset.key = field.key;
            
            wrap.appendChild(input);
            group.appendChild(wrap);
            customFieldsContainer.appendChild(group);
        });
    }

    // --- Password Strength Validation ---
    const rules = {
        length: { regex: /.{8,}/, element: document.getElementById('rule-length') },
        uppercase: { regex: /[A-Z]/, element: document.getElementById('rule-uppercase') },
        lowercase: { regex: /[a-z]/, element: document.getElementById('rule-lowercase') },
        number: { regex: /[0-9]/, element: document.getElementById('rule-number') },
        special: { regex: /[@$!%*?&]/, element: document.getElementById('rule-special') }
    };

    const strengthContainer = document.getElementById('password-strength-container');

    if (passwordInput && strengthContainer) {
        passwordInput.addEventListener('focus', () => {
            strengthContainer.style.display = 'block';
        });

        passwordInput.addEventListener('input', validatePassword);
    }

    function validatePassword() {
        if (!passwordInput) return false;
        
        const password = passwordInput.value;
        let isValid = true;

        for (const key in rules) {
            const rule = rules[key];
            const isMatch = rule.regex.test(password);
            const icon = rule.element.querySelector('i');
            
            if (isMatch) {
                rule.element.style.color = '#28a745'; // Green
                icon.className = 'bx bx-check-circle';
            } else {
                rule.element.style.color = '#dc3545'; // Red
                icon.className = 'bx bx-x-circle';
                isValid = false;
            }
        }
        
        // Also check if password contains email
        const emailEl = document.getElementById("email");
        const emailVal = emailEl ? emailEl.value : '';
        if (emailVal && password.toLowerCase().includes(emailVal.toLowerCase())) isValid = false;

        registerBtn.disabled = !isValid;
        if (!isValid) {
            registerBtn.style.opacity = '0.6';
            registerBtn.style.cursor = 'not-allowed';
        } else {
            registerBtn.style.opacity = '1';
            registerBtn.style.cursor = 'pointer';
        }
        
        return isValid;
    }

    // --- Handle Registration ---
    if (registerForm) {
        registerForm.addEventListener("submit", async function(event) {
            event.preventDefault();

            if (!validatePassword()) {
                if (typeof showToast === 'function') {
                    showToast("Please meet all password strength requirements.", "error");
                }
                return;
            }

            const fullName = document.getElementById("fullname").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;
            const phone = document.getElementById("phone").value;
            // const department = document.getElementById("department").value; // Removed

            if (password !== confirmPassword) {
                if (typeof showToast === 'function') {
                    showToast("Passwords do not match!", "error");
                }
                return;
            }

            // Collect Custom Fields (Removed)
            /*
            const customFieldsInputs = customFieldsContainer.querySelectorAll('[data-is-custom="true"]');
            const customFieldsData = {};
            customFieldsInputs.forEach(input => {
                customFieldsData[input.dataset.key] = input.value;
            });
            */

            registerBtn.disabled = true;
            registerBtn.textContent = "Registering...";

            try {
                const data = await window.apiFetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: fullName,
                        email: email,
                        password: password,
                        phone: phone, // Pass phone if backend supports it
                        // department: department, // Removed
                        // customFields: customFieldsData // Removed
                    })
                });
                
                if (data && data.success) {
                    // Registration successful
                    localStorage.setItem('pendingVerificationEmail', email);
                    if (typeof showToast === 'function') {
                        showToast('Registration successful! Please verify your email.', 'success');
                    }
                    setTimeout(() => {
                        window.location.href = 'verify-otp.html';
                    }, 1500);
                } else {
                    if (typeof showToast === 'function') {
                        showToast(data.message || 'Registration failed', 'error');
                    }
                    registerBtn.disabled = false;
                    registerBtn.textContent = "Register";
                }
            } catch (error) {
                console.error('Registration Error:', error);
                const errorMessage = error.message || 'An error occurred during registration. Please try again.';
                
                if (typeof showToast === 'function') {
                    showToast(errorMessage, 'error');
                } else {
                    alert(errorMessage);
                }
                
                registerBtn.disabled = false;
                registerBtn.textContent = "Register";
            }
        });
    }
});
