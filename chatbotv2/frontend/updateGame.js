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
        gameStartHype(data),
        objectiveTimers(data),
        colorCommentary(data),
    ])

    const voices = [
        'am_eric',
        'am_eric',
        'am_eric',
        'af_bella',
        'hype',
        'hype',
        'bm_george',
        'hype',
        'af_bella',
        'hype',
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

// TODO add warnings for early gank timers (lvl 2 gank 1:15, lvl 3 gank 1:55, lvl 4 gank 2:55)

// Gives 1 minute warning for map objectives
async function objectiveTimers(data) {

    const timers = {
        first_dragon: 5*60, // 5 minutes
        first_voidgrubs: 8*60, // 8 minutes
        first_baron: 20*60, // 20 minutes
        first_herald: 15*60, // 15 minutes
        baron_respawn: 6*60, // 6 minutes
        dragon_respawn: 5*60, // 5 minutes
        elder_respawn: 360,
    }

    const gameTime = data.gameData.gameTime;
    const newEvents = data.new_events;

    if (!window.leagueAssist.objectiveTimersInitialized) {
        window.leagueAssist.objectiveTimersInitialized = true;
        ['first_dragon', 'first_voidgrubs', 'first_baron', 'first_herald'].forEach((objective) => {
            const timerLenInSec = timers[objective] - 60;
            if (gameTime > timerLenInSec) {
                return;
            }
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`${objective.replace('first_', '').replace('_', ' ')} will spawn in 1 minute`);
                }
            }, (timerLenInSec * 1000));
        });
    }

    // Check newEvents to see if any objective was slain, and start a respawn timer
    newEvents.forEach((event) => {
        if (event.EventName === 'DragonKill') {
            const respawnTime = event.DragonType === 'Elder' ? timers['elder_respawn'] : timers['dragon_respawn'];
            playTextToSpeech(`${event.DragonType} dragon slain! Respawn in ${respawnTime / 60} minutes`);
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`Dragon will respawn in 1 minute`);
                }
            }, respawnTime * 1000 - (60 * 1000));
        }
        if (event.EventName === 'BaronKill') {
            playTextToSpeech(`Baron slain! Respawn in ${respawnTime / 60} minutes`);
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`Baron will respawn in 1 minute`);
                }
            }, timers['baron_respawn'] * 1000 - (60 * 1000));
        }
    });

    return '';
}

// generate color commentary for events not involving active player
async function colorCommentary(data) {
    const events = data.new_events.filter((ev) => 
        (ev.EventName === "ChampionKill" && ev.VictimName !== data.activePlayer.riotIdGameName && ev.KillerName !== data.activePlayer.riotIdGameName
            || ev.EventName === "TurretKill")
        );
    const commentary = await Promise.all(events.map(async (event) => {
        const c1 = data.allPlayers.find((p) => p.summonerName === event.KillerName || p.championName === event.KillerName).championName;
        const c2 = data.allPlayers.find((p) => p.summonerName === event.VictimName || p.championName === event.VictimName)?.championName;
        const text = (event.EventName === "ChampionKill") ? `${c1} has slain ${c2}` : `${c1} has destroyed a turret`;
        const champs = new Set([c1, c2].filter(Boolean));
        const content = await llmPrompt(
            "Write a color commentary sentence for the following League of Legends event. Return only the final text, with no options or explanations.",
            text,
            champs
        );
        return content;
    }));

    console.log(commentary)
    return commentary.join(' ');
}

// If player scores a multi kill, give some hype commentary
async function multiKillHype(data) {
    const multikillevent = data.new_events.find((ev) => ev.EventName === "Multikill" && ev.KillerName === data.activePlayer.riotIdGameName);

    if (multikillevent) {
        const playerChampion = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName).championName;
        const streak = multikillevent.KillStreak;
        const text = `${playerChampion} scored a ${streak} kill streak!`;
        const content = await llmPrompt(
            "The player scored a multi-kill in League of Legends. Write a hype comment. Return only the final text, with no options or explanations. No emojis.",
            text,
            new Set([playerChampion])
        );

        return '[excited]' + content + `${streak >= 3 ? 'WHOOOOOO' : ''}`;
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

async function gameStartHype(data) {
    const player = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName);
    const playerChampion = player.championName;

    if (window.leagueAssist.gameStartHypeDone) {
        return '';
    }

    if (data.gameData.gameTime > 5 && data.gameData.gameTime < 20) {
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

    if (Date.now() - window.leagueAssist.lastSpeechTime > 30000 && Date.now() - window.leagueAssist.lastLore > 180000 && data.gameData.gameTime > 180) {
        window.leagueAssist.lastLore = Date.now();
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