# server.py
import datetime
import os.path

from mcp.server.fastmcp import FastMCP # type: ignore
from mcp.server import Server # type: ignore
from contextlib import asynccontextmanager
from dataclasses import dataclass
from collections.abc import AsyncIterator
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build, Resource


SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Create a named server
mcp = FastMCP("My App")

mcp = FastMCP("My App", dependencies=["pandas", "numpy"])

@dataclass
class AppContext:
    service: Resource
    test: str = "test"


@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    creds = None
    service: Resource | None = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    service = build("calendar", "v3", credentials=creds)

    if not service:
        raise Exception("Failed to create Google Calendar service")
    
    try:
        yield AppContext(service=service)
    finally:
        # Cleanup on shutdown
        print("Goodbye!")


mcp = FastMCP("My App", lifespan=app_lifespan)


# Add an addition tool
@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b


# Add a dynamic greeting resource
@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    return f"Hello, {name}!"

# Get next ten upcoming events from primary calendar
@mcp.resource("calendar://events")
async def ten_events() -> str:
    """Get next ten upcoming events from primary calendar"""
    ctx = mcp.get_context()
    service = ctx.request_context.lifespan_context.service
    now = datetime.datetime.utcnow().isoformat() + "Z"
    events_result = (
        service.events()  # type: ignore
        .list(
            calendarId="primary",
            timeMin=now,
            maxResults=10,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])

    if not events:
      return "No upcoming events found."

    # Prints the start and name of the next 10 events
    result = ""
    for event in events:
      start = event["start"].get("dateTime", event["start"].get("date"))
      result += f"{start} {event['summary']}\n"

    return result