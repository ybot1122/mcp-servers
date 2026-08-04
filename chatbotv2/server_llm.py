import time
import os
import random
import torch
import transformers
import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from flask import Flask, request, jsonify
from google import genai
import requests
from openai import OpenAI
from anthropic import Anthropic

MODEL_ID = "google/gemma-2-2b-it"
LOCAL_MODEL_PATH = "./local_model"
sentinel_file = os.path.join(LOCAL_MODEL_PATH, "config.json")

CURRENT_PATCH_VERSION = '16.15.1'

# Check if model has already been successfully downloaded 
if os.path.exists(sentinel_file): 
    print(f"Model already exists locally at '{LOCAL_MODEL_PATH}'. Skipping download.") 
else: 
    print(f"Local model files not found. Starting download to '{LOCAL_MODEL_PATH}'...") 
    
    # Fix the RoPE warning in the config before saving it
    print("Fetching and modifying configuration...")
    config = transformers.Gemma2Config.from_pretrained(MODEL_ID)
    if hasattr(config, "rope_scaling") and config.rope_scaling is not None:
        orig_max = config.rope_scaling.get("original_max_position_embeddings", 8192)
        curr_max = getattr(config, "max_position_embeddings", 8192)
        config.rope_scaling["factor"] = float(curr_max / orig_max)
        config.rope_scaling.pop("original_max_position_embeddings", None)

    # 1. Download and save Tokenizer files 
    print("Downloading tokenizer...") 
    tokenizer = transformers.AutoTokenizer.from_pretrained(MODEL_ID) 
    tokenizer.save_pretrained(LOCAL_MODEL_PATH) 

    # 2. Download and save Model weights in native bfloat16
    print("Downloading model weights (this might take a while)...") 
    model = transformers.Gemma2ForCausalLM.from_pretrained( 
        MODEL_ID, 
        config=config,
        torch_dtype=torch.bfloat16, 
        device_map="auto" 
    ) 
    model.save_pretrained(LOCAL_MODEL_PATH) 
    print(f"\nAll files saved completely to '{LOCAL_MODEL_PATH}'!") 

pipe = transformers.pipeline(
    "text-generation",
    model=LOCAL_MODEL_PATH,                      # Point directly to your local folder
    tokenizer=LOCAL_MODEL_PATH,                  # Load the local tokenizer files
    model_kwargs={"torch_dtype": torch.bfloat16},
    device="cpu",                               # Keep "cuda" for Nvidia or change to "mps" for Mac
)

print("Model ready for offline use.")

llm_executor = ThreadPoolExecutor(max_workers=2)


def run_model_inference(messages, max_new_tokens=256, timeout_seconds=5):
    future = llm_executor.submit(pipe, messages, max_new_tokens=max_new_tokens)
    try:
        return future.result(timeout=timeout_seconds)
    except TimeoutError:
        future.cancel()
        raise TimeoutError("LLM request timed out after 5 seconds")

# Fetch and store item and champion info
CHAMPION_DATA = requests.get(f'https://ddragon.leagueoflegends.com/cdn/{CURRENT_PATCH_VERSION}/data/en_US/champion.json').json()["data"]

app = Flask(__name__)

# Native Flask hook to inject CORS headers into every response automatically
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route('/deeplore', methods=['GET'])
def query_deeplore():
    raw_value = request.args.get('champions', '')
    champions_list = [c.strip() for c in raw_value.split(',') if c.strip()]

    if not champions_list:
        return jsonify({'error': 'No champions provided'}), 400

    chosen_champion = random.choice(champions_list)
    formatted_name = ''.join(c for c in chosen_champion if c.isalnum())

    if not formatted_name:
        return jsonify({'error': 'Invalid champion name after formatting'}), 400

    print(formatted_name)
    lore_url = f'https://ddragon.leagueoflegends.com/cdn/{CURRENT_PATCH_VERSION}/data/en_US/champion/{formatted_name}.json'
    print(f"Fetching lore for champion: {formatted_name} from {lore_url}")
    lore = requests.get(lore_url).json()["data"][formatted_name]["lore"]

    if not lore:
        return jsonify({'error': f'No lore found for champion {formatted_name}'}), 404

    prompt_with_context = "Summarize this League of Legends champion lore in 3 sentences max: " + lore

    try:
        messages = [{"role": "user", "content": prompt_with_context}] 
        outputs = run_model_inference(messages, max_new_tokens=256, timeout_seconds=15)
        generated_text = outputs[0]["generated_text"][-1]["content"].strip()

        return jsonify({
            'champion': formatted_name,
            'response': generated_text
        })
    except TimeoutError:
        return jsonify({'error': 'LLM request timed out'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to process LLM request: {str(e)}'}), 500


@app.route('/llm', methods=['GET'])
def query_llm():
    user_query = request.args.get('text')
    raw_value = request.args.get('champions', '')
    champions_list = [c.strip() for c in raw_value.split(',') if c.strip()]

    if not user_query:
        return jsonify({'error': 'Missing required query parameter "text"'}), 400

    print("Handling Prompt: " + user_query)

    champion_context = ''

    for champ in champions_list:
        formatted_name = champ.capitalize()
        if formatted_name in CHAMPION_DATA:
            champion_context += " " + formatted_name + ": " + CHAMPION_DATA[formatted_name]['blurb'] + "."

    prompt_with_context = champion_context + ". " + user_query

    try:
        start_time = time.perf_counter()
        messages = [{"role": "user", "content": prompt_with_context}] 
        outputs = run_model_inference(messages, max_new_tokens=256, timeout_seconds=5)
        generated_text = outputs[0]["generated_text"][-1]["content"].strip()

        print(generated_text)

        return jsonify({
            'query': user_query,
            'response': generated_text,
            'model': LOCAL_MODEL_PATH,
            'duration': time.perf_counter() - start_time
        })
    except TimeoutError:
        return jsonify({'error': 'LLM request timed out'}), 500
    except Exception as e:
        return jsonify({'error': f'Failed to process LLM request: {str(e)}'}), 500

g_api_key = None
openai_api_key = None
anthropic_api_key = None

# Open and load the JSON file
with open("credentials.json", "r") as file:
  data = json.load(file)
  g_api_key = data.get("googleAiApiKey")
  openai_api_key = data.get("openAiApiKey")
  anthropic_api_key = data.get("anthropicApiKey")

g_client = genai.Client(api_key=g_api_key)
gemini_model = 'gemini-3.6-flash'

openai_client = OpenAI(api_key=openai_api_key)
openai_model = 'gpt-5.5'

anthropic_client = Anthropic(api_key=anthropic_api_key)
anthropic_model = 'claude-opus-5'

@app.route('/league-game', methods=['GET'])
def query_llm_league():
    current_game_state = request.args.get('text')
    free = request.args.get('free')
    if not current_game_state:
        return jsonify({'error': 'Missing required query parameter "text"'}), 400

    instructions = 'You are an expert at League of Legends. Here is the state of my current ranked game. Answer in 5 sentences max.'

    if free is not None:
        return jsonify({
            'query': current_game_state,
            'response': 'Try your best!',
            'model': 'free',
        })

    # gemini
    try:
        response = g_client.models.generate_content(
            model=gemini_model,
            contents=instructions + current_game_state,
        )

        return jsonify({
            'query': current_game_state,
            'response': response.text,
            'model': gemini_model,
        })
    except Exception as e:
        print(e)

    # openai
    try:
        messages_input = [
            {"role": "user", "content": current_game_state}
        ]
        response = openai_client.responses.create(
            model=openai_model,
            instructions=instructions,
            input=messages_input,
            max_output_tokens=1000
        )
        return jsonify({
            'query': current_game_state,
            'response': response.output_text,
            'model': openai_model,
        })
    except Exception as e:
        print(e)

    # anthropic
    try:
        messages_input = [
            {"role": "user", "content": instructions + current_game_state}
        ]
        response = anthropic_client.messages.create(
            model=anthropic_model,
            messages=messages_input,
            max_tokens=1000
        )
        return jsonify({
            'query': current_game_state,
            'response': response.output_text,
            'model': anthropic_model,
        })
    except Exception as e:
        print(e)

    return jsonify({'error': f'Failed to get League advice'}), 500


if __name__ == '__main__':
    # Set debug=False in production environments
    app.run(host='127.0.0.1', port=5002, debug=True)
