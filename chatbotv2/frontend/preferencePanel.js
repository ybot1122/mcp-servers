const preferenceButton = document.getElementById('togglePreferencesButton');
const preferencesPanel = document.getElementById('preferencesPanel');
const closePreferencesButton = document.getElementById('closePreferencesButton');
const preferenceToggles = Array.from(document.querySelectorAll('.preference-toggle'));

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

window.enableHighQualityAdvice = settings.enableHighQualityAdvice;
syncPreferencePanel();
