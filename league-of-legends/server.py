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

@mcp.tool()
async def get_current_game_state(ctx: AppContext) -> str:
  url = "https://127.0.0.1:2999/liveclientdata/activeplayer"

  async with httpx.AsyncClient(verify=False) as client:
      resp = await client.get(url)
      data = resp.json()
      return json.dumps(data)

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
