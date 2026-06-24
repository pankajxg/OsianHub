document.addEventListener('DOMContentLoaded', () => {
    updateAdminHeaderProfile();
});

function updateAdminHeaderProfile() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Select all potential avatar elements
    const avatarElements = document.querySelectorAll('.avatar, .avatar-nav, #header-avatar');
    
    // Select all potential name elements
    const nameElements = document.querySelectorAll('.user-name-nav, #nav-name');

    // Update Avatar
    avatarElements.forEach(el => {
        if (user.profile && user.profile.avatar) {
             el.textContent = '';
             el.style.backgroundImage = `url('${user.profile.avatar}')`;
             el.style.backgroundSize = 'cover';
             el.style.backgroundPosition = 'center';
             el.style.borderRadius = '50%'; // Ensure circle
        } else if (user.name) {
            const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
            el.textContent = initials || 'AD';
            el.style.backgroundImage = 'none';
        }
    });

    // Update Name
    nameElements.forEach(el => {
        if (user.name) el.textContent = user.name;
    });
}
