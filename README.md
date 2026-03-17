# MantisMcpServer

Standalone MCP server for MantisBT REST API endpoints.

## Install options

### Recommended: run from npm with `npx`

Once published, the easiest VS Code setup is to let your MCP client launch the package with `npx`.

Example:

```json
{
   "mcpServers": {
      "mantis-rest": {
         "command": "npx",
         "args": ["-y", "@andev4life/mantis-mcp-server"],
         "env": {
            "MANTIS_BASE_URL": "https://mantis.example.com/api/rest",
            "MANTIS_USE_INDEX_PHP": "true",
            "MANTIS_API_TOKEN": "YOUR_REAL_TOKEN_HERE"
         }
      }
   }
}
```

VS Code still talks to the MCP server over `stdio`; `npx` only changes how the process is started.

### Local repo workflow

If you are developing this server locally, you can still point VS Code at the bundled file in this repo.

## Wrapped endpoints

- `GET /users/me` -> `mantis_users_me`
- API auth/connectivity check -> `mantis_health_check`
- `GET /issues?id=...` -> `mantis_issues_get`
- `GET /issues?...filters` -> `mantis_issues_search`
- `PATCH /issues/{id}` -> `mantis_issues_update`
- `plugin.php?page=TimeTracking/timesheet_crud_api` -> `mantis_issues_timesheet_crud`
- `POST /issues` -> `mantis_issues_create`
- `DELETE /issues?id=...` -> `mantis_issues_delete`
- `GET /config?option=...` -> `mantis_config_get`
- `GET /lang?string=...` -> `mantis_lang_get`

### Timesheet tool name

- `mantis_issues_timesheet_crud`

## Setup

### Local development setup

1. Install dependencies
   - `npm install`
2. Build bundled runtime (recommended for distribution)
   - `npm run build`
3. Copy env file and set values
   - copy `.env.example` to `.env`
   - set `MANTIS_BASE_URL`, `MANTIS_API_TOKEN`, `MANTIS_USE_INDEX_PHP`
4. Start server
   - `npm start`
   - (`npm run start:src` keeps source mode for development)
5. Configure your MCP client
   - point it to `dist/server.bundle.js` for bundled runtime, or `src/server.js` for source mode
   - example command: `node D:/php/MantisMcpServer/dist/server.bundle.js`

## npm packaging notes

This repo is set up so it can be delivered as an npm package.

- npm package name: `@andev4life/mantis-mcp-server`
- CLI entrypoint: `mantis-mcp-server`
- package launcher for VS Code: `npx -y @andev4life/mantis-mcp-server`
- publish-time build: `npm run prepack`
- package preview: `npm run pack:check`

The published package is designed to include the bundled runtime under `dist/` and a small CLI shim under `bin/`.

## Use in VS Code

For a practical guide to configuring this server in VS Code and using it effectively from chat, see:

- [`docs/using-mcp-effectively-in-vscode.md`](docs/using-mcp-effectively-in-vscode.md)

The guide covers:

- how to wire the server into your MCP client settings
- how to phrase requests so the assistant uses the right Mantis tools
- timesheet and issue workflow examples
- troubleshooting tips for auth, IIS, and tool visibility

## API token

The server reads the Mantis API token from `MANTIS_API_TOKEN`.

### Option 1: `.env`

Example `D:/php/MantisMcpServer/.env`:

```env
MANTIS_BASE_URL=https://mantis.example.com/api/rest
MANTIS_USE_INDEX_PHP=true
MANTIS_API_TOKEN=YOUR_REAL_TOKEN_HERE
```

### Option 2: MCP client config

Example MCP client configuration for a local repo checkout:

```json
{
   "mcpServers": {
      "mantis-rest": {
         "command": "node",
         "args": ["D:/php/MantisMcpServer/dist/server.bundle.js"],
         "env": {
            "MANTIS_BASE_URL": "https://mantis.example.com/api/rest",
            "MANTIS_USE_INDEX_PHP": "true",
            "MANTIS_API_TOKEN": "YOUR_REAL_TOKEN_HERE"
         }
      }
   }
}
```

### Notes about the token

- Create the token in Mantis under **My Account** -> **API Tokens**.
- The token is sent as a raw `Authorization` header value, not as `Bearer <token>`.
- Do not commit a real token to source control.

## Notes

- For IIS deployments without URL rewrite, keep `MANTIS_USE_INDEX_PHP=true`.
- API token is sent in `Authorization` header as raw token (no `Bearer` prefix).
- The bundled runtime keeps `dotenv` external, so `npm install` must be run before `npm start`.
- Generated templates in `generated-templates/` may still need path updates for your local installation.
