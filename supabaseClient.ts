import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from './config/supabaseDefaults.js';

const legacyEnv = typeof process !== 'undefined' ? process.env : undefined;
const configuredUrl = import.meta.env.VITE_SUPABASE_URL || legacyEnv?.REACT_APP_SUPABASE_URL || legacyEnv?.NEXT_PUBLIC_SUPABASE_URL;
const configuredAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || legacyEnv?.REACT_APP_SUPABASE_ANON_KEY || legacyEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasCompleteClientConfig = Boolean(configuredUrl && configuredAnonKey);
const isPartiallyConfigured = Boolean(configuredUrl || configuredAnonKey) && !hasCompleteClientConfig;

if (isPartiallyConfigured) {
  console.warn(
    'Supabase env vars are only partially configured. Falling back to the shared default project until both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
} else if (!hasCompleteClientConfig) {
  console.warn(
    'Supabase credentials missing. Falling back to the shared default project. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to point at your own database.'
  );
}

const url = hasCompleteClientConfig ? configuredUrl : DEFAULT_SUPABASE_URL;
const key = hasCompleteClientConfig ? configuredAnonKey : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);