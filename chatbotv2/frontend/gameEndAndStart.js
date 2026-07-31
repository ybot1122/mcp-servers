
const gameInitState = {
    activeSummonerName: null,
    lastHype: 30,
    loadingScreenOverviewDone: false,
    spendGoldReminder: false,
    activePlayer: null
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
        await playTextToSpeech(message);
        document.getElementById("game-summary").textContent = message;
    } catch (error) {
        console.error(error)
    }

    // reset local game state
    window.leagueAssist = {...gameInitState}
    const teamAEl = document.getElementById('teamA');
    const teamBEl = document.getElementById('teamB');
    teamAEl.innerHTML = '';
    teamBEl.innerHTML = '';
}

async function onGameStart(data) {
    console.log('game starting')
    const activePlayer = data.activePlayer ?? {};
    window.leagueAssist.activeSummonerName = activePlayer.riotId
}