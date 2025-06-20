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
CALENDAR_IDS = ["primary", "lb284rombp29sb39dhbcvcn82c@group.calendar.google.com"]

@dataclass
class AppContext:
    service: Resource

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


mcp = FastMCP("google-calendar", lifespan=app_lifespan)

@mcp.tool()
async def get_my_day(day: str) -> str:
    """Get events for a specific day from primary and shared calendars.
    
    Args:
      day (str): The day to get events for in YYYY-MM-DD format.
    """
    ctx = mcp.get_context()
    service = ctx.request_context.lifespan_context.service
    start_day = datetime.datetime.fromisoformat(day)
    timeMin = start_day.isoformat() + "Z"
    timeMax = (start_day + datetime.timedelta(days=1)).isoformat() + "Z"
    primary_events, shared_events = [], []

    try:
      primary_events = (
          service.events()
          .list(
              calendarId=CALENDAR_IDS[0],
              timeMin=timeMin,
              timeMax=timeMax,
              singleEvents=True,
              orderBy="startTime",
          )
          .execute()
      )
      shared_events = (
          service.events()
          .list(
              calendarId=CALENDAR_IDS[1],
              timeMin=timeMin,
              timeMax=timeMax,
              singleEvents=True,
              orderBy="startTime",
          )
          .execute()
      )
    except Exception as e:
        return f"Error fetching events: {str(e)}"

    events = primary_events.get("items", []) + shared_events.get("items", [])

    if not events:
        return "No events found for today."

    # Prints the start and name of today's events
    result = ""
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date"))
        result += f"{start} {event['summary']}\n"

    return result

@mcp.resource("calendar://calendars")
async def get_calendars() -> str:
    """Get list of calendars"""
    ctx = mcp.get_context()
    service = ctx.request_context.lifespan_context.service
    calendars_result = (
        service.calendarList()
        .list()
        .execute()
    )
    calendars = calendars_result.get("items", [])

    if not calendars:
        return "No calendars found."

    result = ""
    for calendar in calendars:
        result += f"{calendar['summary']}: {calendar['id']}\n"

    return result


@mcp.resource("calendar://events")
async def ten_events() -> str:
    """Get next ten upcoming events from primary calendar"""
    ctx = mcp.get_context()
    service = ctx.request_context.lifespan_context.service
    now = datetime.datetime.utcnow().isoformat() + "Z"
    events_result = (
        service.events() 
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


if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
