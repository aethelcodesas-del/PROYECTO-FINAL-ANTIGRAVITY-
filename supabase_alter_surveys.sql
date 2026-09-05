-- Ejecuta este script en el SQL Editor de Supabase para agregar las columnas necesarias
-- a la tabla "surveys" y hacerla compatible con la interfaz "SurveyStudy".

ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS methodology TEXT,
ADD COLUMN IF NOT EXISTS completed_sample INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_of_error NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence_level NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pollsters_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS questions_count INTEGER DEFAULT 0;

-- Modificar el check de estado para soportar los nuevos estados
ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_estado_check;
ALTER TABLE public.surveys ADD CONSTRAINT surveys_estado_check CHECK (
  estado IN ('En Campo', 'Borrador', 'Finalizado', 'En Auditoría', 'ACTIVA', 'BORRADOR', 'CERRADA')
);
