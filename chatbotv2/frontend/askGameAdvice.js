async function askGameAdvice(prompt) {
    const response = await fetch(`http://127.0.0.1:5002/league-game?text=${encodeURIComponent(prompt)}`)
    const data = await response.json();
    return data.response;
}