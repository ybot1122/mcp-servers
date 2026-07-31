async function llmPrompt(instructions, originalText, champions) {
    try {
        const prompt = `${instructions}: ${originalText}`;
        const championsParam = (champions) ? `&champions=${[...champions].join(',')}` : ''
        const stylized = await fetch(`http://127.0.0.1:5002/llm?text=${encodeURIComponent(prompt)}${championsParam}`);
        const data = await stylized.json();
        if (data.response) {
            return data.response;
        }
    } catch (e) {
        console.error(e);
    }

    return originalText;
}