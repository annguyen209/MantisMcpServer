# Using the Mantis MCP server effectively in VS Code

This guide shows how to connect `MantisMcpServer` to VS Code and how to get the best results when using it through chat.

## What this server is good at

This MCP server helps VS Code chat interact with MantisBT for tasks like:

- checking the current authenticated user
- listing accessible projects
- finding issues
- creating, updating, and deleting issues
- creating, reading, updating, and deleting TimeTracking timesheet entries
- querying the TimeTracking report endpoint
- reading config values and language strings

In short: it gives the assistant structured tools instead of forcing it to guess URLs or manually shape API requests.

## Before you start

Make sure you have:

- Node.js installed
- this project built successfully with `npm install` and `npm run build`
- a valid Mantis API token
- the correct Mantis REST base URL

For IIS-based Mantis installations without URL rewrite, keep:

- `MANTIS_USE_INDEX_PHP=true`

## Recommended VS Code MCP configuration

### Preferred setup: use the npm package with `npx`

If this server is published as an npm package, this is the best default setup for VS Code:

```json
{
  "mcpServers": {
    "mantis-rest": {
      "command": "npx",
      "args": ["-y", "@annguyen209/mantis-mcp-server"],
      "env": {
        "MANTIS_BASE_URL": "https://mantis.example.com/api/rest",
        "MANTIS_USE_INDEX_PHP": "true",
        "MANTIS_API_TOKEN": "YOUR_REAL_TOKEN_HERE"
      }
    }
  }
}
```

VS Code still uses `stdio` transport in this setup. The npm package simply gives VS Code an easy command to launch.

### Local development setup

Point VS Code to the bundled server:

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

### Why the bundled file is preferred

Use `dist/server.bundle.js` in VS Code unless you are actively editing the server.

Benefits:

- fewer moving parts
- easier startup
- predictable runtime behavior
- matches the tested build output

Use `src/server.js` only if you are developing the MCP server itself and want changes reflected directly.

## How to ask for things effectively

The assistant works best when your request is:

- specific
- task-oriented
- tied to Mantis concepts like project, issue id, timesheet date, category, or shift

### Good requests

- “Show issues assigned to me in project 50.”
- “Create a bug in project 50 with summary ‘Invoice export fails’ and category Tasks.”
- “Update issue 8835 summary to ‘Salesforce sync retry bug’.”
- “Add a 2 hour overtime timesheet entry to issue 8823 for 2026-03-17 in category Development and shift 6PM - 10PM.”
- “Read timesheet record 12543.”
- “Query the timesheet report for user 5 from 2026-03-01 to 2026-03-17.”

### Less effective requests

- “Do something in Mantis.”
- “Fix my ticket.”
- “Add time.”

Those are vague, so the assistant may need follow-up details.

## Best prompting patterns

### 1. Include identifiers when you know them

If you know the exact issue id, project id, or timesheet record id, include it.

Examples:

- `issue 8835`
- `project 50`
- `record_id 12543`

That reduces guesswork and avoids accidental edits.

### 2. Provide field values in Mantis terms

For timesheet and issue updates, say exactly what should be changed.

Good:

- “Update issue 8835 description to ‘Retry logic fails after token expiry’.”
- “Create timesheet entry with duration 01:30 and note text ‘Reviewed validation changes’.”

### 3. Use valid timesheet enum values

For best results, use the known values already validated by the MCP server.

#### Valid `category` values

- `Architect-Design`
- `Communication`
- `Development`
- `General`
- `PTO`
- `Public Holiday`
- `Testing`

#### Valid `shift_time` values

- `6AM - 8AM`
- `8AM - 5PM`
- `6PM - 10PM`
- `10PM - 6AM`

The server normalizes case, but using the exact values keeps things crisp and drama-free.

## Common workflows in VS Code

### Find issues assigned to you

Ask:

- “List issues assigned to me.”
- “List issues assigned to me in project 50.”
- “List issues assigned to me with summary containing invoice.”

### Create an issue

Ask:

- “Create an issue in project 50 with summary ‘Invoice export fails’ and description ‘Export to Excel throws an error’. Set category to Tasks.”

If your Mantis project requires custom fields, include them in the request.

Example:

- “Create an issue in project 50 with summary ‘Sync bug’, description ‘Fails on retry’, category Tasks, Actual Effort 0, Estimated Effort 2, Expected Complete Date 2026-03-20.”

### Update an issue

Ask:

- “Update issue 8835 summary to ‘Salesforce sync retry bug’.”
- “Update issue 8835 description to ‘Retry fails when token refresh returns 401’.”
- “Update issue 8835 and set category to Tasks.”

### Delete an issue

Ask:

- “Delete issue 8835.”

Use this carefully. The MCP tool does what it says on the tin.

### Add or manage timesheets

Ask:

- “Create a timesheet entry for issue 8823 with duration 04:00, date 2026-03-17, category Development, shift 6PM - 10PM, overtime true.”
- “Read timesheet record 12543.”
- “Update timesheet record 12543 duration to 02:30.”
- “Delete timesheet record 12543.”

### Query timesheet reports

Ask:

- “Query the timesheet report from 2026-03-01 to 2026-03-17 for project 50.”
- “Get the timesheet report for user 5 in category Development.”

## Tips for reliable results

### Be explicit about create vs update vs delete

Say the intended operation clearly:

- create
- read
- update
- delete

This matters especially for timesheet entries.

### Prefer dates in `YYYY-MM-DD`

This format is easy to parse and avoids locale confusion.

### Give duration in `HH:MM`

Use values like:

- `00:30`
- `01:15`
- `08:00`

### Mention required Mantis fields up front

Some projects require fields like:

- category
- custom fields
- estimated effort
- expected complete date

If you already know they are required, include them in the initial request.

## Troubleshooting

### The assistant says auth failed

Check:

- `MANTIS_API_TOKEN` is set correctly
- the token is still valid in Mantis
- the server is using the correct Mantis instance

Also remember:

- the token is sent as a raw `Authorization` header value
- it is **not** sent as `Bearer <token>`

### The assistant can’t find the right endpoint on IIS

Check:

- `MANTIS_BASE_URL`
- `MANTIS_USE_INDEX_PHP`

For many IIS setups, this is correct:

- `MANTIS_BASE_URL=https://your-host/api/rest`
- `MANTIS_USE_INDEX_PHP=true`

That produces REST calls like:

- `.../api/rest/index.php/issues`

### The server starts but tools do not appear

Check:

- VS Code MCP config points to the correct file
- `node` is available in PATH
- the bundle exists at `dist/server.bundle.js`
- you restarted or reloaded VS Code after updating MCP settings

If tools are intentionally restricted through `MANTIS_ENABLED_TOOLS`, only the listed tools will appear.

### Timesheet values are rejected

Use one of the supported values for:

- `category`
- `shift_time`

See the enum lists above.

## Recommended day-to-day usage pattern

A reliable workflow in VS Code is:

1. verify auth/connectivity
2. identify the project or issue
3. perform the change
4. read the updated item back if needed
5. only then move on to the next action

Example sequence:

- “Check Mantis connectivity.”
- “List projects accessible to me.”
- “Get issue 8835.”
- “Update issue 8835 summary to ‘Salesforce sync retry bug’.”
- “Get issue 8835 again.”

That pattern keeps edits auditable and reduces accidental mistakes.

## Security reminders

- Never commit a real API token.
- Prefer environment variables over hardcoding secrets.
- Keep `.env` local.
- Use `.env.example` only for placeholders.

## Summary

To use this MCP server effectively in VS Code:

- connect the bundled server in your MCP settings
- provide clear Mantis-specific requests
- include ids and required fields when possible
- use valid timesheet enums and `YYYY-MM-DD` dates
- verify results after write operations

That gives the assistant the best chance of being helpful instead of merely enthusiastic.