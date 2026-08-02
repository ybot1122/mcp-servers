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

    if (spellOne) {
        const btn1 = document.createElement('button');
        btn1.type = 'button';
        btn1.className = 'spell-button';
        btn1.textContent = spellOne.displayName || 'Spell 1';
        if (spellOne.id) btn1.dataset.spellId = spellOne.id;
        container.appendChild(btn1);
    }

    if (spellTwo) {
        const btn2 = document.createElement('button');
        btn2.type = 'button';
        btn2.className = 'spell-button';
        btn2.textContent = spellTwo.displayName || 'Spell 2';
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
