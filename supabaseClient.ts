import { createClient } from '@supabase/supabase-js';

// NOTE: In a real deployment, these should be environment variables.
// For this demo structure, we access process.env.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.");
}

// Fallback to prevent crash if env vars are missing. 
// The app will load but auth/database calls will fail.
const url = supabaseUrl || 'https://wtvnyyfxjefuprcntjta.supabase.co';
const key = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm55eWZ4amVmdXByY250anRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjY5NjUsImV4cCI6MjA4MDgwMjk2NX0.O569-gYigdB84xmjOTicMU2aSghDYm2ItPjl8EPmOm8';

export const supabase = createClient(url, key);