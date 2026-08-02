// TODO: UPDATE ITEM ANNONUCEMENT TOGGLE TO LOOK NONE | ALL | MAJOR

const preferenceButton = document.getElementById('togglePreferencesButton');
const preferencesPanel = document.getElementById('preferencesPanel');
const closePreferencesButton = document.getElementById('closePreferencesButton');
const preferenceToggles = Array.from(document.querySelectorAll('.preference-toggle'));
const itemAnnouncementsSelect = document.querySelector('.preference-select[data-setting="enableItemAnnouncements"]');

// hook up preference panel show/hide
if (preferenceButton && preferencesPanel) {
    preferenceButton.addEventListener('click', () => {
        const isHidden = preferencesPanel.hasAttribute('hidden');

        preferencesPanel.hidden = !isHidden;
        preferenceButton.setAttribute('aria-expanded', String(isHidden));
       if (isHidden) {
            preferencesPanel.classList.remove('hide')
        } else {
            preferencesPanel.classList.add('hide')
        }

    });
}

if (itemAnnouncementsSelect) {
    itemAnnouncementsSelect.value = window.leagueAssistSettings.enableItemAnnouncements || 'all';
    itemAnnouncementsSelect.addEventListener('change', () => {
        window.leagueAssistSettings.enableItemAnnouncements = itemAnnouncementsSelect.value;
    });
}

// update onclick for each toggle
preferenceToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
        const key = toggle.dataset.setting;
        const current = window.leagueAssistSettings[key];

        if (current) {
            toggle.classList.remove('is-on')
        } else {
            toggle.classList.add('is-on')
        }

        window.leagueAssistSettings[key] = !current;
        toggle.textContent = (current) ? 'Off' : 'On'
    });
});
