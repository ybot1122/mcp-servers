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
import base64

SCOPES=["https://mail.google.com/"]
ACCOUNTS = ["ybotuil", "ybot", "liutoby"]

@dataclass
class AppContext:
   services : dict[str, Resource | None]

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    services : dict[str, Resource | None] = {
      a: None for a in ACCOUNTS
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

      services[a] = build("gmail", "v1", credentials=curr_creds)

    try:
        yield AppContext(services=services)
    finally:
        # Cleanup on shutdown
        print("Goodbye!")

mcp = FastMCP("gmail", lifespan=app_lifespan)

@mcp.tool()
async def mark_as_read(ids: str, account: str) -> str:
    """Mark emails as read.
    
    Args:
        ids (str): Comma-separated list of email IDs to mark as read.
        account (str): The Gmail account to use ('ybotuil', 'ybot', or 'liutoby').
    """
    ctx = mcp.get_context()
    service = ctx.request_context.lifespan_context.services[account]

    if service is None:
        raise RuntimeError(f"Service for account {account} is not initialized.")

    ids_list = ids.split(',')
    msg = service.users().messages().batchModify(userId='me', body={
        'ids': ids_list,
        'removeLabelIds': ['UNREAD']
    }).execute()

    if 'error' in msg:
        raise RuntimeError(f"Failed to mark emails as read: {msg['error']}")

    return f"Marked {len(ids_list)} emails as read. {msg}"

@mcp.tool()
async def get_unread_emails(
) -> list[dict]:
    """Get unread emails from all Gmail accounts."""

    messages = []
    query = "is:unread"
    max_results = 10

    for a in ACCOUNTS:
        ctx = mcp.get_context()
        service = ctx.request_context.lifespan_context.services[a]

        if service is None:
            raise RuntimeError(f"Service for account {a} is not initialized.")

        results = service.users().messages().list(
            userId='me', q=query, maxResults=max_results
        ).execute()
        

        account_messages = results.get('messages', [])
        for msg in account_messages:
            msg_details = service.users().messages().get(
                userId='me', id=msg['id'], format='full'
            ).execute()
            msg_info = {
                'labels': msg_details.get('labelIds', []),
                'account': a,
                'id': msg_details['id'],
                'snippet': msg_details.get('snippet', ''),
                'subject': next(
                    (h['value'] for h in msg_details['payload']['headers'] if h['name'] == 'Subject'),
                    'No Subject'
                ) if 'headers' in msg_details['payload'] else 'No Subject',
                'from': next(
                    (h['value'] for h in msg_details['payload']['headers'] if h['name'] == 'From'),
                    'No Subject'
                ) if 'headers' in msg_details['payload'] else 'No Subject',
            }
            messages.append(msg_info)
          
    
    return messages


if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
