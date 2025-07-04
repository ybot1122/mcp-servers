### MCP Servers

- **google-calendar**: retrieves events, helps with scheduling, and create events.
  - "Find a 30 minute window for me today"
  - "What's my schedule for this weekend"
  - "Book a 1 hr session at 3:30pm tomorrow"
- **gmail**: get unread emails, mark them as read. gets emails from 3 different accounts.
  - "Check my inbox"
  - "Mark all the emails as read"
  - "Mark the Sports emails as read"
- **league-of-legends:** return summary of active game, return items per champion, and return summary of a player's match history
  - "What tips can you give me for my current League of Legends game?"
  - "Which item should I build next?"
  - "Is my jungler playing their main role?"
- **weather**: fetches weather information. This is the tutorial from [MCP documentation](https://modelcontextprotocol.io/quickstart/server)

### Create a new MCP Server

```
# Create a new directory for our project
uv init weather
cd weather

# Create virtual environment and activate it
uv venv
.venv\Scripts\activate

# Install dependencies
uv add mcp[cli] httpx

# Create our server file
new-item server.py
```

For testing locally, you can connect it to Claude or use mcp CLI:

`uv run mcp dev server.py`

For google servers, also install Google libaries:

`uv pip install --upgrade google-api-python-client google-auth-httplib2 google-auth-oauthlib`

### Google Oauth Credentials

Store them in root in `credentials.json`. Do not commit them to a publically visible repo. Also remember to enable the APIs: https://console.cloud.google.com/apis/library
