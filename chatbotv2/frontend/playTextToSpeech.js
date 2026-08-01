// Global AudioContext initialization (instantiated on first use)
let globalAudioCtx = null;
// Global queue to ensure sequential playback across multiple function calls
let audioQueue = Promise.resolve();

async function playTextToSpeech(text, voice = undefined) {
  // Initialize or resume the global AudioContext
  try {
    if (!globalAudioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      globalAudioCtx = new AudioContext();
    }
    if (globalAudioCtx.state === 'suspended') {
      await globalAudioCtx.resume();
    }
  } catch(e) {
    console.error(e);
  }

  console.log(text);

  // Chain this entire playback task to the global queue
  audioQueue = audioQueue.then(async () => {
    try {
      const voiceParam = voice ? `&voice=${encodeURIComponent(voice)}` : '';
      const response = await (voice === 'hype' 
        ? fetch(`http://127.0.0.1:5001/hype-tts?text=${encodeURIComponent(text)}${voiceParam}`) 
        : fetch(`http://127.0.0.1:5001/tts?text=${encodeURIComponent(text)}${voiceParam}`)
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Track speech timestamp right before loading
      window.leagueAssist.lastSpeechTime = Date.now();

      // 1. Fetch entire raw binary MP3 payload instead of streaming chunks
      const arrayBuffer = await response.arrayBuffer();

      // 2. Decode the unified MP3 payload into an AudioBuffer
      const audioBuffer = await globalAudioCtx.decodeAudioData(arrayBuffer);

      // 3. Add message to chat log
      const el = document.getElementById('chat-log');
      const messageEl = document.createElement('div');
      messageEl.textContent = text;
      el.appendChild(messageEl);
      el.scrollTop = el.scrollHeight;

      // This promise resolves only when this specific MP3 finishes playing completely
      await new Promise((resolvePlayback) => {
        // 3. Create, link, and instantiate the buffer source
        const source = globalAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(globalAudioCtx.destination);

        // 4. Update trailing timestamp metrics and unblock the queue when clip completes
        source.onended = () => {
          window.leagueAssist.lastSpeechTime = Date.now();
          resolvePlayback();
        };

        // 5. Fire immediate playback
        source.start(0);
      });

    } catch (error) {
      console.error('TTS Playback error:', error);
      // Don't break the global queue if one request fails
    }
  });

  // Wait for this item's turn in the queue to complete before finishing the function
  await audioQueue;
}
