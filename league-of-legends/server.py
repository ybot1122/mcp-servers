import json
import httpx # type: ignore
from mcp.server.fastmcp import FastMCP # type: ignore
from mcp.server import Server # type: ignore
from contextlib import asynccontextmanager
from dataclasses import dataclass
from collections.abc import AsyncIterator

@dataclass
class AppContext:
   apiKey: str

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    with open("token.json", "r") as f:
      data = json.load(f)
      api_key = data.get("riotApiKey", "")

    ctx = AppContext(apiKey=api_key)
    yield ctx

mcp = FastMCP("league of legends", lifespan=app_lifespan)

# HELPER FUNCTION to get information about a player
def getPlayerInfo(playerInfo: dict) -> dict:
    """Extracts relevant player information from the playerInfo dictionary."""
    return {
        "riotId": playerInfo.get("riotId", "UNKNOWN RIOT ID"),
        "championName": playerInfo.get("championName", "UNKNOWN CHAMPION NAME"),
        "keystone": playerInfo.get("runes", {}).get("keystone", {}).get("displayName", "UNKNOWN KEYSTONE"),
        "level": playerInfo.get("level", "UNKNOWN LEVEL"),
        "team": playerInfo.get("team", "UNKNOWN TEAM"),
        "kills": playerInfo.get("scores", {}).get("kills", "UNKNOWN KILLS"),
        "deaths": playerInfo.get("scores", {}).get("deaths", "UNKNOWN DEATHS"),
        "position": playerInfo.get("position", "UNKNOWN ROLE")
    }

@mcp.tool()
async def get_items(championName: str) -> str:
  """Returns the items for the given champion in the current game.
  Args:
      championName (str): The name of the champion.
  """

  url = "https://127.0.0.1:2999/liveclientdata/allgamedata"

  try:
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(url)
        data = resp.json()

    if not data:
        return "No data found"
    
    currPlayer = next((p for p in data.get("allPlayers", []) if p.get("championName", "") == championName), None)
    if not currPlayer:
        return f"{championName} not found in the game."
    items = currPlayer.get("items", [])
    return ', '.join(i['displayName'] for i in items)

  except httpx.RequestError as e:
    return f"An error occurred while making the request: {e}"


@mcp.tool()
async def get_current_game_state() -> str:
  """Returns a summary of the current League of Legends game.
  """

  url = "https://127.0.0.1:2999/liveclientdata/allgamedata"

  try:
    async with httpx.AsyncClient(verify=False) as client:
        resp = await client.get(url)
        data = resp.json()

    if not data:
        return "No data found"
    
    riotId = data.get("activePlayer", {}).get("riotId", " UNKNOWN RIOT ID")
    currPlayer = next((p for p in data.get("allPlayers", []) if p.get("riotId", "") == riotId), None)
    if not currPlayer:
        return f"Player with riotId {riotId} not found in the game."
    currPlayerInfo = getPlayerInfo(currPlayer)

    roleOpponent = next((p for p in data.get("allPlayers", []) if p.get("position", "") == currPlayerInfo['position'] and p.get("team") != currPlayerInfo['team']), None)
    if not roleOpponent:
        return f"Could not find role opponent."
    oppPlayerInfo = getPlayerInfo(roleOpponent)

    teammates = [getPlayerInfo(p) for p in data.get("allPlayers", []) if p.get("team") == currPlayerInfo['team']]
    opponents = [getPlayerInfo(p) for p in data.get("allPlayers", []) if p.get("team") != currPlayerInfo['team']]

    teammateInfo = f"My teammates are: {', '.join([p['championName'] for p in teammates])}."
    opponentInfo = f"My opponents are: {', '.join([p['championName'] for p in opponents])}."

    return f"I am {riotId}, playing as {currPlayerInfo['championName']} in the {currPlayerInfo['position']} role with the keystone rune {currPlayerInfo['keystone']}. I am level {currPlayerInfo['level']} with {currPlayerInfo['kills']} kills and {currPlayerInfo['deaths']} deaths. My role opponent is {oppPlayerInfo['championName']} with key stone rune {oppPlayerInfo['keystone']} at level {oppPlayerInfo['level']} with {oppPlayerInfo['kills']} kills and {oppPlayerInfo['deaths']} deaths. {teammateInfo} {opponentInfo}."
  
  except httpx.RequestError as e:
    return f"An error occurred while making the request: {e}"
  



if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
