import { getProjectById, issuesCreate } from '../src/mantis-client.js';

async function main() {
  // Intercept the outgoing fetch call so we can dump the final body.
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    console.log('=== OUTGOING REQUEST ===');
    console.log(url);
    console.log('METHOD:', init.method);
    if (init.body) {
      try {
        console.log('BODY:', JSON.stringify(JSON.parse(init.body), null, 2));
      } catch {
        console.log('BODY (raw):', init.body);
      }
    }
    return originalFetch(url, init);
  };

  try {
    const project = await getProjectById(37);
    console.log('=== PROJECT METADATA ===');
    console.log(JSON.stringify(project, null, 2));

    const resp = await issuesCreate({
      summary: 'MCP Server — Query Feasibility Study & Implementation Proposal',
      description:
        'MCP Server feasibility study for exposing EQQLinux query endpoints.\n\nPlease link to parent ticket 8669.',
      project_id: 37,
      category: 'Tasks',
      actual_effort: 4,
      estimated_effort: 8,
      expected_complete_date: '2026-04-01 00:00:00',
    });

    console.log('=== RESPONSE ===');
    console.log(JSON.stringify(resp, null, 2));
  } catch (err) {
    console.error('=== ERROR ===');
    console.error(err);
    if (err.body) {
      console.error('Body:', err.body);
    }
  } finally {
    global.fetch = originalFetch;
  }
}

main();
