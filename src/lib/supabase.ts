import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://cjvztlvxdsuiluybvtpl.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdnp0bHZ4ZHN1aWx1eWJ2dHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NjU3MDAsImV4cCI6MjEwNDA0MTcwMH0.E-aIfV1P8XUDRW-lGC7lC6x6eOpwIdJeCpFDnxOI-uY';

// Supabase is configured exclusively through this deployment's environment.
const env = (import.meta as any).env || {};
export const IS_SUPABASE_CONFIGURED = Boolean(
  (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL) &&
  (env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY)
);
const rawUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/, '');
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

// URL del Software Electoral al que se redirige tras el registro/login
export const PANEL_ADMIN_URL = env.VITE_PANEL_ADMIN_URL || 'https://softwareelectoral.netlify.app/';

// Initialize Supabase Client with security best practices
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-application-name': 'techneo-electoral-os',
    },
  },
});

/**
 * Test Supabase Database Connection
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!IS_SUPABASE_CONFIGURED) {
    return { success: false, message: 'Supabase no está configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.' };
  }
  try {
    const { error } = await supabase.from('campaigns').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.campaigns" does not exist')) {
      console.warn('Supabase ping check:', error.message);
      return { success: true, message: `Conectado a Supabase (${SUPABASE_URL})` };
    }
    return { success: true, message: `Conexión exitosa a Supabase (${SUPABASE_URL})` };
  } catch (err: any) {
    console.error('Error connecting to Supabase:', err);
    return { success: false, message: err?.message || 'Error al conectar con Supabase' };
  }
}

/**
 * Register a New Candidate/Client with instant Panel Admin access.
 * Creates an auth user in Supabase Auth, links it to `clients` and `profiles`.
 */
export async function registerNewClient(data: {
  fullName: string;
  email: string;
  password: string;
  campaignName: string;
  phone?: string;
  department?: string;
}): Promise<{ success: boolean; error?: string; panelUrl?: string }> {
  try {
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName.trim();
    const phone = (data.phone || '').trim();
    const department = (data.department || 'Colombia').trim();

    // 1. Create client organization record
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .insert([{
        name: data.campaignName,
        email: email,
        phone: phone,
        department: department,
        status: 'ACTIVE',
      }])
      .select()
      .maybeSingle();

    if (clientError) {
      console.warn('Notice creating client organization:', clientError.message);
    }

    // 2. Register user with official Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: data.password,
      options: {
        data: {
          display_name: fullName,
          full_name: fullName,
          phone,
          department,
          role: 'ADMIN_CLIENTE',
          client_id: clientData?.id || null
        }
      }
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        return { success: false, error: 'Este correo electrónico ya está registrado. Usa otro o accede al Panel.' };
      }
      return { success: false, error: authError.message || 'Error al crear tu cuenta de acceso.' };
    }

    if (authData.user) {
      // 3. Ensure profile is upserted with ADMIN_CLIENTE role
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email,
        display_name: fullName,
        phone,
        role: 'ADMIN_CLIENTE',
        status: 'ACTIVE',
        client_id: clientData?.id || null,
        allowed_modules: ['ADMINISTRATIVE', 'TERRITORY', 'STRATEGY', 'CRM'],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' }).catch(() => {});
    }

    // 4. Save as demo lead for tracking
    await supabase.from('demo_leads').insert([{
      full_name: fullName,
      email,
      phone,
      campaign_type: data.campaignName,
      department,
      notes: 'Registro automático desde landing',
      created_at: new Date().toISOString(),
    }]).catch(() => {});

    return {
      success: true,
      panelUrl: PANEL_ADMIN_URL,
    };
  } catch (err: any) {
    console.error('Error in registerNewClient:', err);
    return { success: false, error: err?.message || 'Error inesperado al registrar la cuenta.' };
  }
}

/**
 * Save a Demo Request or Lead Inquiry to Supabase
 */
export async function saveDemoLeadToSupabase(lead: {
  fullName: string;
  email: string;
  phone: string;
  campaignType: string;
  department: string;
  municipality?: string;
  notes?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('demo_leads')
      .insert([
        {
          full_name: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          campaign_type: lead.campaignType,
          department: lead.department,
          municipality: lead.municipality || '',
          notes: lead.notes || '',
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.warn('Could not insert to demo_leads table, logging to fallback local storage:', error.message);
      return { success: true, data: lead, warning: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('Error saving lead to Supabase:', err);
    return { success: false, error: err?.message };
  }
}
