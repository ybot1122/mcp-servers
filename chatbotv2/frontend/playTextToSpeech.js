// Global AudioContext initialization (instantiated on first use)
let globalAudioCtx = null;

// Global queue to ensure sequential playback across multiple function calls
let audioQueue = Promise.resolve();

async function playTextToSpeech(text) {
  
    // Initialize or resume the global AudioContext
    if (!globalAudioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        globalAudioCtx = new AudioContext();
    }
    if (globalAudioCtx.state === 'suspended') {
        await globalAudioCtx.resume();
    }

    console.log(text);

    // Chain this entire playback task to the global queue
    audioQueue = audioQueue.then(async () => {
        try {
            const response = await fetch(`http://127.0.0.1:5001/tts?text=${encodeURIComponent(text)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            let nextStartTime = globalAudioCtx.currentTime;
            const reader = response.body.getReader();

            // This promise resolves only when this specific stream finishes playing completely
            await new Promise(async (resolveStream) => {
                let pcmDataBuffer = [];
                let isFirstBufferGroup = true;
                const JITTER_BUFFER_SECONDS = 0.25;
                let activeSourcesCount = 0;

                function playCurrentQueue() {
                    if (pcmDataBuffer.length === 0) return;
                    const solidFloatArray = new Float32Array(pcmDataBuffer);
                    pcmDataBuffer = [];
                    
                    const audioBuffer = globalAudioCtx.createBuffer(1, solidFloatArray.length, 24000);
                    audioBuffer.getChannelData(0).set(solidFloatArray);
                    
                    const source = globalAudioCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(globalAudioCtx.destination);
                    
                    if (isFirstBufferGroup) {
                        nextStartTime = globalAudioCtx.currentTime + 0.1;
                        isFirstBufferGroup = false;
                    }
                    if (nextStartTime < globalAudioCtx.currentTime) {
                        nextStartTime = globalAudioCtx.currentTime;
                    }
                    
                    source.start(nextStartTime);
                    activeSourcesCount++;
                    
                    // Track when the absolute last chunk finishes playing to release the queue
                    source.onended = () => {
                        activeSourcesCount--;
                        if (activeSourcesCount === 0 && doneReading) {
                            resolveStream();
                        }
                    };

                    nextStartTime += audioBuffer.duration;
                }

                let doneReading = false;
                while (true) {
                    const { done, value } = await reader.read();
                    if (value) {
                        const int16Data = new Int16Array(value.buffer, value.byteOffset, value.byteLength / 2);
                        for (let i = 0; i < int16Data.length; i++) {
                            pcmDataBuffer.push(int16Data[i] / 32768.0);
                        }
                    }
                    
                    const accumulatedSeconds = pcmDataBuffer.length / 24000;
                    if (accumulatedSeconds >= JITTER_BUFFER_SECONDS) {
                        playCurrentQueue();
                    }
                    if (done) {
                        doneReading = true;
                        break;
                    }
                }

                if (pcmDataBuffer.length > 0) {
                    playCurrentQueue();
                } else if (activeSourcesCount === 0) {
                    // Fallback if the stream was empty
                    resolveStream();
                }
            });

        } catch (error) {
            console.error('TTS Streaming error:', error);
            // Don't break the global queue if one request fails
        }
    });

    // Wait for this item's turn in the queue to complete before finishing the function
    await audioQueue;
}
