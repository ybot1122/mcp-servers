async function updateGame(data) {

    console.log(data);

    const tts_prompts = Promise.all([
        doLoadingScreenOverview(data),
        updatePlayerCards(data),
        periodicGameAdvice(data),
        itemPurchases(data),
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
        'bm_george',
        'hype',
        'af_bella',
        'hype',
    ]

    tts_prompts.then((texts) => {
        texts.forEach((prompt, ind) => {
            if (prompt && prompt.trim().length > 0) {
                console.log(`Playing TTS for prompt: ${prompt} with voice: ${voices[ind]}`);
                playTextToSpeech(prompt, voices[ind])
            }
        });
    });
}

// Announce items that have been purchased
async function itemPurchases(data) {

    if (!window.leagueAssistSettings.enableItemAnnouncements) {
        return '';
    }

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
                    playTextToSpeech(`${objective.replace('first_', '').replace('_', ' ')} will spawn in 1 minute`, 'af_bella');
                }
            }, (timerLenInSec * 1000));
        });
    }

    const myTeam = data.allPlayers.find((p) => p.riotId === window.leagueAssist.activeSummonerName).team;

    // Check newEvents to see if any objective was slain, and start a respawn timer
    newEvents.filter((ev) => ev.EventName === 'DragonKill' || ev.EventName === 'BaronKill').forEach((event) => {
        const objKillerTeam = data.allPlayers.find((p) => p.riotIdGameName === event.KillerName || p.championName === event.KillerName).team;
        const narrateTeam = objKillerTeam === myTeam ? 'your team' : 'the enemy team';
        if (event.EventName === 'DragonKill') {
            window.leagueAssist.dragonCount[objKillerTeam] += 1;
            const respawnTime = event.DragonType === 'Elder' || window.leagueAssist.dragonCount[objKillerTeam] === 4 
                ? timers['elder_respawn']
                : timers['dragon_respawn'];
            playTextToSpeech(`${event.DragonType} dragon slain! That's ${window.leagueAssist.dragonCount[objKillerTeam]} for ${narrateTeam}`, 'af_bella');
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`Dragon will respawn in 1 minute`, 'af_bella');
                }
            }, respawnTime * 1000 - (60 * 1000));
        }
        if (event.EventName === 'BaronKill') {
            const respawnTime = timers['baron_respawn'];
            playTextToSpeech(`Baron slain by ${narrateTeam}`, 'af_bella');
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`Baron will respawn in 1 minute`, 'af_bella');
                }
            }, respawnTime * 1000 - (60 * 1000));
        }
    });

    return '';
}

// generate color commentary for kills, inhib, turrets
async function colorCommentary(data) {

    if (!window.leagueAssistSettings.enableColorCommentary) {
        return '';
    }

    const events = data.new_events.filter((ev) => 
        (ev.EventName === "ChampionKill" || ev.EventName === "TurretKill" || ev.EventName === "InhibKilled"));
    const commentary = await Promise.all(events.map(async (event) => {
        const c1 = data.allPlayers.find((p) => p.riotIdGameName === event.KillerName || p.championName === event.KillerName).championName;
        const c2 = data.allPlayers.find((p) => p.riotIdGameName === event.VictimName || p.championName === event.VictimName)?.championName;
        const text = (event.EventName === "ChampionKill") ? `${c1} has slain ${c2}` : `${c1} has destroyed a ${event.EventName === "TurretKill" ? 'turret' : 'inhibitor'}`;
        const champs = new Set([c1, c2].filter(Boolean));
        const content = await llmPrompt(
            "Write a color commentary sentence for the following League of Legends event. Return only the final text, with no options or explanations.",
            text,
            champs
        );
        return content;
    }));

    return commentary.join(' ');
}

// If player scores a multi kill, give some hype commentary
async function multiKillHype(data) {
    const ev = data.new_events.filter((ev) => ev.EventName === "Multikill" | ev.EventName === "Ace").map(async (event) => {
        const myTeam = data.allPlayers.find((p) => p.riotId === window.leagueAssist.activeSummonerName).team;
        if (event.EventName === "Ace") {
            const message = (event.AcingTeam === myTeam) ? "Your team has aced the enemy!" : "The enemy team has aced your team!";
            const content = await llmPrompt(
                `This is a league of legends game. ${message} Write a hype comment. Return only the final text, with no options or explanations. No emojis.`,
                ''
            );
            return (event.AcingTeam === myTeam ? '[excited][shouting]' : '[depressed]') + content + (event.AcingTeam === myTeam ? ' WHOOOOOO' : '[sobbing]');
        }
        
        if (event.EventName === "Multikill") {
            const playerChampion = data.allPlayers.find((p) => p.riotIdGameName === event.KillerName).championName;
            const streak = event.KillStreak;
            const text = `${playerChampion} scored a ${streak} kill streak!`;
            const content = await llmPrompt(
                "The player scored a multi-kill in League of Legends. Write a hype comment. Return only the final text, with no options or explanations. No emojis.",
                text,
                new Set([playerChampion])
            );

            return content + `${streak >= 3 ? ' WHOOOOOO' : ''}`;
        }
        
        return '';
    });

    const results = await Promise.all(ev);
    return results.join(' ');
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

    if (!window.leagueAssistSettings.enableLore) {
        return;
    }

    if (window.leagueAssist.nextLoreInd.length === 0) {
        return;
    }

    if (Date.now() - window.leagueAssist.lastSpeechTime > 30000 && Date.now() - window.leagueAssist.lastLore > 180000 && data.gameData.gameTime > 180) {
        window.leagueAssist.lastLore = Date.now();
        const nextInd = window.leagueAssist.nextLoreInd.shift();
        const champion = data.allPlayers[nextInd].championName;
        const content = await fetch(`http://127.0.0.1:5002/deeplore?champions=${encodeURIComponent(champion)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const r = await content.json();
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

    const players = data.allPlayers.map(player => ({
        championName: player.championName,
        summonerName: player.riotId || player.summonerName,
        kills: player.scores?.kills ?? 0,
        deaths: player.scores?.deaths ?? 0,
        assists: player.scores?.assists ?? 0,
        position: player.position || 'Unknown',
        team: player.team,
        items: (player.items ?? []).map(i => i.displayName).filter(Boolean).join(', '),
        isSelf: player.riotId === activePlayer.riotId || player.summonerName === window.leagueAssist.activeSummonerName,
        summonerSpells: player.summonerSpells,
        riotId: player.riotId,
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