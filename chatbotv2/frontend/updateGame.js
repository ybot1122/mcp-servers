async function updateGame(data) {

    console.log(data);

    let tts_prompt = '';
    const tts_prompts = await Promise.all([
        doLoadingScreenOverview(data),
        updatePlayerCards(data),
        periodicGameAdvice(data),
        itemPurchases(data),
    ])

    const prompt = tts_prompts.join(' ');

    if (prompt.trim().length < 2) return;

    await playTextToSpeech(tts_prompts.join(' '))
}

// Announce items that have been purchased
async function itemPurchases(data) {
    const diff = data.diff;
    let itemsUpdateMessage = '';
    let championsList = new Set();
    Object.keys(diff).forEach(key => {
        if (diff[key].length > 0) {
            itemsUpdateMessage += `${key} has purchased ${diff[key].join(', ')}. `;
            championsList.add(key);
        }
    });

    if (!itemsUpdateMessage) {
        return '';
    }

    const instructions = 'This is for a League of Legends game. Summarize the items purchased. Output a single sentence only.'
    const stylized = await llmPrompt(instructions, itemsUpdateMessage, championsList)

    return stylized
}

// Every 150 seconds, feed AI game overview and ask for advice
async function periodicGameAdvice(data) {
    const time = data.gameData.gameTime
    const message = data.prompt;
    if (time - window.leagueAssist.lastHype > 150) {
        window.leagueAssist.lastHype = time;
        const prompt = await askGameAdvice(data.prompt);
        return prompt;
    }
}

// One-time advice to give during loading screen
async function doLoadingScreenOverview(data) {
    if (data.gameData.gameTime < 1 && !window.leagueAssist.loadingScreenOverviewDone) {
        window.leagueAssist.loadingScreenOverviewDone = true;
        // TODO: modify prompt to focus more on lane matchup
        const advice = await askGameAdvice(data.prompt)
        return advice;
    }

    return '';
}

function updatePlayerCards(data) {
    const gameTime = data.gameData.gameTime
    const stateMetaEl = document.getElementById('stateMeta');
    const activePlayerInfoEl = document.getElementById('activePlayerInfo');
    const teamAEl = document.getElementById('teamA');
    const teamBEl = document.getElementById('teamB');
    const activePlayer = data.activePlayer ?? {};

    stateMetaEl.textContent = gameTime !== null ? `Game Time: ${Math.floor(gameTime)}s` : 'Game connected, waiting for data...';

    const players = (data.allPlayers ?? []).map(player => ({
        championName: player.championName,
        summonerName: player.riotId || player.summonerName,
        kills: player.scores?.kills ?? 0,
        deaths: player.scores?.deaths ?? 0,
        assists: player.scores?.assists ?? 0,
        position: player.position || 'Unknown',
        team: player.team,
        items: (player.items ?? []).map(i => i.displayName).filter(Boolean).join(', '),
        isSelf: player.riotId === activePlayer.riotId || player.summonerName === window.leagueAssist.activeSummonerName,
    }));
    const activeTeam = players.find(p => p.summonerName === window.leagueAssist.activeSummonerName)?.team;
    activePlayerInfoEl.textContent = `${window.leagueAssist.activeSummonerName} ()`;

    teamAEl.innerHTML = '';
    teamBEl.innerHTML = '';

    players.forEach(player => {
        const card = buildPlayerCard(player);
        if (player.isSelf) {
            card.classList.add('self');
        }
        if (player.team === activeTeam) {
            teamAEl.appendChild(card);
        } else {
            teamBEl.appendChild(card);
        }
    });

    return '';
}