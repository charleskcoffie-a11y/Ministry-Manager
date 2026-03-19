import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from '../config/supabaseDefaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '..');
export const expectedWesleyCount = 44;
export const wesleyJsonPath = path.resolve(repoRoot, 'public', 'wesley', 'sermons.json');
export const wesleySchemaPath = path.resolve(repoRoot, 'sql', 'john_wesley_sermons_chunks', '00_schema_min.sql');

const stripMatchingQuotes = (value) => {
  if (value.length < 2) {
    return value;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
};

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return stripMatchingQuotes(trimmed);
};

export const relativeRepoPath = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join('/');

export const loadDotEnv = () => {
  const envPath = path.resolve(repoRoot, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of raw.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = normalizeEnvValue(line.slice(separatorIndex + 1));
    process.env[key] = value;
  }
};

loadDotEnv();

const firstEnv = (...names) => {
  for (const name of names) {
    const value = normalizeEnvValue(process.env[name]);
    if (value) {
      return value;
    }
  }

  return '';
};

export const resolveSupabaseEnv = () => {
  const configuredUrl = firstEnv('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'REACT_APP_SUPABASE_URL');
  const configuredAnonKey = firstEnv(
    'SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'REACT_APP_SUPABASE_ANON_KEY'
  );
  const supabaseServiceRoleKey = firstEnv('SUPABASE_SERVICE_ROLE_KEY');
  const hasCompleteClientConfig = Boolean(configuredUrl && configuredAnonKey);
  const isPartiallyConfigured = Boolean(configuredUrl || configuredAnonKey) && !hasCompleteClientConfig;

  return {
    configuredUrl,
    configuredAnonKey,
    supabaseUrl: hasCompleteClientConfig ? configuredUrl : DEFAULT_SUPABASE_URL,
    supabaseAnonKey: hasCompleteClientConfig ? configuredAnonKey : DEFAULT_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey,
    supabaseKey: supabaseServiceRoleKey || (hasCompleteClientConfig ? configuredAnonKey : DEFAULT_SUPABASE_ANON_KEY),
    keyLabel: supabaseServiceRoleKey ? 'service-role' : 'anon',
    usingDefaultProject: !hasCompleteClientConfig,
    isPartiallyConfigured,
  };
};

export const isMissingWesleyTableError = (error) => {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message : '';

  return (
    code === 'PGRST205' ||
    /Could not find the table 'public\.john_wesley_sermons'/iu.test(message) ||
    /relation .*john_wesley_sermons.* does not exist/iu.test(message)
  );
};

export const wesleySchemaSetupHint = () => {
  const schemaPath = relativeRepoPath(wesleySchemaPath);

  return [
    'Supabase is missing public.john_wesley_sermons.',
    `Run ${schemaPath} once in Supabase SQL Editor, then rerun npm run seed:wesley.`,
  ].join(' ');
};