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


mcp = FastMCP("google-calendar", lifespan=app_lifespan)

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
