/// <reference types="vite/client" />
export {
  supabase,
  IS_SUPABASE_CONFIGURED as isSupabaseConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  testSupabaseConnection,
  signInUser,
  signOutUser,
  getCurrentUserProfile,
  registerNewClient,
  saveDemoLeadToSupabase,
} from './supabase';
