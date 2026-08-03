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
    'Mark': 80,
};

const summonerIcon = {
    'Flash': 'SummonerFlash.png',
    'Teleport': 'SummonerTeleport.png',
    'Unleashed Teleport': 'SummonerTeleport.png',
    'Ignite': 'SummonerDot.png',
    'Barrier': 'SummonerBarrier.png',
    'Heal': 'SummonerHeal.png',
    'Exhaust': 'SummonerExhaust.png',
    'Ghost': 'SummonerHaste.png',
    'Cleanse': 'SummonerCleanse.png',
    'Smite': 'SummonerSmite.png',
    'Primal Smite': 'SummonerSmite.png',
    'Mark': '981.png',
}

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
    button.className = 'spell-button summoner-spell-button';
    button.dataset.spellId = spell.id || '';
    button.dataset.riotId = player.riotId || '';
    button.dataset.championName = player.championName || '';

    const label = document.createElement('span');
    label.className = 'summoner-spell-label';
    label.textContent = spellName;

    const icon = document.createElement('img');
    icon.className = 'summoner-spell-icon';
    icon.alt = spellName;
    icon.src = `https://ddragon.leagueoflegends.com/cdn/16.15.1/img/spell/${summonerIcon[spellName]}`;
    button.append(label, icon);

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
            const label = button.querySelector('.summoner-spell-label');
            if (label) {
                label.textContent = `${spellName} (might be ready)`;
            }
            button.disabled = false;
            playTextToSpeech(`${championName} ${spellName} might be ready.`, 'af_bella');
        }, maybeDelay);

        setTimeout(() => {
            if (playerSpells) {
                playerSpells[spellName] = 'ready';
            }
            const label = button.querySelector('.summoner-spell-label');
            if (label) {
                label.textContent = spellName;
            }
            button.disabled = false;
        }, cooldownSeconds * 1000);
    };

    spellButtonCache.set(cacheKey, button);
    return button;
}

function buildPlayerCard(player) {
    const card = document.createElement('section');
    card.className = 'player-card';

    const firstRow = document.createElement('div');
    firstRow.className = 'player-line player-line-top';
    firstRow.innerHTML = `
        <div class="player-name-block">
            <strong>${player.championName}</strong>
            <span>${player.summonerName}</span>
        </div>
        <div class="player-stats-block">
            <span>KDA</span>
            <strong>${player.kills}/${player.deaths}/${player.assists}</strong>
        </div>
        <div class="player-role-block">
            <span>Role</span>
            <strong>${player.position}</strong>
        </div>
    `;

    const spellsLine = document.createElement('div');
    spellsLine.className = 'player-line player-line-spells';

    const container = document.createElement('div');
    container.className = 'summoner-spell-container';

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

    spellsLine.appendChild(container);

    /*
    const itemsMeta = document.createElement('div');
    itemsMeta.className = 'player-meta player-meta-row';
    itemsMeta.innerHTML = `
        <div><span>Items</span><strong>${player.items || 'None'}</strong></div>
    `;
    */

    card.append(firstRow, spellsLine);
    return card;
}
