from datetime import datetime, timedelta
import json
import httpx # type: ignore
from mcp.server.fastmcp import FastMCP # type: ignore
from mcp.server import Server # type: ignore
from contextlib import asynccontextmanager
from dataclasses import dataclass
from collections.abc import AsyncIterator

@dataclass
class AppContext:
   clientId: str
   clientSecret: str
   accessToken: str

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    with open("token.json", "r") as f:
      data = json.load(f)
      CLIENT_ID = data.get("CLIENT_ID", "")
      CLIENT_SECRET = data.get("CLIENT_SECRET", "")
      ACCESS_TOKEN = data.get("ACCESS_TOKEN", "")

    ctx = AppContext(clientId=CLIENT_ID, clientSecret=CLIENT_SECRET, accessToken=ACCESS_TOKEN)
    yield ctx

mcp = FastMCP("oura", lifespan=app_lifespan)

@mcp.resource("auth://{code}")
async def exchange_code_for_token(code: str) -> dict:
    """
    NOTE THIS IS ONLY FOR DEV/DEBUG PURPOSES
    Exchanges an authorization code for an Oura access token.

    Args:
        code (str): The authorization code received from Oura OAuth.

    Returns:
        dict: The response from the Oura /oauth/token endpoint.
    """
    redirect_uri = "http://localhost:8080"

    ctx = mcp.get_context()
    client_id = ctx.request_context.lifespan_context.clientId
    client_secret = ctx.request_context.lifespan_context.clientSecret

    token_url = "https://api.ouraring.com/oauth/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(token_url, data=data)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP error: {e.response.status_code}", "detail": e.response.text}
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
async def get_last_nights_sleep_document() -> str:
  """Returns the overall sleep score and sub-scores for the user's sleep last night.
  """

  today = datetime.now().date()
  prior_date = (today + timedelta(days=-1)).isoformat()
  start_date = today.isoformat()
  end_date = (today + timedelta(days=1)).isoformat()
  url = f"https://api.ouraring.com/v2/usercollection/daily_sleep?start_date={start_date}&end_date={end_date}"

  try:
    async with httpx.AsyncClient(verify=False) as client:
        ctx = mcp.get_context()
        accessToken = ctx.request_context.lifespan_context.accessToken
        resp = await client.get(url, headers={"Authorization": f"Bearer {accessToken}"})
        data = resp.json()

    if not data:
        return "No data found"
    
    day = data.get("data")[0]
    overall = day.get("score")    
    contributors = day.get("contributors", {})
    deep_sleep = contributors.get("deep_sleep")
    efficiency = contributors.get("efficiency")
    latency = contributors.get("latency")
    rem_sleep = contributors.get("rem_sleep")
    restfulness = contributors.get("restfulness")
    timing = contributors.get("timing")
    total_sleep = contributors.get("total_sleep")

    result = f"Sleep scores for last night (from {prior_date} to {today}). Overall Sleep Score: {overall}\nDeep Sleep: {deep_sleep}\nEfficiency: {efficiency}\nLatency: {latency}\nREM Sleep: {rem_sleep}\nRestfulness: {restfulness}\nTiming: {timing}\nTotal Sleep: {total_sleep}"
    return result

  except httpx.RequestError as e:
    return f"An error occurred while making the request: {e}"


@mcp.tool()
async def get_sleep_documents(start_date: str, end_date: str) -> str:
    """Returns user's overall sleep score, and sub-scores for each day between start_date (inclusive) and end_date (exclusive).
    Args:
        start_date (str): The start day to retrieve sleep score. YYYY-MM-DD format.
        end_date (str): The last day to retrieve sleep score. YYYY-MM-DD format.
    """

    base_url = f"https://api.ouraring.com/v2/usercollection/daily_sleep?start_date={start_date}&end_date={end_date}"
    result = ""
    next_token = None
    try:
        async with httpx.AsyncClient(verify=False) as client:
            ctx = mcp.get_context()
            accessToken = ctx.request_context.lifespan_context.accessToken
            url = base_url
            while True:
                # Add next_token to the URL if present
                if next_token:
                    url_with_token = f"{url}&next_token={next_token}"
                else:
                    url_with_token = url
                resp = await client.get(url_with_token, headers={"Authorization": f"Bearer {accessToken}"})
                data = resp.json()
                if not data or "data" not in data or not data["data"]:
                    if not result:
                        return "No data found"
                    break
                days = data.get("data", [])
                for day in days:
                    date_str = day.get("day")
                    overall = day.get("score")
                    contributors = day.get("contributors", {})
                    deep_sleep = contributors.get("deep_sleep")
                    efficiency = contributors.get("efficiency")
                    latency = contributors.get("latency")
                    rem_sleep = contributors.get("rem_sleep")
                    restfulness = contributors.get("restfulness")
                    timing = contributors.get("timing")
                    total_sleep = contributors.get("total_sleep")
                    result += (
                        f"Date: {date_str}\n"
                        f"  Overall Sleep Score: {overall}\n"
                        f"  Deep Sleep: {deep_sleep}\n"
                        f"  Efficiency: {efficiency}\n"
                        f"  Latency: {latency}\n"
                        f"  REM Sleep: {rem_sleep}\n"
                        f"  Restfulness: {restfulness}\n"
                        f"  Timing: {timing}\n"
                        f"  Total Sleep: {total_sleep}\n\n"
                    )
                next_token = data.get("next_token")
                if not next_token:
                    break
        return result
    except httpx.RequestError as e:
        return f"An error occurred while making the request: {e}"

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
