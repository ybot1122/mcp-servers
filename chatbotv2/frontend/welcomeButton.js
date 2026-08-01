// Define the path to your audio file
const AUDIO_URL = 'http://127.0.0.1:5001/get-audio'; 

let audioContext;
let audioBuffer;
const playButton = document.getElementById('welcome_play');

// 1. Fetch and decode the audio file into memory
async function loadAudio() {
    try {
        playButton.disabled = true;
        playButton.textContent = 'Loading audio...';

        // Fetch the file as binary data (ArrayBuffer)
        const response = await fetch(AUDIO_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const arrayBuffer = await response.arrayBuffer();

        // Create the AudioContext (safely handling browser variants)
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextClass();

        // Decode the binary audio data into an AudioBuffer
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        playButton.disabled = false;
        playButton.textContent = 'Play Audio';
    } catch (error) {
        console.error('Error loading or decoding audio:', error);
        playButton.textContent = 'Error Loading Audio';
    }
}

// 2. Play the decoded audio buffer
function playAudio() {
    // Resume context if browser suspended it
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Create a buffer source node (must be created fresh for every playback)
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Connect the source node directly to the speakers (destination)
    source.connect(audioContext.destination);

    // Start playing immediately
    source.start(0);
}

// Event listener mapping the workflow to the button click
playButton.addEventListener('click', async () => {
    // First click initializes the AudioContext and loads the file
    if (!audioBuffer) {
        await loadAudio();
        playAudio();
    } else {
        // Subsequent clicks instantly trigger the audio since it's cached in memory
        playAudio();
    }

    playTextToSpeech('hello hello hello [sarcastic] looks like someone clicked the button', 'hype')
});
