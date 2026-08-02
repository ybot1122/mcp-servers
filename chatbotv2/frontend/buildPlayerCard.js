const summonerCooldowns = {
    'Flash': 300,
    'Teleport': 300,
    'Ignite': 180,
    'Barrier': 180,
    'Heal': 240,
    'Exhaust': 240,
    'Ghost': 240,
    'Cleanse': 240,
    'Smite': 90,
};

const spellButtonCache = new Map();

function createSpellButton(player, spell) {
    if (!spell) return null;

    const spellName = spell.displayName || 'Spell';
    const cooldownSeconds = summonerCooldowns[spellName] ?? 0;
    const cacheKey = `${player.riotId || player.summonerName || 'unknown'}:${spellName}`;
    const cachedButton = spellButtonCache.get(cacheKey);

    if (cachedButton) {
        return cachedButton;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spell-button';
    button.textContent = spellName;
    button.dataset.spellId = spell.id || '';
    button.dataset.riotId = player.riotId || '';
    button.dataset.championName = player.championName || '';

    button.onclick = () => {
        const playerSpells = window.leagueAssist?.summonerSpells?.[button.dataset.riotId];
        const championName = button.dataset.championName || player.championName || 'player';

        if (playerSpells) {
            playerSpells[spellName] = 'cooldown';
        }

        playTextToSpeech(`${championName} used ${spellName}, cooldown set to ${cooldownSeconds} seconds.`, 'af_bella');

        button.disabled = true;

        const maybeDelay = Math.max(cooldownSeconds - 30, 0) * 1000;
        setTimeout(() => {
            if (playerSpells) {
                playerSpells[spellName] = 'maybe';
            }
            button.textContent = `${spellName} (might be ready)`;
            button.disabled = false;
            playTextToSpeech(`${championName} ${spellName} might be ready.`, 'af_bella');
        }, maybeDelay);

        setTimeout(() => {
            if (playerSpells) {
                playerSpells[spellName] = 'ready';
            }
            button.textContent = spellName;
            button.disabled = false;
        }, cooldownSeconds * 1000);
    };

    spellButtonCache.set(cacheKey, button);
    return button;
}

function buildPlayerCard(player) {
    const card = document.createElement('section');
    card.className = 'player-card';

    const nameLine = document.createElement('div');
    nameLine.className = 'player-line';
    nameLine.innerHTML = `<strong>${player.championName}</strong><span>${player.summonerName}</span>`;

    const kdaLine = document.createElement('div');
    kdaLine.className = 'player-line';
    kdaLine.innerHTML = `<span>KDA</span><strong>${player.kills}/${player.deaths}/${player.assists}</strong>`;

    const positionLine = document.createElement('div');
    positionLine.className = 'player-line';
    positionLine.innerHTML = `<span>Role</span><strong>${player.position}</strong>`;

    const spellsLine = document.createElement('div');
    spellsLine.className = 'player-line';

    const label = document.createElement('span');
    label.textContent = 'Summoner Spells';

    const container = document.createElement('div');
    container.style.display = 'inline-flex';
    container.style.gap = '6px';

    const spells = [player.summonerSpells.summonerSpellOne, player.summonerSpells.summonerSpellTwo];
    spells.forEach((spell) => {
        const button = createSpellButton(player, spell);
        if (button) {
            container.appendChild(button);
        }
    });

    if (!spells.some(Boolean)) {
        container.textContent = 'None';
    }

    const strong = document.createElement('strong');
    strong.appendChild(container);

    spellsLine.append(label, strong);

    const itemsMeta = document.createElement('div');
    itemsMeta.className = 'player-meta';
    itemsMeta.innerHTML = `
        <div><span>Items</span><strong>${player.items || 'None'}</strong></div>
    `;

    card.append(nameLine, kdaLine, positionLine, spellsLine, itemsMeta);
    return card;
}
