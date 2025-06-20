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

SCOPES=["https://mail.google.com/"]
ACCOUNTS = ["ybotuil", "ybot", "liutoby"]

@dataclass
class AppContext:
   hello = "world"

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    service: Resource | None = None
    creds = {
      ACCOUNTS[0]: None,
      ACCOUNTS[1]: None,  
      ACCOUNTS[2]: None
    }

    for a in ACCOUNTS:
      filename = f"{a}-token.json"
      curr_creds = None
      if os.path.exists(filename):
        curr_creds = Credentials.from_authorized_user_file(filename, SCOPES)

      if not curr_creds or not curr_creds.valid:
        if curr_creds and curr_creds.expired and curr_creds.refresh_token:
            curr_creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "../credentials.json", SCOPES
            )
            curr_creds = flow.run_local_server(port=0)
        
        with open(filename, "w") as token:
            token.write(curr_creds.to_json())

    try:
        yield AppContext()
    finally:
        # Cleanup on shutdown
        print("Goodbye!")


mcp = FastMCP("gmail", lifespan=app_lifespan)

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
