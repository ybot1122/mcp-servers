const UPDATER = {
    LOADING_SCREEN_OVERVIEW: 'LOADING_SCREEN_OVERVIEW',
    ITEM_PURCHASES: 'ITEM_PURCHASES',
    PERIODIC_GAME_ADVICE: 'PERIODIC_GAME_ADVICE',
    OBJECTIVE_TIMERS: 'OBJECTIVE_TIMERS',
    COLOR_COMMENTARY: 'COLOR_COMMENTARY',
    MULTI_KILL_HYPE: 'MULTI_KILL_HYPE',
    GAME_START_HYPE: 'GAME_START_HYPE',
    LORE_MASTER: 'LORE_MASTER',
    UPDATE_PLAYER_CARDS: 'UPDATE_PLAYER_CARDS',
}

const VOICES ={
    LOADING_SCREEN_OVERVIEW: 'am_eric',
    ITEM_PURCHASES: 'af_bella',
    PERIODIC_GAME_ADVICE: 'am_eric',
    OBJECTIVE_TIMERS: 'af_bella',
    COLOR_COMMENTARY: 'hype',
    MULTI_KILL_HYPE: 'hype',
    GAME_START_HYPE: 'hype',
    LORE_MASTER: 'bm_george',
    UPDATE_PLAYER_CARDS: 'am_eric',
}

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

    tts_prompts.then((texts) => {
        texts.forEach(([prompt, voice, updater], ind) => {
            if (prompt && prompt.trim().length > 0) {
                playTextToSpeech(prompt, voice, updater)
            }
        });
    });
}

// Announce items that have been purchased
async function itemPurchases(data) {
    const setting = window.leagueAssistSettings.enableItemAnnouncements;
    if (setting === 'none') {
        return ['', VOICES.ITEM_PURCHASES, UPDATER.ITEM_PURCHASES];
    }

    const diff = data.diff;
    let itemsUpdateMessage = '';
    Object.keys(diff).forEach(key => {
        const items = diff[key].filter((i) => (setting === 'major') ? i.total_price > 1200 : true).map((i) => i.name)

        if (items.length > 0) {
            itemsUpdateMessage += `${key} bought ${items.join(', ')}. `;
        }
    });

    if (!itemsUpdateMessage) {
        return ['', VOICES.ITEM_PURCHASES, UPDATER.ITEM_PURCHASES];
    }

    return [itemsUpdateMessage, VOICES.ITEM_PURCHASES, UPDATER.ITEM_PURCHASES];
}

// Every 300 seconds, feed AI game overview and ask for advice
async function periodicGameAdvice(data) {
   if (window.leagueAssistSettings.enableGameAdvice === 'none') {
        return ['', VOICES.PERIODIC_GAME_ADVICE, UPDATER.PERIODIC_GAME_ADVICE];
   }

    const time = data.gameData.gameTime
    const message = data.prompt;
    if (time - window.leagueAssist.lastHype > 300) {
        window.leagueAssist.lastHype = time;
        const prompt = await askGameAdvice(data.prompt);
        return [prompt, VOICES.PERIODIC_GAME_ADVICE, UPDATER.PERIODIC_GAME_ADVICE];
    }

    return ['', VOICES.PERIODIC_GAME_ADVICE, UPDATER.PERIODIC_GAME_ADVICE];
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
                    playTextToSpeech(`${objective.replace('first_', '').replace('_', ' ')} will spawn in 1 minute`, VOICES.OBJECTIVE_TIMERS);
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
            playTextToSpeech(`${event.DragonType} dragon slain! That's ${window.leagueAssist.dragonCount[objKillerTeam]} for ${narrateTeam}`, VOICES.OBJECTIVE_TIMERS);
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`Dragon will respawn in 1 minute`, VOICES.OBJECTIVE_TIMERS);
                }
            }, respawnTime * 1000 - (60 * 1000));
        }
        if (event.EventName === 'BaronKill') {
            const respawnTime = timers['baron_respawn'];
            playTextToSpeech(`Baron slain by ${narrateTeam}`, VOICES.OBJECTIVE_TIMERS);
            setTimeout(() => {
                if (window.leagueAssist.activeSummonerName) {
                    playTextToSpeech(`Baron will respawn in 1 minute`, VOICES.OBJECTIVE_TIMERS);
                }
            }, respawnTime * 1000 - (60 * 1000));
        }
    });

    return ['', VOICES.OBJECTIVE_TIMERS, UPDATER.OBJECTIVE_TIMERS];
}

// generate color commentary for kills, inhib, turrets
async function colorCommentary(data) {

    if (!window.leagueAssistSettings.enableColorCommentary) {
        return ['', VOICES.COLOR_COMMENTARY, UPDATER.COLOR_COMMENTARY];
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
    return [commentary.join(' '), VOICES.COLOR_COMMENTARY, UPDATER.COLOR_COMMENTARY];
}

// If player scores a multi kill, give some hype commentary
async function multiKillHype(data) {

    if (!window.leagueAssistSettings.enableColorCommentary) {
        return ['', VOICES.MULTI_KILL_HYPE, UPDATER.MULTI_KILL_HYPE];
    }

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
    return [results.join(' '), VOICES.MULTI_KILL_HYPE, UPDATER.MULTI_KILL_HYPE];
}

async function gameStartHype(data) {
    const player = data.allPlayers.find((p) => p.summonerName === data.activePlayer.summonerName);
    const playerChampion = player.championName;

    if (window.leagueAssist.gameStartHypeDone) {
        return  ['', VOICES.GAME_START_HYPE, UPDATER.GAME_START_HYPE];
    }

    if (data.gameData.gameTime > 5 && data.gameData.gameTime < 20) {
        window.leagueAssist.gameStartHypeDone = true;

        const text = await llmPrompt('The game has started in League of Legends. Write a hype sentence to encourage the player. Return only the final text, with no options or explanations.', `The player is playing ${playerChampion}.`, new Set([playerChampion]));

        const msg = '[excited]' + text + ' [confident] I believe in you ' + playerChampion + '!';
        return  [msg, VOICES.GAME_START_HYPE, UPDATER.GAME_START_HYPE];
    }

    return  ['', VOICES.GAME_START_HYPE, UPDATER.GAME_START_HYPE];
}

// One-time advice to give during loading screen
async function doLoadingScreenOverview(data) {
    if (data.gameData.gameTime < 1 && !window.leagueAssist.loadingScreenOverviewDone) {
        window.leagueAssist.loadingScreenOverviewDone = true;
        const {championName: myChamp, position: myRole, team: myTeam} = data.allPlayers.find((p) => p.riotId === window.leagueAssist.activeSummonerName);
        if (myRole === "NONE") {
            return  ['Good luck and have fun!', VOICES.LOADING_SCREEN_OVERVIEW, UPDATER.LOADING_SCREEN_OVERVIEW];
        }

        const {championName: myOpp} = data.allPlayers.find((p) => p.position === myRole && p.team !== myTeam)
        const prompt = `I am playing ${myChamp} and my role opponent is ${myOpp}. Give me advice to win this matchup.`
        const advice = await askGameAdvice(prompt)
        return  [advice, VOICES.LOADING_SCREEN_OVERVIEW, UPDATER.LOADING_SCREEN_OVERVIEW];
    }
    return  ['', VOICES.LOADING_SCREEN_OVERVIEW, UPDATER.LOADING_SCREEN_OVERVIEW];
}

// detects if there hasn't been any speech in a while
// then gives some lore about one of the champions in the game
async function loreMaster(data) {
    if (!window.leagueAssistSettings.enableLore) {
        return ['', VOICES.LORE_MASTER, UPDATER.LORE_MASTER];
    }

    if (window.leagueAssist.nextLoreInd.length === 0) {
        return ['', VOICES.LORE_MASTER, UPDATER.LORE_MASTER];
    }

    const now = Date.now();
    const {lastSpeechTime, lastLore} = window.leagueAssist;
    if (now - lastSpeechTime > 30000 && now - lastLore > 90000 && data.gameData.gameTime > 180) {
        window.leagueAssist.lastLore = now;
        const nextInd = window.leagueAssist.nextLoreInd.shift();
        const champion = data.allPlayers[nextInd].championName;
        const content = await fetch(`http://127.0.0.1:5002/deeplore?champions=${encodeURIComponent(champion)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const r = await content.json();
        return [r.response, VOICES.LORE_MASTER, UPDATER.LORE_MASTER];
    }
    return ['', VOICES.LORE_MASTER, UPDATER.LORE_MASTER];
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

    return ['', VOICES.UPDATE_PLAYER_CARDS, UPDATER.UPDATE_PLAYER_CARDS];
}