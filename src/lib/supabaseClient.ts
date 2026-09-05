/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://cjvztlvxdsuiluybvtpl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdnp0bHZ4ZHN1aWx1eWJ2dHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjU3MDAsImV4cCI6MjEwNDA0MTcwMH0.E-aIfV1P8XUDRW-lGC7lC6x6eOpwIdJeCpFDnxOI-uY';

export const isSupabaseConfigured = Boolean(
  (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL) &&
  (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY)
);
const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'x-application-name': 'techneo-electoral-os'
    }
  }
});
