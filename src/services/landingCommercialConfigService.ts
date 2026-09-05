import { supabase } from '../lib/supabase';
import { GlobalAdminService } from './globalAdminService';

export interface LandingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  currency: string;
  billingLabel: string;
  features: string[];
  buttonLabel: string;
  highlighted: boolean;
  badge: string;
  enabled: boolean;
  order: number;
}

export interface LandingContact {
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  schedule: string;
}

export interface LandingCommercialConfig {
  plans: LandingPlan[];
  contact: LandingContact;
}

export const DEFAULT_LANDING_COMMERCIAL_CONFIG: LandingCommercialConfig = {
  plans: [
    {
      id: 'starter-local',
      name: 'Starter Local',
      description: 'Para campañas a Concejo o Alcaldías pequeñas.',
      monthlyPrice: 149,
      annualMonthlyPrice: 119,
      currency: 'USD',
      billingLabel: '/mes',
      features: [
        'Hasta 10,000 votantes en CRM',
        'Copiloto IA (500 consultas/mes)',
        'Monitoreo de 20 mesas E-14',
      ],
      buttonLabel: 'Seleccionar Starter',
      highlighted: false,
      badge: '',
      enabled: true,
      order: 0,
    },
    {
      id: 'campana-ganadora-pro',
      name: 'Campaña Ganadora Pro',
      description: 'Poder total con IA ilimitada y control territorial.',
      monthlyPrice: 399,
      annualMonthlyPrice: 319,
      currency: 'USD',
      billingLabel: '/mes',
      features: [
        'Hasta 100,000 votantes en CRM',
        'Copiloto IA Ilimitado',
        'Escrutinio OCR E-14 sin límite',
        'Cuentas Claras CNE & Topes',
      ],
      buttonLabel: 'Iniciar Campaña Ganadora Pro',
      highlighted: true,
      badge: 'Más popular',
      enabled: true,
      order: 1,
    },
    {
      id: 'gobernacion-senado',
      name: 'Gobernación / Senado',
      description: 'Para campañas de cobertura departamental y nacional.',
      monthlyPrice: 899,
      annualMonthlyPrice: 719,
      currency: 'USD',
      billingLabel: '/mes',
      features: [
        'Votantes ilimitados en CRM',
        'Módulo Jurídico E-24 / E-26 Completo',
        'Soporte prioritario Día D 24/7 en vivo',
      ],
      buttonLabel: 'Contactar Asesor Especializado',
      highlighted: false,
      badge: '',
      enabled: true,
      order: 2,
    },
  ],
  contact: { email: '', phone: '', whatsapp: '', address: '', city: '', schedule: '' },
};

const LOCAL_FALLBACK_KEY = 'landing_commercial_config_v1';
export const LANDING_COMMERCIAL_CONFIG_EVENT = 'landing-commercial-config-updated';

const plansOrDefaults = (plans: unknown): LandingPlan[] =>
  Array.isArray(plans) && plans.length > 0
    ? plans as LandingPlan[]
    : DEFAULT_LANDING_COMMERCIAL_CONFIG.plans.map((plan) => ({ ...plan, features: [...plan.features] }));

const readLocalFallback = (): LandingCommercialConfig | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(LOCAL_FALLBACK_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    return {
      plans: plansOrDefaults(parsed?.plans),
      contact: { ...DEFAULT_LANDING_COMMERCIAL_CONFIG.contact, ...(parsed?.contact || {}) },
    };
  } catch { return null; }
};

const saveLocalFallback = (config: LandingCommercialConfig) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(config));
};

const notifyConfigUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LANDING_COMMERCIAL_CONFIG_EVENT));
};

const normalizeConfig = (config: any): LandingCommercialConfig => ({
  plans: plansOrDefaults(config?.plans),
  contact: { ...DEFAULT_LANDING_COMMERCIAL_CONFIG.contact, ...(config?.contact || {}) },
});

export const LandingCommercialConfigService = {
  async get(): Promise<LandingCommercialConfig> {
    try {
      const response = await fetch('/api/global-admin/landing-commercial/public', { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const remote = payload?.config;
        const hasPublishedPlans = Array.isArray(remote?.plans) && remote.plans.length > 0;
        if (payload?.persisted === true || hasPublishedPlans) {
          const normalized = normalizeConfig(remote);
          saveLocalFallback(normalized);
          return normalized;
        }
      }
    } catch { /* Continuar con compatibilidad Supabase. */ }

    try {
      const { data, error } = await supabase
        .from('landing_commercial_config')
        .select('plans,contact')
        .eq('id', 'main')
        .maybeSingle();
      if (!error && data) {
        const normalized = normalizeConfig(data);
        saveLocalFallback(normalized);
        return normalized;
      }
    } catch { /* Usar la copia local solo si no existe una publicación remota accesible. */ }

    return readLocalFallback() || DEFAULT_LANDING_COMMERCIAL_CONFIG;
  },

  async save(config: LandingCommercialConfig): Promise<void> {
    const normalized = normalizeConfig(config);
    saveLocalFallback(normalized);
    notifyConfigUpdated();

    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase.from('landing_commercial_config').upsert({
        id: 'main',
        plans: normalized.plans,
        contact: normalized.contact,
        updated_at: new Date().toISOString(),
        updated_by: authData?.user?.id || null,
      }, { onConflict: 'id' });
      
      if (!error) {
        saveLocalFallback(normalized);
        notifyConfigUpdated();
        return;
      }
    } catch {
      // Si la tabla no está creada aún en Supabase, los cambios quedan activos y guardados localmente
    }
  },
};
