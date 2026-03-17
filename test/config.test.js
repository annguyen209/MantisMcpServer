import test from 'node:test';
import assert from 'node:assert/strict';

import { getConfig, getEnabledToolNames } from '../src/config.js';

test('getEnabledToolNames parses comma-separated list uniquely', () => {
  process.env.MANTIS_ENABLED_TOOLS = 'mantis_users_me, mantis_issues_get, mantis_users_me';

  const tools = getEnabledToolNames();
  assert.deepEqual(tools, ['mantis_users_me', 'mantis_issues_get']);
});

test('getEnabledToolNames returns null when unset/blank', () => {
  process.env.MANTIS_ENABLED_TOOLS = '';
  assert.equal(getEnabledToolNames(), null);
});

test('getConfig includes enabledTools list', () => {
  process.env.MANTIS_BASE_URL = 'https://mantis.example.com/api/rest';
  process.env.MANTIS_USE_INDEX_PHP = 'true';
  process.env.MANTIS_API_TOKEN = 'token';
  process.env.MANTIS_ENABLED_TOOLS = 'mantis_users_me,mantis_issues_get';

  const cfg = getConfig();
  assert.deepEqual(cfg.enabledTools, ['mantis_users_me', 'mantis_issues_get']);
  assert.equal(cfg.apiBase, 'https://mantis.example.com/api/rest/index.php');
}
);

test('getConfig supports localhost Mantis settings', () => {
  process.env.MANTIS_BASE_URL = 'https://localhost:4430/api/rest';
  process.env.MANTIS_USE_INDEX_PHP = 'true';
  process.env.MANTIS_API_TOKEN = 'zCL5hxcj7adus7ezc8IGzN1-dYThOPIZ';

  const cfg = getConfig();
  assert.equal(cfg.baseUrl, 'https://localhost:4430/api/rest');
  assert.equal(cfg.webBase, 'https://localhost:4430');
  assert.equal(cfg.apiBase, 'https://localhost:4430/api/rest/index.php');
});