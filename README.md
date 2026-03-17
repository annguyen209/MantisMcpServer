# MantisMcpServer

Standalone MCP server for MantisBT REST API endpoints.

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

## API token

The server reads the Mantis API token from `MANTIS_API_TOKEN`.

### Option 1: `.env`

Example `D:/php/MantisMcpServer/.env`:

```env
MANTIS_BASE_URL=https://eil.ewarenow.com/api/rest
MANTIS_USE_INDEX_PHP=true
MANTIS_API_TOKEN=YOUR_REAL_TOKEN_HERE
```

### Option 2: MCP client config

Example MCP client configuration:

```json
{
   "mcpServers": {
      "mantis-rest": {
         "command": "node",
         "args": ["D:/php/MantisMcpServer/dist/server.bundle.js"],
         "env": {
            "MANTIS_BASE_URL": "https://eil.ewarenow.com/api/rest",
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
