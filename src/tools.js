import { getEnabledToolNames } from './config.js';
import {
  configGet,
  issuesAssignedToMe,
  issuesTimeLogAdd,
  healthCheck,
  issuesCreate,
  issuesDelete,
  issuesGet,
  issuesSearch,
  issuesUpdate,
  issueNoteAdd,
  issueNoteDelete,
  issueNoteGet,
  issueNotesList,
  langGet,
  projectsMe,
  projectCategories,
  projectCustomFields,
  timesheetReportQuery,
  usersMe,
} from './mantis-client.js';

function toTextResult(payload, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

function filterToolsByEnabledList(allTools, enabledToolNames) {
  if (!Array.isArray(enabledToolNames) || enabledToolNames.length === 0) {
    return allTools;
  }

  const enabledSet = new Set(enabledToolNames);
  return allTools.filter((tool) => enabledSet.has(tool.name));
}

const TIMESHEET_SHIFT_OPTIONS = [
  '6AM - 8AM',
  '8AM - 5PM',
  '6PM - 10PM',
  '10PM - 6AM',
];

const TIMESHEET_CATEGORY_OPTIONS = [
  'Architect-Design',
  'Communication',
  'Development',
  'General',
  'PTO',
  'Public Holiday',
  'Testing',
];

function normalizeEnumValue(rawValue, allowedValues, fieldName) {
  if (rawValue === undefined || rawValue === null) {
    return rawValue;
  }

  const normalizedRaw = String(rawValue).trim().toLowerCase();
  const match = allowedValues.find((value) => value.toLowerCase() === normalizedRaw);

  if (!match) {
    throw new Error(`Invalid ${fieldName}. Allowed values: ${allowedValues.join(', ')}`);
  }

  return match;
}

function normalizeTimesheetArgs(args = {}) {
  const additionalFields = {
    ...(args.additional_fields || {}),
  };

  if (args.category !== undefined && additionalFields.category === undefined) {
    additionalFields.category = args.category;
  }

  if (args.shift_time !== undefined && additionalFields.shift_time === undefined) {
    additionalFields.shift_time = args.shift_time;
  }

  if (args.time_exp_date !== undefined && additionalFields.time_exp_date === undefined) {
    additionalFields.time_exp_date = args.time_exp_date;
  }

  if (args.is_overtime !== undefined && additionalFields.is_overtime === undefined) {
    additionalFields.is_overtime = args.is_overtime;
  }

  if (additionalFields.category !== undefined) {
    additionalFields.category = normalizeEnumValue(
      additionalFields.category,
      TIMESHEET_CATEGORY_OPTIONS,
      'category'
    );
  }

  if (additionalFields.shift_time !== undefined) {
    additionalFields.shift_time = normalizeEnumValue(
      additionalFields.shift_time,
      TIMESHEET_SHIFT_OPTIONS,
      'shift_time'
    );
  }

  return {
    ...args,
    additional_fields: additionalFields,
  };
}

function getTomorrowDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// NOTE: We no longer rely on hard-coded custom field ID mappings.
// The underlying client will fetch project metadata and resolve IDs dynamically.

function normalizeIssueCreateArgs(args = {}) {
  const normalized = {
    ...args,
  };

  // Defaults when not provided
  if (normalized.category === undefined) {
    normalized.category = 'Tasks';
  }

  if (normalized.actual_effort === undefined) {
    normalized.actual_effort = 4;
  }

  if (normalized.estimated_effort === undefined) {
    normalized.estimated_effort = 4;
  }

  if (normalized.expected_complete_date === undefined) {
    normalized.expected_complete_date = getTomorrowDateString();
  }

  // Normalize numeric inputs: allow numbers or numeric strings.
  const normalizeNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return value;
  };

  normalized.actual_effort = normalizeNumber(normalized.actual_effort);
  normalized.estimated_effort = normalizeNumber(normalized.estimated_effort);

  if (typeof normalized.category === 'string') {
    normalized.category = { name: normalized.category };
  }

  return normalized;
}

const TIMESHEET_ADD_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      description: 'create|read|update|delete (default create)',
      enum: ['create', 'read', 'update', 'delete'],
    },
    record_id: { type: 'integer', description: 'Required for read/update/delete actions.' },
    issue_id: { type: 'integer', description: 'Issue id' },
    duration: { type: 'string', description: 'Duration in HH:MM format, e.g. 01:30 (required for create, optional for update).' },
    note_text: { type: 'string', description: 'Optional info text stored with the time record (or updated for update).' },
    category: {
      type: 'string',
      description: 'Timesheet category. Alias for additional_fields.category.',
      enum: TIMESHEET_CATEGORY_OPTIONS,
    },
    shift_time: {
      type: 'string',
      description: 'Timesheet shift. Alias for additional_fields.shift_time.',
      enum: TIMESHEET_SHIFT_OPTIONS,
    },
    time_exp_date: {
      type: 'string',
      description: 'Expenditure date in YYYY-MM-DD. Alias for additional_fields.time_exp_date.',
    },
    is_overtime: {
      type: 'boolean',
      description: 'Overtime flag. Alias for additional_fields.is_overtime.',
    },
    is_private: { type: 'boolean', description: 'Deprecated for plugin API path (ignored).' },
    additional_fields: {
      type: 'object',
      description: 'Optional plugin API fields, e.g. time_exp_date (YYYY-MM-DD), category, is_overtime, shift_time, bugnote_id. category and shift_time are validated against known UI dropdown values.',
    },
  },
  additionalProperties: false,
};

export const allTools = [
  {
    name: 'mantis_users_me',
    description: 'Get currently authenticated Mantis user details.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mantis_projects_me',
    description: 'List projects accessible to the currently authenticated user.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mantis_project_categories',
    description: 'List categories for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'integer', description: 'Project id' },
      },
      required: ['project_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_project_custom_fields',
    description: 'List custom fields for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'integer', description: 'Project id' },
      },
      required: ['project_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_health_check',
    description: 'Validate API connectivity/auth and return effective MCP/Mantis configuration context.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'mantis_issues_get',
    description: 'Get issue details by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Issue id' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issues_search',
    description: 'Search/list issues using REST query filters (project_id, page, page_size, status_id, handler_id, reporter_id, summary, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          description: 'Query parameters forwarded to GET /issues',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issues_assigned_to_me',
    description: 'List issues assigned to the currently authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        page_size: { type: 'integer' },
        project_id: { type: 'integer' },
        status_id: { type: 'integer' },
        summary: { type: 'string' },
        additional_filters: {
          type: 'object',
          description: 'Optional extra GET /issues filters to merge in.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issues_timesheet_crud',
    description: 'CRUD timesheet records via TimeTracking plugin API (writes plugin time tracking table).',
    inputSchema: TIMESHEET_ADD_INPUT_SCHEMA,
  },
  {
    name: 'mantis_timesheet_report_query',
    description: 'Query the TimeTracking plugin timesheet report endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', description: 'Response format: json or csv.' },
        page: { type: 'integer', description: '1-based page number.' },
        page_size: { type: 'integer', description: 'Rows per page.' },
        time_filter_from: {
          type: 'string',
          description: 'Start date as unix timestamp or YYYY-MM-DD.',
        },
        time_filter_to: {
          type: 'string',
          description: 'End date as unix timestamp or YYYY-MM-DD.',
        },
        time_filter_user_id: { type: 'integer', description: 'Filter by user id.' },
        time_filter_category: { type: 'string', description: 'Filter by category.' },
        time_filter_overtime: { type: 'string', description: 'Yes, No, or All.' },
        project_id: { type: 'integer', description: 'Optional project id filter.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issues_create',
    description: 'Create a new issue/ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        description: { type: 'string' },
        project_id: { type: 'integer' },
        category: {
          type: 'string',
          description: 'Issue category (e.g. Tasks, Bugs, New Features, Performance, Warranty). Will be resolved to a category ID for Mantis.',
        },
        actual_effort: {
          type: ['number', 'string'],
          description: 'Actual effort spent. Accepts numbers or numeric strings; will be mapped to the corresponding custom field ID.',
        },
        estimated_effort: {
          type: ['number', 'string'],
          description: 'Estimated effort. Accepts numbers or numeric strings; will be mapped to the corresponding custom field ID.',
        },
        expected_complete_date: {
          type: 'string',
          description: 'Expected completion date (YYYY-MM-DD). Will be mapped to the corresponding custom field ID.',
        },
      },
      required: [
        'summary',
        'description',
        'project_id',
        'category',
        'actual_effort',
        'estimated_effort',
        'expected_complete_date',
      ],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issue_note_add',
    description: 'Add a note to an issue.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'integer' },
        payload: {
          type: 'object',
          description: 'Note payload to forward to Mantis REST API. Example: { text: "note", view_state: { name: "private" } }',
        },
      },
      required: ['issue_id', 'payload'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issue_note_delete',
    description: 'Delete a note from an issue.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'integer' },
        note_id: { type: 'integer' },
      },
      required: ['issue_id', 'note_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issue_notes_list',
    description: 'List notes for an issue.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'integer' },
      },
      required: ['issue_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issue_note_get',
    description: 'Get a single note from an issue.',
    inputSchema: {
      type: 'object',
      properties: {
        issue_id: { type: 'integer' },
        note_id: { type: 'integer' },
      },
      required: ['issue_id', 'note_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issues_update',
    description: 'Update an existing issue/ticket by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        summary: { type: 'string' },
        description: { type: 'string' },
        additional_fields: {
          type: 'object',
          description: 'Optional extra Mantis issue fields to patch, e.g. category, priority, handler, custom_fields.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_issues_delete',
    description: 'Delete issue by id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Issue id' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_config_get',
    description: 'Get Mantis configuration options in user/project context.',
    inputSchema: {
      type: 'object',
      properties: {
        option: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of config option names',
        },
        project_id: { type: 'integer' },
        user_id: { type: 'integer' },
      },
      required: ['option'],
      additionalProperties: false,
    },
  },
  {
    name: 'mantis_lang_get',
    description: 'Get localized strings by key names (without $s_ prefix).',
    inputSchema: {
      type: 'object',
      properties: {
        strings: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['strings'],
      additionalProperties: false,
    },
  },
];

const enabledToolNames = getEnabledToolNames();
export const tools = filterToolsByEnabledList(allTools, enabledToolNames);
const allToolNameSet = new Set(allTools.map((tool) => tool.name));
const enabledToolNameSet = new Set(tools.map((tool) => tool.name));

const defaultDeps = {
  configGet,
  issuesAssignedToMe,
  issuesTimeLogAdd,
  healthCheck,
  issuesCreate,
  issuesDelete,
  issuesGet,
  issuesSearch,
  issuesUpdate,
  issueNoteAdd,
  issueNoteDelete,
  issueNoteGet,
  issueNotesList,
  langGet,
  projectCategories,
  projectCustomFields,
  timesheetReportQuery,
  usersMe,
};

function isDependencyBag(value) {
  return Boolean(
    value
      && typeof value === 'object'
      && (
        typeof value.usersMe === 'function'
        || typeof value.projectsMe === 'function'
        || typeof value.healthCheck === 'function'
      )
  );
}

export async function handleToolCall(request, contextOrDeps, injectedDeps) {
  const deps = injectedDeps || (isDependencyBag(contextOrDeps) ? contextOrDeps : defaultDeps);
  const { name, arguments: args = {} } = request.params;

  if (allToolNameSet.has(name) && !enabledToolNameSet.has(name)) {
    return toTextResult({ error: `Tool is disabled: ${name}` }, true);
  }

  try {
    switch (name) {
      case 'mantis_users_me':
        return toTextResult(await deps.usersMe());

          case 'mantis_projects_me':
        return toTextResult(await deps.projectsMe());

      case 'mantis_project_categories':
        return toTextResult(await deps.projectCategories(args.project_id));

      case 'mantis_project_custom_fields':
        return toTextResult(await deps.projectCustomFields(args.project_id));

      case 'mantis_health_check':
        return toTextResult(await deps.healthCheck());

      case 'mantis_issues_get':
        return toTextResult(await deps.issuesGet(args.id));

      case 'mantis_issues_search':
        return toTextResult(await deps.issuesSearch(args.filters || {}));

      case 'mantis_issues_assigned_to_me':
        return toTextResult(
          await deps.issuesAssignedToMe({
            page: args.page,
            page_size: args.page_size,
            project_id: args.project_id,
            status_id: args.status_id,
            summary: args.summary,
            additional_filters: args.additional_filters,
          })
        );

      case 'mantis_issues_timesheet_crud':
        {
          const normalized = normalizeTimesheetArgs(args);
          return toTextResult(
            await deps.issuesTimeLogAdd({
              action: normalized.action,
              record_id: normalized.record_id,
              issue_id: normalized.issue_id,
              duration: normalized.duration,
              note_text: normalized.note_text,
              is_private: normalized.is_private,
              additional_fields: normalized.additional_fields,
            })
          );
        }

      case 'mantis_timesheet_report_query':
        return toTextResult(
          await deps.timesheetReportQuery({
            format: args.format,
            page: args.page,
            page_size: args.page_size,
            time_filter_from: args.time_filter_from,
            time_filter_to: args.time_filter_to,
            time_filter_user_id: args.time_filter_user_id,
            time_filter_category: args.time_filter_category,
            time_filter_overtime: args.time_filter_overtime,
            project_id: args.project_id,
          })
        );

      case 'mantis_issues_create': {
        const normalized = normalizeIssueCreateArgs(args);
        return toTextResult(
          await deps.issuesCreate({
            summary: normalized.summary,
            description: normalized.description,
            project_id: normalized.project_id,
            category: normalized.category,
            actual_effort: normalized.actual_effort,
            estimated_effort: normalized.estimated_effort,
            expected_complete_date: normalized.expected_complete_date,
          })
        );
      }

      case 'mantis_issue_note_add':
        return toTextResult(
          await deps.issueNoteAdd({
            issue_id: args.issue_id,
            payload: args.payload,
          })
        );

      case 'mantis_issue_note_delete':
        return toTextResult(
          await deps.issueNoteDelete({
            issue_id: args.issue_id,
            note_id: args.note_id,
          })
        );

      case 'mantis_issue_notes_list':
        return toTextResult(
          await deps.issueNotesList({
            issue_id: args.issue_id,
          })
        );

      case 'mantis_issue_note_get':
        return toTextResult(
          await deps.issueNoteGet({
            issue_id: args.issue_id,
            note_id: args.note_id,
          })
        );

      case 'mantis_issues_update':
        return toTextResult(
          await deps.issuesUpdate({
            id: args.id,
            summary: args.summary,
            description: args.description,
            additional_fields: args.additional_fields,
          })
        );

      case 'mantis_issues_delete':
        return toTextResult(await deps.issuesDelete(args.id));

      case 'mantis_config_get':
        return toTextResult(
          await deps.configGet({
            option: args.option,
            project_id: args.project_id,
            user_id: args.user_id,
          })
        );

      case 'mantis_lang_get':
        return toTextResult(await deps.langGet(args.strings));

      default:
        return toTextResult({ error: `Unknown tool: ${name}` }, true);
    }
  } catch (error) {
    return toTextResult(
      {
        error: error.message,
        status: error.status,
        url: error.url,
        response: error.body,
      },
      true
    );
  }
}
