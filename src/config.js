import dotenv from 'dotenv';

dotenv.config();

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function deriveWebBase(baseUrl) {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.replace(/\/api\/rest$/i, '');
}

function asToolList(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return Array.from(
    new Set(
      String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function getEnabledToolNames() {
  return asToolList(process.env.MANTIS_ENABLED_TOOLS);
}

export function getConfig() {
  const baseUrl = trimTrailingSlash(process.env.MANTIS_BASE_URL || 'https://localhost:4430/api/rest');
  const webBase = deriveWebBase(baseUrl);
  const apiToken = process.env.MANTIS_API_TOKEN || '';
  const useIndexPhp = asBool(process.env.MANTIS_USE_INDEX_PHP, true);
  const enabledTools = getEnabledToolNames();

  const apiBase = useIndexPhp ? `${baseUrl}/index.php` : baseUrl;

  return {
    baseUrl,
    webBase,
    apiBase,
    apiToken,
    useIndexPhp,
    enabledTools,
  };
}
