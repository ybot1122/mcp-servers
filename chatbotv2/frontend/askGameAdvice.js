async function askGameAdvice(prompt, free = true) {

   if (free) {
      // use my local LLM
      try {
         const instructions = 'You are an expert at League of Legends. Here is the state of my current ranked game. Answer in 5 sentences max.'
         const response = await llmPrompt(instructions, prompt)
         return response;
      } catch(e) {
         console.error(e);
      }
   } else {
      // use paid LLM
      try {
         const response = await fetch(`http://127.0.0.1:5002/league-game?text=${encodeURIComponent(prompt)}`)
         const data = await response.json();
         return data.response;
      } catch(e) {
         console.error(e);
      }
   }
     return '';
}