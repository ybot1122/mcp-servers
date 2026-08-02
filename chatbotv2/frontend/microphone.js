  let micAudioContext;
  let analyser;
  let mediaRecorder;
  let audioChunks = [];
  let micStream = null;
  let isMicOn = false;
  let silenceTimeout = null;

  // Configuration settings
  const SILENCE_THRESHOLD = 0.015; // Volume level considered "silent"
  const SILENCE_DURATION = 2000;   // Time in milliseconds to wait before stopping (2 seconds)

  const button = document.getElementById('toggleMicButton');
  const statusDiv = document.getElementById('Micstatus');

  button.addEventListener('click', async () => {
    if (!isMicOn) {
      await startMicStream();
    } else {
      stopMicStream();
    }
  });

  async function startMicStream() {
    try {
      // 1. Request permanent mic stream
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      isMicOn = true;
      button.textContent = "Turn Microphone Off";
      statusDiv.textContent = "Status: Listening for speech...";

      // 2. Set up Web Audio API to monitor volume
      micAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = micAudioContext.createMediaStreamSource(micStream);
      analyser = micAudioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      // 3. Start monitoring the volume loop
      monitorVolume();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      statusDiv.textContent = "Status: Mic access denied";
    }
  }

  function monitorVolume() {
    if (!isMicOn) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    // Calculate Root Mean Square (RMS) for absolute volume level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Check if user is speaking or silent
    if (rms > SILENCE_THRESHOLD) {
      // User is speaking: reset the silence timer and ensure we are recording
      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        silenceTimeout = null;
      }

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        startRecordingChunk();
      }
    } else {
      // User is silent: start the timer to stop recording if not already started
      if (mediaRecorder && mediaRecorder.state === 'recording' && !silenceTimeout) {
        silenceTimeout = setTimeout(() => {
          mediaRecorder.stop(); // This triggers the upload automatically
          statusDiv.textContent = "Status: Silence detected. Uploading audio...";
        }, SILENCE_DURATION);
      }
    }

    // Keep checking the volume on the next animation frame
    requestAnimationFrame(monitorVolume);
  }

  function startRecordingChunk() {
    audioChunks = [];
    mediaRecorder = new MediaRecorder(micStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      await sendToServer(audioBlob);
      
      // If mic is still globally on, reset status to ready for next speech
      if (isMicOn) {
        statusDiv.textContent = "Status: Listening for speech...";
      }
    };

    mediaRecorder.start();
    statusDiv.textContent = "Status: User is speaking... recording...";
  }

  async function sendToServer(blob) {
    const formData = new FormData();
    formData.append('audio', blob, 'voice-note.webm');

    try {
      const response = await fetch('https://your-backend-server.com', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      console.log('Upload success:', result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }

  function stopMicStream() {
    isMicOn = false;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (silenceTimeout) clearTimeout(silenceTimeout);
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }
    if (micAudioContext) {
      micAudioContext.close();
    }
    button.textContent = "Turn Microphone On";
    statusDiv.textContent = "Status: Mic is Off";
  }
