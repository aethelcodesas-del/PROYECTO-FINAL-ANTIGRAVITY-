-- =====================================================================
-- CORRECCIÓN DE RAÍZ: Agregar columnas faltantes a la tabla profiles
-- El código del servidor espera campaign_id y otras columnas que no
-- estaban en el schema inicial del nuevo proyecto.
-- =====================================================================

-- 1. Agregar campaign_id a profiles (referencia a campaigns)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- 2. Índice para búsquedas rápidas por campaña
CREATE INDEX IF NOT EXISTS idx_profiles_campaign ON public.profiles(campaign_id);

-- 3. Agregar created_by a campaigns (quién creó la campaña)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Agregar name como alias de nombre (compatibilidad con código legacy)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS name TEXT GENERATED ALWAYS AS (nombre) STORED;

-- 5. Verificar resultado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
