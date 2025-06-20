### MCP Servers

- **google-calendar**: retrieves events, helps with scheduling, and also can create events.
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
new-item weather.py
```

For testing locally, you can connect it to Claude or use mcp CLI:

`uv run mcp dev server.py`
