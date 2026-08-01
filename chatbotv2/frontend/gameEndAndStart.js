
const gameInitState = {
    activeSummonerName: null,
    lastHype: 30,
    loadingScreenOverviewDone: false,
    activePlayer: null,
    lastLore: Date.now(),
    nextLoreInd: 0,
    lastSpeechTime: Date.now(),
    gameStartHypeDone: false
}

window.leagueAssist = {...gameInitState}

async function onGameEnded() {
    // fetch the last match of the summoner from API
    try {
        const response = await fetch(`http://127.0.0.1:5000/lookup-summoner?summonerName=${encodeURIComponent(window.leagueAssist.activeSummonerName)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const puuid = data.puuid;
        const lastMatch = data.matchDetails[0];
        const selfParticipant = lastMatch.info.participants.find((p) => p.puuid === puuid);

        // construct message
        const message = `In your last match, you played as ${selfParticipant.championName} with ${selfParticipant.kills} kills, ${selfParticipant.deaths} deaths, and ${selfParticipant.assists} assists. Your team ${selfParticipant.win ? 'won' : 'lost'} the game.`;
        const champions = new Set();
        champions.add(selfParticipant.championName);
        document.getElementById("game-summary").textContent = message;
        const teamAEl = document.getElementById('teamA');
        const teamBEl = document.getElementById('teamB');
        teamAEl.innerHTML = '';
        teamBEl.innerHTML = '';
        const stylized = await llmPrompt("This is a League of Legends game summary. Make this sentence more interesting. Output just the sentence.", message, champions)
        await playTextToSpeech(message);
    } catch (error) {
        console.error(error)
    }

    // reset local game state
    window.leagueAssist = {...gameInitState}
}

async function onGameStart(data) {
    console.log('game starting')
    const activePlayer = data.activePlayer ?? {};
    window.leagueAssist.activeSummonerName = activePlayer.riotId
}