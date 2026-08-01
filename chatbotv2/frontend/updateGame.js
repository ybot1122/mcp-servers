async function updateGame(data) {

    console.log(data);

    const tts_prompts = Promise.all([
        doLoadingScreenOverview(data),
        updatePlayerCards(data),
        periodicGameAdvice(data),
        itemPurchases(data),
        deathAnalysis(data),
        multiKillHype(data),
        loreMaster(data),
        gameStartHype(data)
    ])

    const voices = [
        'am_eric',
        'am_eric',
        'am_eric',
        'af_bella',
        'hype',
        'hype',
        'bm_george',
        'hype'
    ]


    tts_prompts.then((texts) => {
        texts.forEach((prompt, ind) => {
            if (prompt && prompt.trim().length > 0) {
                playTextToSpeech(prompt, voices[ind])
            }
        });
    });
}

// Announce items that have been purchased
async function itemPurchases(data) {
    const diff = data.diff;
    let itemsUpdateMessage = '';
    Object.keys(diff).forEach(key => {
        if (diff[key].length > 0) {
            itemsUpdateMessage += `${key} bought ${diff[key].join(', ')}. `;
        }
    });

    if (!itemsUpdateMessage) {
        return '';
    }

    return itemsUpdateMessage
}

// Every 300 seconds, feed AI game overview and ask for advice
async function periodicGameAdvice(data) {
    const time = data.gameData.gameTime
    const message = data.prompt;
    if (time - window.leagueAssist.lastHype > 300) {
        window.leagueAssist.lastHype = time;
        const prompt = await askGameAdvice(data.prompt);
        return prompt;
    }

    return '';
}

// If player scores a multi kill, give some hype commentary
async function multiKillHype(data) {
    const multikillevent = data.new_events.find((ev) => ev.EventName === "Multikill" && ev.KillerName === data.activePlayer.riotIdGameName);

    if (multikillevent) {
        const playerChampion = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName).championName;
        const streak = multikillevent.KillStreak;
        const text = `${playerChampion} scored a ${streak} kill streak!`;
        const content = await llmPrompt(
            "The player scored a multi-kill in League of Legends. Write a hype comment. Return only the final text, with no options or explanations.",
            text,
            new Set([playerChampion])
        );

        return '[excited]' + content + `(${streak >= 3 ? 'WHOOOOOO' : ''}`;
    }
    
    return '';
}


// Whenever the active player dies, give some commentary based on game state
async function deathAnalysis(data) {
    const deathEvent = data.new_events.find((ev) => ev.EventName === "ChampionKill" && ev.VictimName === data.activePlayer.riotIdGameName);

    if (deathEvent) {
        const player = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName);
        const killer = data.allPlayers.find((p) => p.riotIdGameName === deathEvent.KillerName || p.championName === deathEvent.KillerName);

        // Fallback check in case the killer is a minion, monster, or turret
        if (!killer) {
            return "You were executed by a non-champion source!";
        }

        const playerChampion = player.championName;
        const killerChampion = killer.championName;
        const playerRole = player.position;
        const killerRole = killer.position; 
        const champs = new Set([playerChampion, killerChampion]);

        const {deaths, kills, assists} = player.scores;
        const {deaths: killer_deaths, kills: killer_kills, assists: killer_assists} = killer.scores;

        // Calculate current performance metrics
        const kda = deaths === 0 ? (kills + assists) : (kills + assists) / deaths;
        let baseText = "";
        let roleText = "";

        const text = `${playerChampion} died to ${killerChampion}. Player now has ${deaths} deaths.`

        const content = await llmPrompt(
            "The player died in League of Legends. Write a playful sentence. Return only the final text, with no options or explanations.",
            text,
            champs
        );

        return '[sarcastic]' + content;
    }
    
    return '';
}

// TODO
async function gameStartHype(data) {
    const player = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName);
    const playerChampion = player.championName;

    if (window.leagueAssist.gameStartHypeDone) {
        return '';
    }

    if (data.gameData.gameTime > 5) {
        window.leagueAssist.gameStartHypeDone = true;

        const text = await llmPrompt('The game has started in League of Legends. Write a hype sentence to encourage the player. Return only the final text, with no options or explanations.', `The player is playing ${playerChampion}.`, new Set([playerChampion]));
        
        return '[excited]' + text + ' [confident] I believe in you ' + playerChampion + '!';
    }

    return '';
}

// One-time advice to give during loading screen
async function doLoadingScreenOverview(data) {
    if (data.gameData.gameTime < 1 && !window.leagueAssist.loadingScreenOverviewDone) {
        window.leagueAssist.loadingScreenOverviewDone = true;
        const {championName: myChamp, position: myRole, team: myTeam} = data.allPlayers.find((p) => p.riotId === window.leagueAssist.activeSummonerName);
        if (myRole === "NONE") {
            return 'Good luck and have fun!'
        }

        const {championName: myOpp} = data.allPlayers.find((p) => p.position === myRole && p.team !== myTeam)
        const prompt = `I am playing ${myChamp} and my role opponent is ${myOpp}. Give me advice to win this matchup.`
        const advice = await askGameAdvice(prompt)
        return advice;
    }
    return '';
}

// detects if there hasn't been any speech in a while
// then gives some lore about one of the champions in the game
async function loreMaster(data) {
    if (window.leagueAssist.nextLoreInd >= data.allPlayers.length) {
        return;
    }

    if (Date.now() - window.leagueAssist.lastSpeechTime > 30000 && Date.now() - window.leagueAssist.lastLore > 30000) {
        window,leagueAssist.lastLore = Date.now();
        const content = await fetch(`http://127.0.0.1:5002/deeplore?champions=${encodeURIComponent(data.allPlayers[window.leagueAssist.nextLoreInd].championName)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const r = await content.json();
        window.leagueAssist.nextLoreInd += 1
        return r.response;
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