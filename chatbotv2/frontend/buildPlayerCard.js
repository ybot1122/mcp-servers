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
    const spellOne = player.summonerSpells.summonerSpellOne;
    const spellTwo = player.summonerSpells.summonerSpellTwo;

    const label = document.createElement('span');
    label.textContent = 'Summoner Spells';

    const container = document.createElement('div');
    container.style.display = 'inline-flex';
    container.style.gap = '6px';

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
    }

    if (spellOne) {
        const btn1 = document.createElement('button');
        btn1.type = 'button';
        btn1.className = 'spell-button';
        btn1.textContent = spellOne.displayName || 'Spell 1';
        btn1.onclick = () => {
            console.log(`Clicked ${spellOne.displayName} for ${player.riotId}`);
            playTextToSpeech(`${player.championName} used ${spellOne.displayName}, cooldown set to ${summonerCooldowns[spellOne.displayName]} seconds.`, 'af_bella');
            window.leagueAssist.summonerSpells[player.riotId][spellOne.displayName] = 'cooldown';
            btn1.disabled = true;
            setTimeout(() => {
                window.leagueAssist.summonerSpells[player.riotId][spellOne.displayName] = 'maybe';
                btn1.textContent = `${spellOne.displayName} (might be ready)`;
                btn1.disabled = false;
            }, (summonerCooldowns[spellOne.displayName] - 30)* 1000);
            setTimeout(() => {
                window.leagueAssist.summonerSpells[player.riotId][spellOne.displayName] = 'ready';
                btn1.disabled = false;
                btn1.textContent = spellOne.displayName;
            }, summonerCooldowns[spellOne.displayName] * 1000);
        }
        if (spellOne.id) btn1.dataset.spellId = spellOne.id;
        container.appendChild(btn1);
    }

    if (spellTwo) {
        const btn2 = document.createElement('button');
        btn2.type = 'button';
        btn2.className = 'spell-button';
        btn2.textContent = spellTwo.displayName || 'Spell 2';
        btn2.onclick = () => {
            window.leagueAssist.summonerSpells[player.riotId][spellTwo.displayName] = 'cooldown';
            btn2.disabled = true;
            setTimeout(() => {
                window.leagueAssist.summonerSpells[player.riotId][spellTwo.displayName] = 'maybe';
                btn2.textContent = `${spellTwo.displayName} (might be ready)`;
                btn2.disabled = false;
            }, (summonerCooldowns[spellTwo.displayName] - 30)* 1000);
            setTimeout(() => {
                window.leagueAssist.summonerSpells[player.riotId][spellTwo.displayName] = 'ready';
                btn2.disabled = false;
                btn2.textContent = spellTwo.displayName;
            }, summonerCooldowns[spellTwo.displayName] * 1000);
        }
        if (spellTwo.id) btn2.dataset.spellId = spellTwo.id;
        container.appendChild(btn2);
    }

    if (!spellOne && !spellTwo) {
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
