import threading
from flask import Flask, jsonify, request
import requests
import json
from collections import Counter

# Disable self-signed SSL warnings for the local Live Client API
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

CURRENT_PATCH_VERSION = '16.15.1'

# Native Flask hook to inject CORS headers into every response automatically
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

api_key = None

# Open and load the JSON file
with open("credentials.json", "r") as file:
  data = json.load(file)
  api_key = data.get("riotApiKey")

cache_lock = threading.Lock()

# 2. Your global variable
GLOBAL_CACHE = {"last_live_state": None}

def format_game_prompt_dynamic(data):
    # Extract the active player's name from the root data object
    active_player_name = data.get("activePlayer", {}).get("summonerName")
    
    # Handle edge case where active player data is missing
    if not active_player_name:
        return "Error: Active player data not found in the game response."

    my_team_champs = []
    enemy_team_champs = []
    my_champion = "Unknown Champion"
    my_team_side = None

    # First pass: find the active player's team side and champion
    for player in data.get("allPlayers", []):
        if player.get("summonerName") == active_player_name:
            my_champion = player.get("championName")
            my_team_side = player.get("team")
            break

    # Second pass: group champions by friendly vs enemy team
    for player in data.get("allPlayers", []):
        champ_name = player.get("championName")
        kda = "kills: " + str(player.get("scores").get("kills")) + " deaths: " + str(player.get("scores").get("deaths"))  + " assists: " + str(player.get("scores").get("assists")) + " cs: " + str(player.get("scores").get("creepScore"))
        if player.get("team") == my_team_side:
            my_team_champs.append(champ_name)
        else:
            enemy_team_champs.append(champ_name + "(" + kda + ")")

    # Format the lists into clean strings
    enemy_team_str = ", ".join(enemy_team_champs)
    my_team_str = ", ".join(my_team_champs)

    game_time = str(int(data.get("gameData").get("gameTime"))) + " seconds"

    # Return the exact requested string structure
    return f"this is a summary of my current league of legends game: On the enemy team: {enemy_team_str}. On my team: {my_team_str}. I am playing {my_champion}. Current game time is {game_time}. Any advice for what to focus on now?"

def get_new_events_api(newState):
    if GLOBAL_CACHE["last_live_state"] is None:
        return []

    current_time = newState.get("gameData").get("gameTime")
    if current_time <= 90:
        return []

    # Extract event lists safely, defaulting to empty lists if the key doesn't exist
    events1 = GLOBAL_CACHE["last_live_state"].get("events").get("Events")
    events2 = newState.get("events").get("Events")
    # Calculate how many new events have been appended
    len1 = len(events1)
    len2 = len(events2)
    
    # If the new state has more events, return the delta slice
    if len2 > len1:
        return events2[len1:]
        
    return []

def get_new_items_live_api(newState):
    """
    Returns the item display names that appear in the new state but were absent from 
    the previous state. The result is grouped by champion name.
    """

    current_time = newState.get("gameData").get("gameTime")
    if current_time <= 90:
        return {}

    if GLOBAL_CACHE["last_live_state"] is None:
        return {}
    
    # 1. Build an ID-to-Name mapping dynamically from both states if not provided
    item_lookup = {}
    for state in (GLOBAL_CACHE["last_live_state"], newState):
        if not state:
            continue
        for player in state.get("allPlayers") or []:
            if not player:
                continue
            for item in player.get("items") or []:
                if not item:
                    continue
                i_id = item.get("itemID")
                i_name = item.get("displayName")
                if i_id is not None and i_name:
                    item_lookup[i_id] = i_name

    def get_player_inventories(state_payload):
        inventories = {}
        if state_payload is None:
            return inventories
            
        players = state_payload.get("allPlayers")
        if not players:
            return inventories
            
        for player in players:
            if player is None:
                continue
            champion_name = player.get("championName")
            if not champion_name:
                continue
                
            item_counts = Counter()
            for item in player.get("items") or []:
                if item is None:
                    continue
                item_id = item.get("itemID")
                if item_id is None:
                    continue
                count = item.get("count", 1)
                item_counts[item_id] += count
                
            inventories[champion_name] = item_counts
        return inventories

    old_inventories = get_player_inventories(GLOBAL_CACHE["last_live_state"])
    current_inventories = get_player_inventories(newState)
    
    new_items = {}
    for champion_name, current_counts in current_inventories.items():
        old_counts = old_inventories.get(champion_name, Counter())
        new_entries = []
        
        for item_id, current_qty in current_counts.items():
            previous_qty = old_counts.get(item_id, 0)
            if current_qty > previous_qty:
                new_entries.extend([item_id] * (current_qty - previous_qty))
                
        if new_entries:
            new_items[champion_name] = new_entries

    # 2. Map the calculated itemIds back to their displayName string
    resolved_items = {}
    for champion_name, item_ids in new_items.items():
        resolved_items[champion_name] = [
            item_lookup.get(item_id, f"Unknown Item ({item_id})") 
            for item_id in item_ids
        ]
        
    return resolved_items


@app.route("/liveclientdata/allgamedata", methods=["GET"])
def live_proxy():
  """Proxy endpoint for the local Riot Games Live Client API running on port 2999."""
  live_api_url = "https://127.0.0.1:2999/liveclientdata/allgamedata"
  try:
    response = requests.get(live_api_url, verify=False, timeout=3)
    current_data = response.json()

    diff_data = get_new_items_live_api(current_data)
    new_events_data = get_new_events_api(current_data)
    next_game_prompt = format_game_prompt_dynamic(current_data)

    with cache_lock:
        GLOBAL_CACHE["last_live_state"] = current_data

    current_data["diff"] = diff_data
    current_data["new_events"] = new_events_data
    current_data["prompt"] = next_game_prompt

    return jsonify(current_data), response.status_code
  except requests.exceptions.RequestException as e:
    return (
        jsonify({
            "error": "Could not connect to Live Client API. Is League running?"
        }),
        503,
    )

@app.route("/lookup-summoner", methods=["GET"])
def lookup_summoner():
  """Endpoint that accepts a summonerName query parameter and fetches match history."""
  if not api_key:
    return {"error": "Riot API key not configured in credentials.json"}, 500

  # Extract the summonerName parameter from the query string
  summoner_name = request.args.get("summonerName")
  if not summoner_name:
    return {"error": "Missing 'summonerName' query parameter"}, 400

  try:
    game_name, tag_line = summoner_name.split("#", 1)
  except ValueError:
    return {"error": "summonerName must be formatted as gameName#tagLine"}, 400

  print(f"Looking up summoner: {game_name}#{tag_line}")

  try:
      # 1. Resolve PUUID via Riot Account API
      get_puuid_url = f'https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}?api_key={api_key}'
      puuid_resp = requests.get(get_puuid_url, verify=False)

      if puuid_resp.status_code != 200:
        return {
            "error": f"Failed to look up summoner: {puuid_resp.status_code}"
        }, puuid_resp.status_code

      puuid_data = puuid_resp.json()
      puuid = puuid_data.get("puuid")
      if not puuid:
        return {"error": "Unable to resolve player PUUID"}, 404

      match_history_url = f'https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=10&api_key={api_key}'
      match_history_resp = requests.get(match_history_url, verify=False)

      if match_history_resp.status_code != 200:
        return {
            "error": (
                f"Failed to fetch match history: {match_history_resp.status_code}"
            )
        }, match_history_resp.status_code

      match_history_data = match_history_resp.json()

      # 3. Fetch Details for individual matches
      match_details = []
      for match_id in match_history_data:
        match_url = f'https://americas.api.riotgames.com/lol/match/v5/matches/{match_id}?api_key={api_key}'
        match_resp = requests.get(match_url, verify=False)

        if match_resp.status_code == 200:
          match_details.append(match_resp.json())
        else:
          match_details.append({
              "matchId": match_id,
              "error": f"Failed to fetch match details: {match_resp.status_code}",
          })

      return {
          "gameName": game_name,
          "tagLine": tag_line,
          "puuid": puuid,
          "matchCount": len(match_details),
          "matchDetails": match_details,
      }

  except requests.RequestException as e:
    return {"error": f"An error occurred while making the request: {e}"}, 500

if __name__ == "__main__":
  app.run(host="127.0.0.1", port=5000, debug=True)
