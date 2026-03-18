# @annguyen209/mantis-mcp-server (npm package)

Standalone MCP server for MantisBT REST API endpoints.

## Install

```bash
npm install -g @annguyen209/mantis-mcp-server
```

or run directly via `npx` (recommended):

```bash
npx -y @annguyen209/mantis-mcp-server
```

## Configuration

Set the following env variables to point at your Mantis instance:

- `MANTIS_BASE_URL` (e.g. `https://mantis.example.com/api/rest`)
- `MANTIS_USE_INDEX_PHP` (`true` when Mantis is served without URL rewrite)
- `MANTIS_API_TOKEN` (create under **My Account → API Tokens** in Mantis)

Example:

```bash
export MANTIS_BASE_URL=https://mantis.example.com/api/rest
export MANTIS_USE_INDEX_PHP=true
export MANTIS_API_TOKEN=YOUR_REAL_TOKEN_HERE
```

### Example VS Code MCP configuration

```json
{
  "mcpServers": {
    "mantis-rest": {
      "command": "npx",
      "args": ["-y", "@annguyen209/mantis-mcp-server@latest"],
      "env": {
        "MANTIS_BASE_URL": "https://mantis.example.com/api/rest",
        "MANTIS_USE_INDEX_PHP": "true",
        "MANTIS_API_TOKEN": "YOUR_REAL_TOKEN_HERE"
      }
    }
  }
}
```

## Running

```bash
mantis-mcp-server
```

The server speaks MCP over stdio and exposes Mantis REST endpoints via tools.

For full developer documentation and local development setup, see the repository README (`README.dev.md`).
