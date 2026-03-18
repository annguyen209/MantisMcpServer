import { getConfig } from './config.js';

// Mapping of common client field keys to the user-visible custom field names stored in Mantis.
// This is used to map `actual_effort` / `estimated_effort` / `expected_complete_date` etc.
// to the concrete custom field name returned in the project metadata.
const CUSTOM_FIELD_NAME_BY_KEY = {
  actual_effort: 'Actual Effort',
  estimated_effort: 'Estimated Effort',
  expected_complete_date: 'Expected Complete Date',
};

const projectCache = new Map();

export async function getProjectById(project_id) {
  if (!project_id) return null;
  if (projectCache.has(project_id)) {
    return projectCache.get(project_id);
  }

  const resp = await request('/projects', { query: { id: project_id } });
  const projects = Array.isArray(resp.data)
    ? resp.data
    : Array.isArray(resp.data?.projects)
    ? resp.data.projects
    : [];

  const project = projects.find((p) => p.id === project_id) ?? projects[0] ?? null;
  projectCache.set(project_id, project);
  return project;
}

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

export async function projectCategories(project_id) {
  // Project metadata includes categories; the API does not provide a dedicated endpoint.
  const project = await getProjectById(project_id);
  return {
    status: project ? 200 : 404,
    data: project ? project.categories || [] : null,
    url: `${project_id ? `/projects?id=${project_id}` : '/projects'}`,
  };
}

export async function projectCustomFields(project_id) {
  // Project metadata includes custom fields; the API does not provide a dedicated endpoint.
  const project = await getProjectById(project_id);
  return {
    status: project ? 200 : 404,
    data: project ? project.custom_fields || [] : null,
    url: `${project_id ? `/projects?id=${project_id}` : '/projects'}`,
  };
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

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function issuesCreate({
  summary,
  description,
  project_id,
  additional_fields,
  category,
  actual_effort,
  estimated_effort,
  expected_complete_date,
}) {
  // Capture the raw args so we can map known field keys to custom_fields
  const args = {
    summary,
    description,
    project_id,
    additional_fields,
    category,
    actual_effort,
    estimated_effort,
    expected_complete_date,
  };

  const fields = {
    ...(additional_fields || {}),
  };

  // Defaults
  if (category === undefined && fields.category === undefined) {
    category = 'Tasks';
  }
  if (estimated_effort === undefined && fields.estimated_effort === undefined) {
    estimated_effort = 4;
  }
  if (expected_complete_date === undefined && fields.expected_complete_date === undefined) {
    expected_complete_date = getTomorrowDateString();
  }

  if (category !== undefined && fields.category === undefined) {
    fields.category = typeof category === 'string' ? { name: category } : category;
  }

  // Resolve category names to IDs using project metadata when available.
  const project = await getProjectById(project_id);
  if (project && project.categories && typeof fields.category === 'object' && fields.category?.name) {
    const match = project.categories.find(
      (c) => String(c.name).toLowerCase() === String(fields.category.name).toLowerCase()
    );
    if (match) {
      fields.category = { id: match.id };
    } else {
      throw new Error(
        `Unknown category "${fields.category.name}" for project ${project_id}. Available: ${
          project.categories.map((c) => c.name).join(', ') || '<none>'
        }`
      );
    }
  }

  if (actual_effort !== undefined && fields.actual_effort === undefined) {
    fields.actual_effort = actual_effort;
  }

  if (estimated_effort !== undefined && fields.estimated_effort === undefined) {
    fields.estimated_effort = estimated_effort;
  }

  if (expected_complete_date !== undefined && fields.expected_complete_date === undefined) {
    fields.expected_complete_date = expected_complete_date;
  }

  // Map known custom field names to the custom_fields array (Mantis REST requires IDs)
  // We keep an array during processing so we can push mapped values, but remove it
  // later when it's empty to reduce request noise.
  fields.custom_fields = Array.isArray(fields.custom_fields) ? [...fields.custom_fields] : [];

  // Use project metadata to map custom field names to IDs when possible.
  const customFieldNameToId = new Map();
  if (project && Array.isArray(project.custom_fields)) {
    for (const cf of project.custom_fields) {
      if (cf?.name && cf?.id !== undefined) {
        customFieldNameToId.set(String(cf.name).toLowerCase(), cf.id);
      }
    }
  }

  for (const fieldName of Object.keys(CUSTOM_FIELD_NAME_BY_KEY)) {
    const value =
      (fieldName in args ? args[fieldName] : undefined) ??
      fields[fieldName];

    if (value === undefined) continue;

    const expectedFieldName = CUSTOM_FIELD_NAME_BY_KEY[fieldName];
    const fieldId =
      customFieldNameToId.get(fieldName) ||
      customFieldNameToId.get(String(expectedFieldName).toLowerCase());

    if (!fieldId) {
      throw new Error(
        `Missing custom field "${expectedFieldName}" (mapped to key ${fieldName}) in project ${project_id} metadata.`
      );
    }

    const exists = fields.custom_fields.some((cf) => cf.id === fieldId);
    if (!exists) {
      fields.custom_fields.push({
        field: { id: fieldId, name: expectedFieldName },
        value,
      });
    }
  }

  // Ensure we only send these mapped values via custom_fields (Mantis REST expects
  // custom field values to be provided as custom_fields, not as top-level keys).
  delete fields.actual_effort;
  delete fields.estimated_effort;
  delete fields.expected_complete_date;

  // Avoid sending an empty custom_fields array if we didn't add any mappings.
  if (Array.isArray(fields.custom_fields) && fields.custom_fields.length === 0) {
    delete fields.custom_fields;
  }

  const body = {
    summary,
    description,
    project: { id: project_id },
    ...fields,
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

export async function issueNoteAdd({ issue_id, payload }) {
  return request(`/issues/${issue_id}/notes`, { method: 'POST', body: payload });
}

export async function issueNoteDelete({ issue_id, note_id }) {
  return request(`/issues/${issue_id}/notes/${note_id}`, { method: 'DELETE' });
}

export async function issueNoteGet({ issue_id, note_id }) {
  const issue = await issuesGet(issue_id);
  const note = issue?.data?.issues?.[0]?.notes?.find((n) => n.id === note_id);
  return {
    ...issue,
    note,
  };
}

export async function issueNotesList({ issue_id }) {
  const issue = await issuesGet(issue_id);
  const notes = issue?.data?.issues?.[0]?.notes || [];
  return { ...issue, notes };
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
