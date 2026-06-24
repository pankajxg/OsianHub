(function() {
    // Prevent multiple initializations
    if (window.ToastHelperInitialized) return;
    window.ToastHelperInitialized = true;

    // Create container if it doesn't exist
    function ensureToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                pointer-events: none;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    // Main Toast Function
    window.showToast = function(message, type = 'info', opts = {}) {
        const container = ensureToastContainer();
        
        // Normalize type
        if (type === 'warning') type = 'error'; // Map warning to error style or add specific warning style
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Styles
        const bg = 'var(--bg-card, #1e293b)';
        const text = 'var(--text-main, #fff)';
        let borderLeft = '4px solid var(--osian-cyan, #00f2fe)';
        
        if (type === 'error') borderLeft = '4px solid #ff4d4d';
        if (type === 'success') borderLeft = '4px solid var(--osian-mint, #4facfe)';
        if (type === 'info') borderLeft = '4px solid var(--osian-cyan, #00f2fe)';

        toast.style.cssText = `
            background: ${bg};
            color: ${text};
            border-left: ${borderLeft};
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 250px;
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            pointer-events: auto;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
        `;
        
        toast.innerHTML = `<span>${message}</span>`;
        
        // Add close button if requested
        if (opts.closeable) {
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.cssText = 'margin-left: 10px; cursor: pointer; font-size: 18px;';
            closeBtn.onclick = () => removeToast(toast);
            toast.appendChild(closeBtn);
        }

        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Auto remove
        const duration = opts.duration || 3000;
        if (duration > 0) {
            setTimeout(() => {
                removeToast(toast);
            }, duration);
        }
    };

    function removeToast(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    // Confirmation Toast
    window.showToastConfirm = function(message, onConfirm, onCancel) {
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        
        toast.style.cssText = `
            background: var(--bg-card, #1e293b);
            color: var(--text-main, #fff);
            border-left: 4px solid #f39c12; /* Orange for warning/confirm */
            padding: 16px;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            min-width: 300px;
            opacity: 0;
            transform: translateX(20px);
            transition: all 0.3s ease;
            pointer-events: auto;
            font-family: 'Segoe UI', sans-serif;
        `;

        toast.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: 500;">${message}</div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="toast-cancel-btn" style="padding: 6px 12px; background: transparent; border: 1px solid rgba(255,255,255,0.3); color: #fff; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="toast-confirm-btn" style="padding: 6px 12px; background: #f39c12; border: none; color: #000; font-weight: bold; border-radius: 4px; cursor: pointer;">Confirm</button>
            </div>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        const confirmBtn = toast.querySelector('#toast-confirm-btn');
        const cancelBtn = toast.querySelector('#toast-cancel-btn');

        confirmBtn.onclick = () => {
            removeToast(toast);
            if (onConfirm) onConfirm();
        };

        cancelBtn.onclick = () => {
            removeToast(toast);
            if (onCancel) onCancel();
        };
    };

    // Logout Helper
    document.addEventListener('DOMContentLoaded', function(){
        const btns = document.querySelectorAll('.logout-btn, .logout-direct');
        btns.forEach(function(btn){
            btn.addEventListener('click', function(e){
                e.preventDefault();
                // Optional: Ask for confirmation
                // if (confirm('Are you sure you want to logout?')) { ... }
                
                try { localStorage.removeItem('token'); } catch(_){ }
                try { localStorage.removeItem('user'); } catch(_){ }
                window.location.href = '/index.html';
            });
        });
    });

    // Alias for backward compatibility
    window.showNotification = window.showToast;

})();
