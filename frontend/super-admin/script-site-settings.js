document.addEventListener('DOMContentLoaded', async () => {
    // Auth check is handled by auth-guard.js, but ensure superadmin role
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'superadmin') {
        window.location.href = '../auth/login.html';
        return;
    }

    const form = document.getElementById('siteSettingsForm');
    
    // Hero Section
    const heroTitleInput = document.getElementById('heroTitle');
    const heroDescInput = document.getElementById('heroDescription');
    const heroImageInput = document.getElementById('heroImage');
    const heroImagePreview = document.getElementById('heroImagePreview');

    // Features Section
    const feature1Title = document.getElementById('feature1Title');
    const feature1Desc = document.getElementById('feature1Desc');
    const feature1Icon = document.getElementById('feature1Icon');
    const feature2Title = document.getElementById('feature2Title');
    const feature2Desc = document.getElementById('feature2Desc');
    const feature2Icon = document.getElementById('feature2Icon');
    const feature3Title = document.getElementById('feature3Title');
    const feature3Desc = document.getElementById('feature3Desc');
    const feature3Icon = document.getElementById('feature3Icon');
    const feature4Title = document.getElementById('feature4Title');
    const feature4Desc = document.getElementById('feature4Desc');
    const feature4Icon = document.getElementById('feature4Icon');

    // Categories Section
    const categoriesTitleInput = document.getElementById('categoriesTitle');
    const categoriesDescInput = document.getElementById('categoriesDescription');

    // About Section
    const aboutTitleInput = document.getElementById('aboutTitle');
    const aboutDescInput = document.getElementById('aboutDescription');

    // Team Section
    const team1Name = document.getElementById('team1Name');
    const team1Role = document.getElementById('team1Role');
    const team1Desc = document.getElementById('team1Desc');
    const team1Image = document.getElementById('team1Image');
    const team1ImagePreview = document.getElementById('team1ImagePreview');

    const team2Name = document.getElementById('team2Name');
    const team2Role = document.getElementById('team2Role');
    const team2Desc = document.getElementById('team2Desc');
    const team2Image = document.getElementById('team2Image');
    const team2ImagePreview = document.getElementById('team2ImagePreview');

    // Contact Section
    const contactEmail = document.getElementById('contactEmail');
    const contactPhone = document.getElementById('contactPhone');
    const contactAddress = document.getElementById('contactAddress');
    const socialInstagram = document.getElementById('socialInstagram');
    const socialLinkedin = document.getElementById('socialLinkedin');

    // Helper to handle image preview
    const setupImagePreview = (input, preview) => {
        input.addEventListener('input', () => {
            if (input.value) {
                preview.src = input.value;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
        });
    };

    setupImagePreview(heroImageInput, heroImagePreview);
    setupImagePreview(team1Image, team1ImagePreview);
    setupImagePreview(team2Image, team2ImagePreview);

    // Fetch current settings
    try {
        const response = await apiFetch('/site-settings');

        if (response && response.success && response.settings) {
            const settings = response.settings;
            // Hero
            heroTitleInput.value = settings.heroTitle || '';
            heroDescInput.value = settings.heroDescription || '';
            heroImageInput.value = settings.heroImage || '';
            if (settings.heroImage) {
                heroImagePreview.src = settings.heroImage;
                heroImagePreview.style.display = 'block';
            }

            // Features (assuming array of 4)
            if (settings.features && settings.features.length > 0) {
                if(settings.features[0]) {
                    feature1Title.value = settings.features[0].title || '';
                    feature1Desc.value = settings.features[0].description || '';
                    feature1Icon.value = settings.features[0].icon || '';
                }
                if(settings.features[1]) {
                    feature2Title.value = settings.features[1].title || '';
                    feature2Desc.value = settings.features[1].description || '';
                    feature2Icon.value = settings.features[1].icon || '';
                }
                if(settings.features[2]) {
                    feature3Title.value = settings.features[2].title || '';
                    feature3Desc.value = settings.features[2].description || '';
                    feature3Icon.value = settings.features[2].icon || '';
                }
                if(settings.features[3]) {
                    feature4Title.value = settings.features[3].title || '';
                    feature4Desc.value = settings.features[3].description || '';
                    feature4Icon.value = settings.features[3].icon || '';
                }
            }

            // Categories
            categoriesTitleInput.value = settings.categoriesTitle || '';
            categoriesDescInput.value = settings.categoriesDescription || '';

            // About
            aboutTitleInput.value = settings.aboutTitle || '';
            aboutDescInput.value = settings.aboutDescription || '';

            // Team (assuming array of 2)
            if (settings.team && settings.team.length > 0) {
                if(settings.team[0]) {
                    team1Name.value = settings.team[0].name || '';
                    team1Role.value = settings.team[0].role || '';
                    team1Desc.value = settings.team[0].description || '';
                    team1Image.value = settings.team[0].image || '';
                    if(settings.team[0].image) {
                        team1ImagePreview.src = settings.team[0].image;
                        team1ImagePreview.style.display = 'block';
                    }
                }
                if(settings.team[1]) {
                    team2Name.value = settings.team[1].name || '';
                    team2Role.value = settings.team[1].role || '';
                    team2Desc.value = settings.team[1].description || '';
                    team2Image.value = settings.team[1].image || '';
                    if(settings.team[1].image) {
                        team2ImagePreview.src = settings.team[1].image;
                        team2ImagePreview.style.display = 'block';
                    }
                }
            }

            // Contact
            contactEmail.value = settings.contactEmail || '';
            contactPhone.value = settings.contactPhone || '';
            contactAddress.value = settings.contactAddress || '';
            socialInstagram.value = settings.socialInstagram || '';
            socialLinkedin.value = settings.socialLinkedin || '';
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updatedSettings = {
            heroTitle: heroTitleInput.value,
            heroDescription: heroDescInput.value,
            heroImage: heroImageInput.value,
            
            features: [
                {
                    title: feature1Title.value,
                    description: feature1Desc.value,
                    icon: feature1Icon.value
                },
                {
                    title: feature2Title.value,
                    description: feature2Desc.value,
                    icon: feature2Icon.value
                },
                {
                    title: feature3Title.value,
                    description: feature3Desc.value,
                    icon: feature3Icon.value
                },
                {
                    title: feature4Title.value,
                    description: feature4Desc.value,
                    icon: feature4Icon.value
                }
            ],

            categoriesTitle: categoriesTitleInput.value,
            categoriesDescription: categoriesDescInput.value,

            aboutTitle: aboutTitleInput.value,
            aboutDescription: aboutDescInput.value,

            team: [
                {
                    name: team1Name.value,
                    role: team1Role.value,
                    description: team1Desc.value,
                    image: team1Image.value
                },
                {
                    name: team2Name.value,
                    role: team2Role.value,
                    description: team2Desc.value,
                    image: team2Image.value
                }
            ],

            contactEmail: contactEmail.value,
            contactPhone: contactPhone.value,
            contactAddress: contactAddress.value,
            socialInstagram: socialInstagram.value,
            socialLinkedin: socialLinkedin.value
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';

        try {
            const data = await apiFetch('/site-settings', {
                method: 'PUT',
                body: JSON.stringify(updatedSettings)
            });

            if (data && data.success) {
                if(window.showToast) window.showToast('Settings updated successfully!', 'success');
                else console.log('Settings updated successfully!');
            } else {
                if(window.showToast) window.showToast(`Failed to update: ${data?.message || 'Unknown error'}`, 'error');
                else console.error(`Failed to update: ${data?.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            if(window.showToast) window.showToast(`An error occurred: ${error.message}`, 'error');
            else console.error(`An error occurred: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
});
