import { getConfig } from './config.js';

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, String(item));
      }
    } else {
      query.append(key, String(value));
    }
  }

  const q = query.toString();
  return q ? `?${q}` : '';
}

async function parseResponse(response, url) {
  const text = await response.text();

  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const error = new Error(`Mantis API request failed (${response.status} ${response.statusText})`);
    error.status = response.status;
    error.body = parsed;
    error.url = url;
    throw error;
  }

  return {
    status: response.status,
    data: parsed,
    url,
  };
}

async function request(path, { method = 'GET', query, body } = {}) {
  const cfg = getConfig();
  if (!cfg.apiToken) {
    throw new Error('Missing MANTIS_API_TOKEN in environment.');
  }

  const url = `${cfg.apiBase}${path}${buildQuery(query)}`;

  const headers = {
    Authorization: cfg.apiToken,
    Accept: 'application/json',
  };

  const init = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  return parseResponse(response, url);
}

async function requestWeb(pluginPage, { method = 'GET', query, body } = {}) {
  const cfg = getConfig();
  if (!cfg.apiToken) {
    throw new Error('Missing MANTIS_API_TOKEN in environment.');
  }

  const queryString = buildQuery(query);
  const url = `${cfg.webBase}/plugin.php?page=${encodeURIComponent(pluginPage)}${queryString ? `&${queryString.slice(1)}` : ''}`;
  const headers = {
    Authorization: cfg.apiToken,
    Accept: 'application/json',
  };
  const init = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  return parseResponse(response, url);
}

export async function usersMe() {
  return request('/users/me');
}

export async function projectsMe() {
  return request('/projects');
}

export async function healthCheck() {
  const cfg = getConfig();
  const startedAt = new Date().toISOString();
  const me = await usersMe();

  return {
    status: me.status,
    data: {
      ok: true,
      started_at: startedAt,
      base_url: cfg.baseUrl,
      api_base: cfg.apiBase,
      use_index_php: cfg.useIndexPhp,
      authenticated_user: me.data,
    },
    url: me.url,
  };
}

export async function issuesGet(id) {
  return request('/issues', { query: { id } });
}

export async function issuesSearch(filters = {}) {
  return request('/issues', { query: filters });
}

export async function issuesAssignedToMe({
  page,
  page_size,
  project_id,
  status_id,
  summary,
  additional_filters,
} = {}) {
  const me = await usersMe();
  const userId = me?.data?.id ?? me?.data?.user?.id;

  if (!userId) {
    throw new Error('Unable to resolve current user id from /users/me response.');
  }

  const filters = {
    handler_id: userId,
    page,
    page_size,
    project_id,
    status_id,
    summary,
    ...(additional_filters || {}),
  };

  const issues = await issuesSearch(filters);

  return {
    ...issues,
    data: {
      ...(issues?.data && typeof issues.data === 'object' ? issues.data : { issues: issues?.data }),
      context: {
        handler_id: userId,
      },
    },
  };
}

export async function issuesTimeLogAdd({ action, record_id, issue_id, duration, note_text, is_private, additional_fields }) {
  return requestWeb('TimeTracking/timesheet_crud_api', {
    query: {
      action,
      record_id,
      issue_id,
      duration,
      note_text,
      ...(additional_fields || {}),
    },
  });
}

export async function timesheetReportQuery({
  format,
  page,
  page_size,
  time_filter_from,
  time_filter_to,
  time_filter_user_id,
  time_filter_category,
  time_filter_overtime,
  project_id,
} = {}) {
  return requestWeb('TimeTracking/timesheet_report_api', {
    query: {
      format,
      report_page: page,
      report_page_size: page_size,
      time_filter_from,
      time_filter_to,
      time_filter_user_id,
      time_filter_category,
      time_filter_overtime,
      project_id,
    },
  });
}

export async function issuesCreate({ summary, description, project_id, additional_fields }) {
  const body = {
    summary,
    description,
    project: { id: project_id },
    ...(additional_fields || {}),
  };

  return request('/issues', { method: 'POST', body });
}

export async function issuesUpdate({ id, summary, description, additional_fields }) {
  const body = {
    ...(summary !== undefined ? { summary } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(additional_fields || {}),
  };

  return request(`/issues/${id}`, { method: 'PATCH', body });
}

export async function issuesDelete(id) {
  return request('/issues', { method: 'DELETE', query: { id } });
}

export async function configGet({ option, project_id, user_id }) {
  return request('/config', {
    query: {
      option,
      project_id,
      user_id,
    },
  });
}

export async function langGet(strings) {
  return request('/lang', {
    query: {
      string: strings,
    },
  });
}
