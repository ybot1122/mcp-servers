### MCP Servers

- **google-calendar**: retrieves events, helps with scheduling, and create events.
- **gmail**: get unread emails, mark them as read. gets emails from 3 different accounts.
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
