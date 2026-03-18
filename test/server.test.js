import test from 'node:test';
import assert from 'node:assert/strict';

import { handleToolCall, tools } from '../src/server.js';

function parseTextResult(result) {
  assert.equal(result.content[0].type, 'text');
  return JSON.parse(result.content[0].text);
}

function makeRequest(name, args = {}) {
  return {
    params: {
      name,
      arguments: args,
    },
  };
}

function createDeps() {
  return {
    usersMe: async () => ({ endpoint: 'users/me' }),
    projectsMe: async () => ({ endpoint: 'projects' }),
    healthCheck: async () => ({ endpoint: 'health' }),
    issuesGet: async (id) => ({ endpoint: 'issues_get', id }),
    issuesSearch: async (filters) => ({ endpoint: 'issues_search', filters }),
    issuesAssignedToMe: async (filters) => ({ endpoint: 'issues_assigned_to_me', filters }),
    issuesTimeLogAdd: async (payload) => ({ endpoint: 'issues_timesheet_add', payload }),
    timesheetReportQuery: async (payload) => ({ endpoint: 'timesheet_report_query', payload }),
    issuesCreate: async (payload) => ({ endpoint: 'issues_create', payload }),
    issuesUpdate: async (payload) => ({ endpoint: 'issues_update', payload }),
    issuesDelete: async (id) => ({ endpoint: 'issues_delete', id }),
    issueNoteAdd: async (payload) => ({ endpoint: 'issue_note_add', payload }),
    issueNoteDelete: async (payload) => ({ endpoint: 'issue_note_delete', payload }),
    issueNoteGet: async (payload) => ({ endpoint: 'issue_note_get', payload }),
    issueNotesList: async (payload) => ({ endpoint: 'issue_notes_list', payload }),
    configGet: async (payload) => ({ endpoint: 'config_get', payload }),
    langGet: async (strings) => ({ endpoint: 'lang_get', strings }),
  };
}

test('tools list includes every MCP endpoint', () => {
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'mantis_config_get',
    'mantis_health_check',
    'mantis_issue_note_add',
    'mantis_issue_note_delete',
    'mantis_issue_note_get',
    'mantis_issue_notes_list',
    'mantis_issues_assigned_to_me',
    'mantis_issues_create',
    'mantis_issues_delete',
    'mantis_issues_get',
    'mantis_issues_search',
    'mantis_issues_timesheet_crud',
    'mantis_issues_update',
    'mantis_lang_get',
    'mantis_projects_me',
    'mantis_timesheet_report_query',
    'mantis_users_me',
  ]);
});

test('mantis_users_me routes correctly', async () => {
  const result = await handleToolCall(makeRequest('mantis_users_me'), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'users/me' });
});

test('mantis_projects_me routes correctly', async () => {
  const result = await handleToolCall(makeRequest('mantis_projects_me'), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'projects' });
});

test('mantis_projects_me ignores MCP runtime context object and uses default deps shape detection', async () => {
  const deps = createDeps();
  const result = await handleToolCall(makeRequest('mantis_projects_me'), { requestId: 'runtime-context' }, deps);
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'projects' });
});

test('mantis_health_check routes correctly', async () => {
  const result = await handleToolCall(makeRequest('mantis_health_check'), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'health' });
});

test('mantis_issues_get routes id argument', async () => {
  const result = await handleToolCall(makeRequest('mantis_issues_get', { id: 123 }), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'issues_get', id: 123 });
});

test('mantis_issues_search routes filters argument', async () => {
  const filters = { project_id: 7, page: 2 };
  const result = await handleToolCall(makeRequest('mantis_issues_search', { filters }), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'issues_search', filters });
});

test('mantis_issues_assigned_to_me routes optional args', async () => {
  const args = {
    page: 1,
    page_size: 25,
    project_id: 50,
    status_id: 50,
    summary: 'invoice',
    additional_filters: { severity_id: 40 },
  };
  const result = await handleToolCall(makeRequest('mantis_issues_assigned_to_me', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issues_assigned_to_me',
    filters: args,
  });
});

test('mantis_issues_timesheet_crud routes payload arguments', async () => {
  const args = {
    action: 'update',
    record_id: 145,
    issue_id: 8827,
    duration: '00:45',
    note_text: 'timesheet entry',
    is_private: false,
    additional_fields: { reporter: { name: 'anson.nguyen' } },
  };

  const result = await handleToolCall(makeRequest('mantis_issues_timesheet_crud', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issues_timesheet_add',
    payload: args,
  });
});

test('mantis_issues_timesheet_crud normalizes top-level category and shift_time aliases', async () => {
  const args = {
    action: 'create',
    issue_id: 8827,
    duration: '00:30',
    category: 'development',
    shift_time: '8am - 5pm',
  };

  const result = await handleToolCall(makeRequest('mantis_issues_timesheet_crud', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issues_timesheet_add',
    payload: {
      action: 'create',
      issue_id: 8827,
      duration: '00:30',
      additional_fields: {
        category: 'Development',
        shift_time: '8AM - 5PM',
      },
    },
  });
});

test('mantis_issues_timesheet_crud rejects invalid category values', async () => {
  const result = await handleToolCall(
    makeRequest('mantis_issues_timesheet_crud', {
      action: 'create',
      issue_id: 8827,
      duration: '00:30',
      category: 'RandomCategory',
    }),
    createDeps()
  );

  assert.equal(result.isError, true);
  const payload = parseTextResult(result);
  assert.match(payload.error, /Invalid category/);
});

test('mantis_issues_timesheet_crud routes overtime/category payload arguments', async () => {
  const args = {
    action: 'create',
    issue_id: 8827,
    duration: '00:30',
    category: 'Development',
    shift_time: '6PM - 10PM',
    is_overtime: true,
  };

  const result = await handleToolCall(makeRequest('mantis_issues_timesheet_crud', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issues_timesheet_add',
    payload: {
      action: 'create',
      issue_id: 8827,
      duration: '00:30',
      additional_fields: {
        category: 'Development',
        shift_time: '6PM - 10PM',
        is_overtime: true,
      },
    },
  });
});

test('mantis_timesheet_report_query routes filter arguments', async () => {
  const args = {
    format: 'json',
    page: 2,
    page_size: 50,
    time_filter_from: '2026-03-01',
    time_filter_to: '2026-03-17',
    time_filter_user_id: 5,
    time_filter_category: 'Development',
    time_filter_overtime: 'No',
    project_id: 50,
  };

  const result = await handleToolCall(makeRequest('mantis_timesheet_report_query', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'timesheet_report_query',
    payload: args,
  });
});

test('mantis_issues_create routes payload arguments', async () => {
  const args = {
    summary: 'Bug',
    description: 'Detail',
    project_id: 50,
    additional_fields: { category: { name: 'Bugs' } },
  };

  const result = await handleToolCall(makeRequest('mantis_issues_create', args), createDeps());
  assert.equal(result.isError, false);
  const expectedArgs = {
    ...args,
    additional_fields: {
      category: { name: 'Bugs' },
      estimated_effort: 4,
      expected_complete_date: (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
          tomorrow.getDate()
        ).padStart(2, '0')}`;
      })(),
      custom_fields: [
        { id: 3, value: 4 },
        { id: 4, value: (() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
            tomorrow.getDate()
          ).padStart(2, '0')}`;
        })() },
      ],
    },
  };

  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issues_create',
    payload: expectedArgs,
  });
});

test('mantis_issue_notes_list routes args', async () => {
  const args = { issue_id: 123 };

  const result = await handleToolCall(makeRequest('mantis_issue_notes_list', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issue_notes_list',
    payload: args,
  });
});

test('mantis_issue_note_add routes payload arguments', async () => {
  const args = {
    issue_id: 123,
    payload: { text: 'A note', view_state: { name: 'private' } },
  };

  const result = await handleToolCall(makeRequest('mantis_issue_note_add', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issue_note_add',
    payload: args,
  });
});

test('mantis_issue_note_delete routes args', async () => {
  const args = { issue_id: 123, note_id: 456 };

  const result = await handleToolCall(makeRequest('mantis_issue_note_delete', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issue_note_delete',
    payload: args,
  });
});

test('mantis_issue_note_get routes args', async () => {
  const args = { issue_id: 123, note_id: 456 };

  const result = await handleToolCall(makeRequest('mantis_issue_note_get', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issue_note_get',
    payload: args,
  });
});

test('mantis_issues_update routes payload arguments', async () => {
  const args = {
    id: 8835,
    summary: 'Updated bug',
    description: 'Updated detail',
    additional_fields: { category: { name: 'Tasks' } },
  };

  const result = await handleToolCall(makeRequest('mantis_issues_update', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'issues_update',
    payload: args,
  });
});

test('mantis_issues_delete routes id argument', async () => {
  const result = await handleToolCall(makeRequest('mantis_issues_delete', { id: 321 }), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), { endpoint: 'issues_delete', id: 321 });
});

test('mantis_config_get routes options', async () => {
  const args = { option: ['foo', 'bar'], project_id: 50, user_id: 1 };
  const result = await handleToolCall(makeRequest('mantis_config_get', args), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'config_get',
    payload: args,
  });
});

test('mantis_lang_get routes strings argument', async () => {
  const result = await handleToolCall(makeRequest('mantis_lang_get', { strings: ['bug', 'project'] }), createDeps());
  assert.equal(result.isError, false);
  assert.deepEqual(parseTextResult(result), {
    endpoint: 'lang_get',
    strings: ['bug', 'project'],
  });
});

test('unknown tool returns MCP error payload', async () => {
  const result = await handleToolCall(makeRequest('mantis_unknown_tool'), createDeps());
  assert.equal(result.isError, true);

  const payload = parseTextResult(result);
  assert.match(payload.error, /Unknown tool/);
});

test('tool runtime exceptions are normalized to error payload', async () => {
  const deps = createDeps();
  deps.usersMe = async () => {
    const err = new Error('boom');
    err.status = 500;
    err.url = 'http://example';
    err.body = { message: 'broken' };
    throw err;
  };

  const result = await handleToolCall(makeRequest('mantis_users_me'), deps);
  assert.equal(result.isError, true);

  const payload = parseTextResult(result);
  assert.equal(payload.error, 'boom');
  assert.equal(payload.status, 500);
  assert.equal(payload.url, 'http://example');
  assert.deepEqual(payload.response, { message: 'broken' });
});
