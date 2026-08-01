import io
import json
import random
import requests
from flask import Flask, request, Response, stream_with_context, jsonify, send_file
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

fish_audio_api_key = None

# Open and load the JSON file
with open("credentials.json", "r") as file:
  data = json.load(file)
  fish_audio_api_key = data.get("fishAudioApiKey")


@app.route('/hype-tts', methods=['GET'])
def hype_tts():
    text_value = request.args.get('text', '')
    if not text_value:
        return 'Missing text query parameter', 400
    try:
        print(text_value)
        r = requests.post(
            "https://api.fish.audio/v1/tts",
            headers={
                'Authorization': f'Bearer {fish_audio_api_key}',
                'Content-Type': 'application/json',
                'model': 's2.1-pro-free',
            },
            json={
                'text': text_value,
                'reference_id': 'e81232c5dea64b309c6cef5931fc455f',
                'format': 'mp3',
                'sample_rate': 32000
            }
        )
        # Check if the API returned an error status
        if r.status_code != 200:
            return f'Fish Audio API returned error: {r.text}', r.status_code
            
        # 2. Wrap r.content bytes inside an io.BytesIO stream
        audio_stream = io.BytesIO(r.content)
        audio_stream.seek(0)

        # 3. Stream the valid MP3 container directly to the browser
        return send_file(audio_stream, mimetype='audio/mpeg')
    except Exception as e:
        print(f'Error during TTS generation: {str(e)}')
        return f'TTS generation failed: {str(e)}', 500

@app.route('/tts', methods=['GET'])
def tts():
    text_value = request.args.get('text', '')
    voice_value = request.args.get('voice', None)
    if not text_value:
        return 'Missing text query parameter', 400
        
    selected_voice = voice_value if voice_value in ALL_VOICES else random.choice(ALL_VOICES)
    print(f'Generating speech for text: {text_value} using voice: {selected_voice}')
    
    try:
        # Run Kokoro pipeline inference
        result = pipeline(text_value, voice=selected_voice)
        audio_data = result.audio
                
        mp3_io = io.BytesIO()
        # Encode directly to MP3 format
        sf.write(mp3_io, audio_data, 24000, format='MP3')
        mp3_io.seek(0)

        return send_file(mp3_io, mimetype='audio/mpeg')
    except Exception as e:
        print(f'Error during local TTS generation: {str(e)}')
        return f'TTS generation failed: {str(e)}', 500


@app.route('/tts-wav', methods=['GET'])
def ttswav():
    text_value = request.args.get('text', '')
    if not text_value:
        return "Missing 'text' query parameter", 400
    selected_voice = random.choice(ALL_VOICES)
    try:
        result = pipeline.run(text_value)
        sf.write("output.wav", result.audio, result.sample_rate)
        return Response('done')
    except Exception as e:
        print(f"Error during generation: {str(e)}")
        return f"Audio generation failed: {str(e)}", 500

@app.route('/get-audio', methods=['GET'])
def get_audio():
    return send_file('welcome.wav', mimetype='audio/wav')

if __name__ == '__main__':
    app.run(port=5001, debug=False)