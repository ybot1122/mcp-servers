import io
import random
from flask import Flask, request, Response, stream_with_context
from pykokoro import GenerationConfig, KokoroPipeline, PipelineConfig
import soundfile as sf
import numpy as np

app = Flask(__name__)

# Native Flask hook to inject CORS headers into every response automatically
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# Complete list of all 54 high-quality voices available in Kokoro v1.0
ALL_VOICES = [
    # American English (am = male, af = female)
    "af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", 
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", 
    "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", 
    "am_puck", "am_santa",
    
    # British English (bm = male, bf = female)
    "bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", 
    "bm_fable", "bm_george", "bm_lewis",
]

print("Loading Kokoro pipeline locally...")

generation = GenerationConfig(
    pause_mode="manual",
    speed=1.0,
    random_seed=42,
)
pipeline = KokoroPipeline(PipelineConfig(voice="af_sarah", generation=generation))

@app.route('/tts', methods=['GET'])
def tts():
    text_value = request.args.get('text', '')
    
    if not text_value:
        return "Missing 'text' query parameter", 400

    # Randomly select 1 of the 54 voices for this specific request
    selected_voice = random.choice(ALL_VOICES)
    print(f"Generating speech for text: '{text_value}' using voice: '{selected_voice}'")

    def generate_audio_stream():
        result = pipeline(text_value, voice=selected_voice)
        audio_data = result.audio
        
        # Kokoro provides Float32 numbers natively. We convert them to 
        # standard Int16 (16-bit PCM) arrays for ultra-lightweight streaming.
        pcm16_data = (audio_data * 32767).astype(np.int16)
        
        # Stream the raw bytes directly without any WAV headers blocking it
        yield pcm16_data.tobytes()

    return Response(
        stream_with_context(generate_audio_stream()), 
        mimetype="audio/pcm"  # Updated mime-type layout
    )

if __name__ == '__main__':
    app.run(port=5001, debug=False)