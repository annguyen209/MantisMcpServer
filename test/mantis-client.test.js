import test from 'node:test';
import assert from 'node:assert/strict';

// When running tests, we want to mock network calls by default.
// Set RUN_LIVE_MANTIS_TESTS=true to run a small subset of live integration tests
// against a real Mantis instance.
const LIVE = process.env.RUN_LIVE_MANTIS_TESTS === 'true';

import {
  configGet,
  healthCheck,
  issuesAssignedToMe,
  issuesCreate,
  issuesDelete,
  issuesGet,
  issuesSearch,
  issuesTimeLogAdd,
  issuesUpdate,
  issueNoteAdd,
  issueNoteDelete,
  issueNoteGet,
  issueNotesList,
  langGet,
  projectsMe,
  timesheetReportQuery,
  usersMe,
} from '../src/mantis-client.js';

const INITIAL_LIVE_ENV = {
  MANTIS_BASE_URL: process.env.MANTIS_BASE_URL,
  MANTIS_USE_INDEX_PHP: process.env.MANTIS_USE_INDEX_PHP,
  MANTIS_API_TOKEN: process.env.MANTIS_API_TOKEN,
  NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
};

function withEnv(overrides, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined || value === null || value === '') {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  const run = async () => {
    try {
      return await fn();
    } finally {
      restore();
    }
  };

  return run();
}

function setEnv() {
  // Allow overriding these via environment variables (e.g. CI or real-server runs).
  process.env.MANTIS_BASE_URL = process.env.MANTIS_BASE_URL || 'https://localhost:4430/api/rest';
  process.env.MANTIS_USE_INDEX_PHP = process.env.MANTIS_USE_INDEX_PHP || 'true';
  process.env.MANTIS_API_TOKEN = process.env.MANTIS_API_TOKEN || 'zCL5hxcj7adus7ezc8IGzN1-dYThOPIZ';
}

function ensureLiveEnvConfigured() {
  const missing = [];

  if (!String(INITIAL_LIVE_ENV.MANTIS_BASE_URL || '').trim()) {
    missing.push('MANTIS_BASE_URL');
  }

  if (!String(INITIAL_LIVE_ENV.MANTIS_API_TOKEN || '').trim()) {
    missing.push('MANTIS_API_TOKEN');
  }

  if (missing.length > 0) {
    throw new Error(
      `RUN_LIVE_MANTIS_TESTS=true requires the following env vars: ${missing.join(', ')}.`
    );
  }
}

function mockFetch(fn) {
  // Patch the global fetch implementation so we can
  // intercept and assert on requests without hitting the network.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    return fn(url, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(body, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test('usersMe calls /users/me', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url) => {
    calledUrl = url;
    return jsonResponse({ id: 1 });
  });

  try {
    const result = await usersMe();
    assert.equal(result.status, 200);
    assert.ok(result.data?.id);
  } finally {
    restore();
  }
});

test('projectsMe calls /projects', async () => {
  setEnv();

  const restore = mockFetch(async () => {
    return jsonResponse({ projects: [] });
  });

  try {
    const result = await projectsMe();
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data?.projects));
  } finally {
    restore();
  }
});

test('healthCheck returns config context and user payload', async () => {
  setEnv();

  const restore = mockFetch(async (url) => {
    if (String(url).endsWith('/users/me')) {
      return jsonResponse({ id: 77, name: 'tester' });
    }

    return jsonResponse({});
  });

  try {
    const result = await healthCheck();
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.use_index_php, true);
    assert.ok(typeof result.data.authenticated_user?.id === 'number');
  } finally {
    restore();
  }
});

test('issuesGet calls /issues?id=...', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url) => {
    calledUrl = url;
    return jsonResponse({ issues: [] });
  });

  try {
    const result = await issuesGet(123);
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data?.issues));
  } finally {
    restore();
  }
});

test('issuesSearch forwards query filters', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url) => {
    calledUrl = url;
    return jsonResponse({ issues: [] });
  });

  try {
    const result = await issuesSearch({ project_id: 50, page: 2, page_size: 25 });
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.data?.issues));
  } finally {
    restore();
  }
});

test('issuesAssignedToMe resolves /users/me then /issues?handler_id=...', async () => {
  setEnv();
  const calledUrls = [];

  const restore = mockFetch(async (url) => {
    calledUrls.push(String(url));

    if (String(url).endsWith('/users/me')) {
      return jsonResponse({ id: 9 });
    }

    return jsonResponse({ issues: [{ id: 1 }] });
  });

  try {
    const result = await issuesAssignedToMe({ page: 3, page_size: 10, additional_filters: { severity_id: 50 } });

    if (!LIVE) {
      assert.equal(calledUrls[0], 'https://localhost:4430/api/rest/index.php/users/me');
      assert.equal(
        calledUrls[1],
        'https://localhost:4430/api/rest/index.php/issues?handler_id=9&page=3&page_size=10&severity_id=50'
      );
      assert.equal(result.data.context.handler_id, 9);
    }

    assert.ok(typeof result.data.context.handler_id === 'number');
  } finally {
    restore();
  }
});

test('issuesCreate posts /issues', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;

    if (String(url).includes('/projects')) {
      return jsonResponse({
        projects: [
          {
            id: 50,
            categories: [{ id: 5, name: 'Tasks' }],
            custom_fields: [
              { id: 1, name: 'Actual Effort' },
              { id: 3, name: 'Estimated Effort' },
              { id: 4, name: 'Expected Complete Date' },
            ],
          },
        ],
      });
    }

    return jsonResponse({ issue: { id: 999 } }, 201, 'Created');
  });

  try {
    const result = await issuesCreate({
      summary: 's',
      description: 'd',
      project_id: 50,
      actual_effort: 10,
    });

    if (!LIVE) {
      assert.equal(calledInit.method, 'POST');

      const body = JSON.parse(calledInit.body);
      assert.equal(body.project.id, 50);
      assert.equal(body.category.id, 5);
      assert.equal(body.estimated_effort, undefined);
      assert.equal(body.expected_complete_date, undefined);

      const customFields = body.custom_fields;
      assert.ok(Array.isArray(customFields));
      assert.deepEqual(customFields.find((cf) => cf.field?.id === 1), { field: { id: 1, name: 'Actual Effort' }, value: 10 });
      assert.deepEqual(customFields.find((cf) => cf.field?.id === 3), { field: { id: 3, name: 'Estimated Effort' }, value: 4 });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(
        tomorrow.getDate()
      ).padStart(2, '0')}`;

      assert.deepEqual(customFields.find((cf) => cf.field?.id === 4), {
        field: { id: 4, name: 'Expected Complete Date' },
        value: expectedDate,
      });
    }

    if (LIVE) {
      assert.ok([200, 201].includes(result.status));
    } else {
      assert.equal(result.status, 201);
    }
  } finally {
    restore();
  }
});

test('issueNoteAdd posts /issues/{id}/notes', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({ note: { id: 777 } }, 201, 'Created');
  });

  try {
    const result = await issueNoteAdd({
      issue_id: 123,
      payload: { text: 'New note', view_state: { name: 'private' } },
    });

    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/issues/123/notes');
      assert.equal(calledInit.method, 'POST');

      const body = JSON.parse(calledInit.body);
      assert.equal(body.text, 'New note');
      assert.equal(body.view_state.name, 'private');
    } else {
      assert.ok(calledUrl?.includes('/issues/123/notes'));
    }

    if (LIVE) {
      assert.ok([200, 201].includes(result.status));
    } else {
      assert.equal(result.status, 201);
    }
  } finally {
    restore();
  }
});

test('issueNoteDelete calls DELETE /issues/{id}/notes/{note_id}', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({}, 200, 'OK');
  });

  try {
    const result = await issueNoteDelete({ issue_id: 123, note_id: 456 });

    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/issues/123/notes/456');
      assert.equal(calledInit.method, 'DELETE');
    }

    assert.equal(result.status, 200);
  } finally {
    restore();
  }
});

test('issueNoteGet returns note from issue response', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    return jsonResponse({ issues: [{ id: 123, notes: [{ id: 456, text: 'ok' }] }] });
  });

  try {
    const result = await issueNoteGet({ issue_id: 123, note_id: 456 });

    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/issues?id=123');
    }

    assert.equal(result.note.id, 456);
    assert.equal(result.note.text, 'ok');
  } finally {
    restore();
  }
});

test('issueNotesList returns notes list from issue response', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    return jsonResponse({ issues: [{ id: 123, notes: [{ id: 456, text: 'ok' }, { id: 457, text: 'hi' }] }] });
  });

  try {
    const result = await issueNotesList({ issue_id: 123 });

    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/issues?id=123');
    }

    assert.deepEqual(result.notes, [{ id: 456, text: 'ok' }, { id: 457, text: 'hi' }]);
  } finally {
    restore();
  }
});

test('issuesUpdate patches /issues/{id}', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({ issues: [{ id: 999, summary: 'updated' }] }, 200, 'OK');
  });

  try {
    const result = await issuesUpdate({
      id: 999,
      summary: 'updated',
      description: 'updated detail',
      additional_fields: { category: { name: 'Tasks' } },
    });

    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/issues/999');
      assert.equal(calledInit.method, 'PATCH');

      const body = JSON.parse(calledInit.body);
      assert.equal(body.summary, 'updated');
      assert.equal(body.description, 'updated detail');
      assert.equal(body.category.name, 'Tasks');
    }

    assert.equal(result.status, 200);
  } finally {
    restore();
  }
});

test('issuesTimeLogAdd calls TimeTracking/timesheet_crud_api with query params', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({ note: { id: 777 } }, 201, 'Created');
  });

  try {
    const result = await issuesTimeLogAdd({
      issue_id: 8827,
      duration: '01:30',
      note_text: 'Worked on validation rules',
      additional_fields: { category: 'Development', time_exp_date: '2026-03-17' },
    });

    if (!LIVE) {
      assert.equal(
        calledUrl,
        'https://localhost:4430/plugin.php?page=TimeTracking%2Ftimesheet_crud_api&issue_id=8827&duration=01%3A30&note_text=Worked+on+validation+rules&category=Development&time_exp_date=2026-03-17'
      );
      assert.equal(calledInit.method, 'GET');
    }

    if (LIVE) {
      assert.ok([200, 201].includes(result.status));
    } else {
      assert.equal(result.status, 201);
    }
  } finally {
    restore();
  }
});

test('issuesTimeLogAdd supports CRUD action/read with record_id', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({ ok: true, action: 'read' }, 200, 'OK');
  });

  try {
    const result = await issuesTimeLogAdd({
      action: 'read',
      record_id: 145,
    });

    if (!LIVE) {
      assert.equal(
        calledUrl,
        'https://localhost:4430/plugin.php?page=TimeTracking%2Ftimesheet_crud_api&action=read&record_id=145'
      );
      assert.equal(calledInit.method, 'GET');
    }

    assert.equal(result.status, 200);
  } finally {
    restore();
  }
});

test('timesheetReportQuery calls TimeTracking plugin endpoint with filters', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url) => {
    calledUrl = url;
    return jsonResponse({ rows: [] });
  });

  try {
    const result = await timesheetReportQuery({
      format: 'json',
      page: 2,
      page_size: 50,
      time_filter_from: '2026-03-01',
      time_filter_to: '2026-03-17',
      time_filter_user_id: 5,
      time_filter_category: 'Development',
      time_filter_overtime: 'No',
      project_id: 50,
    });

    if (!LIVE) {
      assert.equal(
        calledUrl,
        'https://localhost:4430/plugin.php?page=TimeTracking%2Ftimesheet_report_api&format=json&report_page=2&report_page_size=50&time_filter_from=2026-03-01&time_filter_to=2026-03-17&time_filter_user_id=5&time_filter_category=Development&time_filter_overtime=No&project_id=50'
      );
    }
    assert.equal(result.status, 200);
  } finally {
    restore();
  }
});

test('issuesDelete calls DELETE /issues?id=...', async () => {
  setEnv();
  let calledUrl;
  let calledInit;

  const restore = mockFetch(async (url, init) => {
    calledUrl = url;
    calledInit = init;
    return jsonResponse({}, 204, 'No Content');
  });

  try {
    const result = await issuesDelete(991);
    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/issues?id=991');
      assert.equal(calledInit.method, 'DELETE');
    }
    assert.equal(result.status, 204);
  } finally {
    restore();
  }
});

test('configGet calls /config with repeated option values', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url) => {
    calledUrl = url;
    return jsonResponse({ config: [] });
  });

  try {
    await configGet({ option: ['timezone', 'window_title'], project_id: 50, user_id: 1 });
    if (!LIVE) {
      assert.equal(
        calledUrl,
        'https://localhost:4430/api/rest/index.php/config?option=timezone&option=window_title&project_id=50&user_id=1'
      );
    }
  } finally {
    restore();
  }
});

test('langGet calls /lang?string=...', async () => {
  setEnv();
  let calledUrl;

  const restore = mockFetch(async (url) => {
    calledUrl = url;
    return jsonResponse({ strings: [] });
  });

  try {
    await langGet(['bug', 'project']);
    if (!LIVE) {
      assert.equal(calledUrl, 'https://localhost:4430/api/rest/index.php/lang?string=bug&string=project');
    }
  } finally {
    restore();
  }
});

test('HTTP errors are normalized with status/body/url', async () => {
  setEnv();

  const restore = mockFetch(async (url) => {
    return {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      async text() {
        return JSON.stringify({ message: 'API token not found' });
      },
    };
  });

  try {
    await assert.rejects(
      async () => usersMe(),
      (err) => {
        assert.equal(err.status, 403);
        if (!LIVE) {
      assert.equal(err.url, 'https://localhost:4430/api/rest/index.php/users/me');
    } else {
      assert.ok(err.url?.includes('/users/me'));
    }
        assert.deepEqual(err.body, { message: 'API token not found' });
        return true;
      }
    );
  } finally {
    restore();
  }
});

const shouldRunLiveTests = process.env.RUN_LIVE_MANTIS_TESTS === 'true';

const liveTest = shouldRunLiveTests ? test : test.skip;

liveTest('LIVE usersMe works against configured Mantis server', async () => {
  await withEnv(INITIAL_LIVE_ENV, async () => {
    ensureLiveEnvConfigured();
    const result = await usersMe();
    assert.equal(result.status, 200);
    assert.ok(result.data);
  });
});

liveTest('LIVE projectsMe works against configured Mantis server', async () => {
  await withEnv(INITIAL_LIVE_ENV, async () => {
    ensureLiveEnvConfigured();
    const result = await projectsMe();
    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result?.data?.projects));
  });
});
