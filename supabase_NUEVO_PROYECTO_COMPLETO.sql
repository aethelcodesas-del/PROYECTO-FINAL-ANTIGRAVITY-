-- ============================================================
-- MIGRACIÓN COMPLETA - CAMPAÑA GANADORA AI
-- Proyecto Supabase: cjvztlvxdsuiluybvtpl
-- Generado: 2026-09-03
-- INSTRUCCIONES: Ejecutar este script completo en:
--   Supabase Dashboard > SQL Editor > New Query > Pegar y ejecutar
-- ============================================================

-- ============================================================
-- PASO 1: FUNCIONES AUXILIARES DE SEGURIDAD (Anti-recursión RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND UPPER(role) IN ('SUPERADMIN', 'GLOBAL_ADMIN')
      AND UPPER(status) IN ('ACTIVE', 'ACTIVO')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE result UUID;
BEGIN
  SELECT client_id INTO result FROM profiles WHERE id = auth.uid() LIMIT 1;
  RETURN result;
END;
$$;

-- ============================================================
-- PASO 2: TABLAS PRINCIPALES
-- ============================================================

-- 1. Clientes (Tenants)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nit TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    department TEXT,
    country TEXT DEFAULT 'Colombia',
    logo_url TEXT,
    plan TEXT DEFAULT 'BASIC' CHECK (plan IN ('BASIC', 'PRO', 'ENTERPRISE')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    max_users INTEGER DEFAULT 10,
    allowed_modules TEXT[] DEFAULT '{ADMINISTRATIVE,TERRITORY,STRATEGY,CRM}',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Planes de Suscripcion
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    max_users INTEGER DEFAULT 10,
    max_campaigns INTEGER DEFAULT 1,
    allowed_module_codes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Modulos del Sistema
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Funciones de Modulos (Permisos Granulares)
CREATE TABLE IF NOT EXISTS module_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code TEXT REFERENCES modules(code) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    UNIQUE(module_code, code)
);

-- 5. Perfiles (Extension de auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    phone TEXT,
    cedula TEXT,
    role TEXT NOT NULL DEFAULT 'USUARIO' CHECK (
        UPPER(BTRIM(role)) IN (
            'SUPERADMIN', 'GLOBAL_ADMIN', 'ADMIN_CLIENTE', 'ADMINISTRADOR',
            'DIRECTOR', 'COORDINADOR', 'COORDINADOR_GENERAL',
            'DIGITADOR', 'TESTIGO', 'CONSULTOR', 'USUARIO', 'USUARIO_LIMITADO'
        )
    ),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    allowed_modules TEXT[] DEFAULT '{ADMINISTRATIVE}',
    custom_role_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Roles Personalizados por Cliente
CREATE TABLE IF NOT EXISTS custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    allowed_modules TEXT[] DEFAULT '{ADMINISTRATIVE}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Permisos Granulares de Roles Personalizados
CREATE TABLE IF NOT EXISTS custom_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL,
    function_code TEXT NOT NULL,
    actions TEXT[] DEFAULT '{VIEW}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, module_code, function_code)
);

-- 8. Permisos Directos de Usuario
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    module_code TEXT NOT NULL,
    function_code TEXT NOT NULL,
    actions TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module_code, function_code)
);

-- 9. Campanas Electorales
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    candidato_nombre TEXT,
    cargo_postulacion TEXT,
    departamento TEXT,
    municipio TEXT,
    circunscripcion TEXT,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_eleccion DATE,
    meta_votos INTEGER DEFAULT 0,
    presupuesto_total NUMERIC(15,2) DEFAULT 0,
    estado TEXT DEFAULT 'ACTIVA' CHECK (estado IN ('PLANIFICACION', 'ACTIVA', 'PAUSADA', 'FINALIZADA')),
    descripcion TEXT,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    demo_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT campaigns_demo_expiration_valid CHECK (
      (NOT is_demo AND demo_expires_at IS NULL)
      OR (is_demo AND demo_expires_at IS NOT NULL
          AND demo_expires_at > created_at
          AND demo_expires_at <= created_at + INTERVAL '5 days')
    )
);

CREATE INDEX IF NOT EXISTS campaigns_demo_expiration_idx
ON campaigns (demo_expires_at) WHERE is_demo = TRUE;

-- 10. Actividades de Campana
CREATE TABLE IF NOT EXISTS campaign_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha DATE DEFAULT CURRENT_DATE,
    responsable_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Lideres
CREATE TABLE IF NOT EXISTS leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cedula TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    comuna TEXT,
    barrio TEXT,
    puesto TEXT,
    mesa TEXT,
    meta_votos INTEGER DEFAULT 50,
    votos_comprometidos INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Votantes
CREATE TABLE IF NOT EXISTS voters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cedula TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    departamento TEXT DEFAULT 'Colombia',
    municipio TEXT,
    comuna TEXT,
    barrio TEXT,
    puesto TEXT,
    mesa TEXT,
    lider_id UUID REFERENCES leaders(id) ON DELETE SET NULL,
    intencion TEXT DEFAULT 'Voto Seguro' CHECK (intencion IN ('Voto Seguro', 'Probable', 'Indeciso', 'En Contra')),
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Presupuesto CNE
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
    categoria_cne TEXT NOT NULL,
    concepto TEXT NOT NULL,
    monto NUMERIC(15,2) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    comprobante_numero TEXT,
    soporte_url TEXT,
    beneficiario_nombre TEXT,
    beneficiario_nit TEXT,
    estado TEXT DEFAULT 'REGISTRADO' CHECK (estado IN ('REGISTRADO', 'VERIFICADO', 'OBSERVADO', 'ANULADO')),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Testigos Electorales
CREATE TABLE IF NOT EXISTS witnesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cedula TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    municipio TEXT,
    zona TEXT,
    puesto TEXT NOT NULL,
    mesa TEXT NOT NULL,
    estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'CAPACITADO', 'ACREDITADO', 'EN_MESA', 'INACTIVO')),
    documento_soporte_url TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Jurados Electorales
CREATE TABLE IF NOT EXISTS jurors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cedula TEXT NOT NULL,
    telefono TEXT,
    municipio TEXT,
    puesto TEXT NOT NULL,
    mesa TEXT NOT NULL,
    cargo TEXT DEFAULT 'VOCAL' CHECK (cargo IN ('PRESIDENTE', 'VICEPRESIDENTE', 'VOCAL', 'REMANENTE')),
    afinidad TEXT DEFAULT 'NEUTRO' CHECK (afinidad IN ('A_FAVOR', 'NEUTRO', 'EN_CONTRA', 'DESCONOCIDO')),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Encuestas
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    muestra_objetivo INTEGER DEFAULT 200,
    estado TEXT DEFAULT 'ACTIVA' CHECK (estado IN ('BORRADOR', 'ACTIVA', 'CERRADA')),
    preguntas JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Respuestas de Encuestas
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    encuestador_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    comuna TEXT,
    barrio TEXT,
    respuestas JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Registros E14
CREATE TABLE IF NOT EXISTS e14_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    puesto TEXT NOT NULL,
    mesa TEXT NOT NULL,
    votos_candidato INTEGER DEFAULT 0,
    votos_total_mesa INTEGER DEFAULT 0,
    foto_url TEXT,
    testigo_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Licencias
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVA',
    allowed_modules TEXT[] DEFAULT '{ADMINISTRATIVE,TERRITORY,STRATEGY,CRM}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Control de Uso de API
CREATE TABLE IF NOT EXISTS client_api_usage (
    client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    total_assigned INTEGER DEFAULT 0,
    total_consumed INTEGER DEFAULT 0,
    last_query_at TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Historial de Consultas
CREATE TABLE IF NOT EXISTS polling_station_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT,
    module_source TEXT,
    query_type TEXT,
    documento_consultado TEXT,
    puesto_encontrado TEXT,
    mesa_encontrada TEXT,
    municipio_encontrado TEXT,
    departamento_encontrado TEXT,
    found_count INTEGER DEFAULT 0,
    not_found_count INTEGER DEFAULT 0,
    request_id TEXT,
    results_summary JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Transacciones de API
CREATE TABLE IF NOT EXISTS api_usage_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    previous_balance INTEGER,
    new_balance INTEGER,
    query_id UUID REFERENCES polling_station_queries(id) ON DELETE SET NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Solicitudes de Acceso
CREATE TABLE IF NOT EXISTS admin_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    requested_username TEXT NOT NULL,
    reason TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Candidatos
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    identificacion TEXT,
    cargo TEXT,
    partido TEXT,
    territorio TEXT,
    perfil_profesional TEXT,
    propuesta_valor TEXT,
    foto_url TEXT,
    redes_sociales JSONB DEFAULT '{}',
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Diagnosticos AI
CREATE TABLE IF NOT EXISTS diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('360_AI', 'TERRITORIAL', 'SOCIAL_MEDIA')),
    territorio_nombre TEXT,
    metodologia TEXT,
    resultados_json JSONB DEFAULT '{}',
    conclusiones_ai TEXT,
    estado TEXT DEFAULT 'COMPLETADO',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. Sectores
CREATE TABLE IF NOT EXISTS sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_id UUID REFERENCES diagnostics(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    prioridad TEXT CHECK (prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
    meta_general TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. Variables por Sector
CREATE TABLE IF NOT EXISTS sector_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID REFERENCES sectors(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    linea_base TEXT,
    meta TEXT,
    indicador TEXT,
    fuente_dato TEXT,
    prioridad TEXT DEFAULT 'MEDIA',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. Programas de Gobierno
CREATE TABLE IF NOT EXISTS government_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    periodo TEXT,
    vision_general TEXT,
    estado TEXT DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'REVISION', 'PUBLICADO')),
    avance_porcentaje INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. Ejes Estrategicos
CREATE TABLE IF NOT EXISTS strategic_axes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES government_programs(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    objetivo_principal TEXT,
    prioridad INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 31. Propuestas
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    axis_id UUID REFERENCES strategic_axes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    problema_identificado TEXT,
    objetivo_especifico TEXT,
    indicador_cumplimiento TEXT,
    meta_cuantitativa TEXT,
    presupuesto_estimado NUMERIC(15,2) DEFAULT 0,
    prioridad TEXT DEFAULT 'ALTA',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 32. Matriz DOFA
CREATE TABLE IF NOT EXISTS swot_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    fortalezas TEXT[] DEFAULT '{}',
    oportunidades TEXT[] DEFAULT '{}',
    debilidades TEXT[] DEFAULT '{}',
    amenazas TEXT[] DEFAULT '{}',
    conclusiones_ai TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 33. Fichas Territoriales
CREATE TABLE IF NOT EXISTS territorial_fiches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    comuna_corregimiento TEXT NOT NULL,
    barrio_vereda TEXT,
    problema_principal TEXT,
    propuesta_solucion TEXT,
    impacto_esperado TEXT,
    sector_relacionado TEXT,
    lider_responsable_id UUID REFERENCES leaders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 34. Comunicaciones
CREATE TABLE IF NOT EXISTS communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL,
    tipo_contenido TEXT,
    contenido_texto TEXT,
    url_publicacion TEXT,
    metricas_json JSONB DEFAULT '{}',
    sentimiento_ai TEXT,
    fecha_publicacion TIMESTAMPTZ DEFAULT NOW()
);

-- 35. Calendario de Campana
CREATE TABLE IF NOT EXISTS campaign_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    tipo_evento TEXT CHECK (tipo_evento IN ('REUNION', 'MITIN', 'ENTREVISTA', 'VISITA_TERRITORIAL', 'OTRO')),
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ,
    ubicacion TEXT,
    latitud NUMERIC(10,8),
    longitud NUMERIC(11,8),
    responsable_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    estado TEXT DEFAULT 'PROGRAMADO' CHECK (estado IN ('PROGRAMADO', 'REALIZADO', 'CANCELADO')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PASO 3: INDICES DE RENDIMIENTO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_client ON profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_client ON campaign_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_leaders_client ON leaders(client_id);
CREATE INDEX IF NOT EXISTS idx_voters_client ON voters(client_id);
CREATE INDEX IF NOT EXISTS idx_voters_lider ON voters(lider_id);
CREATE INDEX IF NOT EXISTS idx_budget_client ON budget_items(client_id);
CREATE INDEX IF NOT EXISTS idx_witnesses_client ON witnesses(client_id);
CREATE INDEX IF NOT EXISTS idx_jurors_client ON jurors(client_id);
CREATE INDEX IF NOT EXISTS idx_surveys_client ON surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_client ON client_api_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_api_queries_client ON polling_station_queries(client_id);
CREATE INDEX IF NOT EXISTS idx_api_trans_client ON api_usage_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_admin_requests_email ON admin_access_requests(email);
CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON admin_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_candidates_client ON candidates(client_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_client ON diagnostics(client_id);
CREATE INDEX IF NOT EXISTS idx_gov_programs_client ON government_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_swot_client ON swot_matrices(client_id);
CREATE INDEX IF NOT EXISTS idx_territorial_fiches_client ON territorial_fiches(client_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_client ON communication_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_client ON campaign_calendar(client_id);

-- ============================================================
-- PASO 4: TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'USUARIO'),
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER leaders_updated_at BEFORE UPDATE ON leaders FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER voters_updated_at BEFORE UPDATE ON voters FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER budget_items_updated_at BEFORE UPDATE ON budget_items FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER witnesses_updated_at BEFORE UPDATE ON witnesses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER jurors_updated_at BEFORE UPDATE ON jurors FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER surveys_updated_at BEFORE UPDATE ON surveys FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER custom_roles_updated_at BEFORE UPDATE ON custom_roles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER gov_programs_updated_at BEFORE UPDATE ON government_programs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER admin_requests_updated_at BEFORE UPDATE ON admin_access_requests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- PASO 5: ROW LEVEL SECURITY - Activar en todas las tablas
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurors ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE e14_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_station_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE swot_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE territorial_fiches ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_calendar ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 6: POLITICAS RLS
-- ============================================================

DROP POLICY IF EXISTS modules_read ON modules;
CREATE POLICY modules_read ON modules FOR SELECT USING (true);

DROP POLICY IF EXISTS functions_read ON module_functions;
CREATE POLICY functions_read ON module_functions FOR SELECT USING (true);

DROP POLICY IF EXISTS plans_read ON plans;
CREATE POLICY plans_read ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS profile_select ON profiles;
CREATE POLICY profile_select ON profiles FOR SELECT USING (
    id = auth.uid() OR
    is_superadmin() OR
    (client_id = get_user_client_id() AND get_user_client_id() IS NOT NULL)
);

DROP POLICY IF EXISTS profile_insert ON profiles;
CREATE POLICY profile_insert ON profiles FOR INSERT WITH CHECK (
    id = auth.uid() OR is_superadmin()
);

DROP POLICY IF EXISTS profile_update ON profiles;
CREATE POLICY profile_update ON profiles FOR UPDATE
USING (id = auth.uid() OR is_superadmin())
WITH CHECK (id = auth.uid() OR is_superadmin());

DROP POLICY IF EXISTS client_isolation ON clients;
CREATE POLICY client_isolation ON clients FOR ALL USING (
    id = get_user_client_id() OR is_superadmin()
) WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS custom_roles_isolation ON custom_roles;
CREATE POLICY custom_roles_isolation ON custom_roles FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS custom_role_permissions_isolation ON custom_role_permissions;
CREATE POLICY custom_role_permissions_isolation ON custom_role_permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM custom_roles
        WHERE custom_roles.id = custom_role_permissions.role_id
        AND (custom_roles.client_id = get_user_client_id() OR is_superadmin())
    )
);

DROP POLICY IF EXISTS permission_isolation ON user_permissions;
CREATE POLICY permission_isolation ON user_permissions FOR ALL USING (
    user_id = auth.uid() OR is_superadmin() OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN_CLIENTE')
      AND user_id IN (SELECT id FROM profiles WHERE client_id = get_user_client_id())
    )
);

DROP POLICY IF EXISTS campaigns_isolation ON campaigns;
CREATE POLICY campaigns_isolation ON campaigns FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS campaign_activities_isolation ON campaign_activities;
CREATE POLICY campaign_activities_isolation ON campaign_activities FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS leaders_isolation ON leaders;
CREATE POLICY leaders_isolation ON leaders FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS voters_isolation ON voters;
CREATE POLICY voters_isolation ON voters FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS budget_isolation ON budget_items;
CREATE POLICY budget_isolation ON budget_items FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS witnesses_isolation ON witnesses;
CREATE POLICY witnesses_isolation ON witnesses FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS jurors_isolation ON jurors;
CREATE POLICY jurors_isolation ON jurors FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS surveys_isolation ON surveys;
CREATE POLICY surveys_isolation ON surveys FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS survey_responses_isolation ON survey_responses;
CREATE POLICY survey_responses_isolation ON survey_responses FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS e14_isolation ON e14_records;
CREATE POLICY e14_isolation ON e14_records FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS audit_isolation ON audit_logs;
CREATE POLICY audit_isolation ON audit_logs FOR SELECT USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS audit_insert ON audit_logs;
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS license_isolation ON licenses;
CREATE POLICY license_isolation ON licenses FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS api_usage_isolation ON client_api_usage;
CREATE POLICY api_usage_isolation ON client_api_usage FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS api_queries_isolation ON polling_station_queries;
CREATE POLICY api_queries_isolation ON polling_station_queries FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS api_transactions_isolation ON api_usage_transactions;
CREATE POLICY api_transactions_isolation ON api_usage_transactions FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS admin_requests_read ON admin_access_requests;
CREATE POLICY admin_requests_read ON admin_access_requests FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR is_superadmin()
);

DROP POLICY IF EXISTS admin_requests_insert ON admin_access_requests;
CREATE POLICY admin_requests_insert ON admin_access_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS admin_requests_update ON admin_access_requests;
CREATE POLICY admin_requests_update ON admin_access_requests FOR UPDATE USING (is_superadmin());

DROP POLICY IF EXISTS candidates_isolation ON candidates;
CREATE POLICY candidates_isolation ON candidates FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS diagnostics_isolation ON diagnostics;
CREATE POLICY diagnostics_isolation ON diagnostics FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS sectors_isolation ON sectors;
CREATE POLICY sectors_isolation ON sectors FOR ALL USING (
    EXISTS (
        SELECT 1 FROM diagnostics
        WHERE diagnostics.id = sectors.diagnostic_id
        AND (diagnostics.client_id = get_user_client_id() OR is_superadmin())
    )
);

DROP POLICY IF EXISTS variables_isolation ON sector_variables;
CREATE POLICY variables_isolation ON sector_variables FOR ALL USING (
    EXISTS (
        SELECT 1 FROM sectors
        JOIN diagnostics ON sectors.diagnostic_id = diagnostics.id
        WHERE sector_variables.sector_id = sectors.id
        AND (diagnostics.client_id = get_user_client_id() OR is_superadmin())
    )
);

DROP POLICY IF EXISTS gov_programs_isolation ON government_programs;
CREATE POLICY gov_programs_isolation ON government_programs FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS strategic_axes_isolation ON strategic_axes;
CREATE POLICY strategic_axes_isolation ON strategic_axes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM government_programs
        WHERE government_programs.id = strategic_axes.program_id
        AND (government_programs.client_id = get_user_client_id() OR is_superadmin())
    )
);

DROP POLICY IF EXISTS proposals_isolation ON proposals;
CREATE POLICY proposals_isolation ON proposals FOR ALL USING (
    EXISTS (
        SELECT 1 FROM strategic_axes
        JOIN government_programs ON strategic_axes.program_id = government_programs.id
        WHERE proposals.axis_id = strategic_axes.id
        AND (government_programs.client_id = get_user_client_id() OR is_superadmin())
    )
);

DROP POLICY IF EXISTS swot_isolation ON swot_matrices;
CREATE POLICY swot_isolation ON swot_matrices FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS territorial_fiches_isolation ON territorial_fiches;
CREATE POLICY territorial_fiches_isolation ON territorial_fiches FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS comm_logs_isolation ON communication_logs;
CREATE POLICY comm_logs_isolation ON communication_logs FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

DROP POLICY IF EXISTS calendar_isolation ON campaign_calendar;
CREATE POLICY calendar_isolation ON campaign_calendar FOR ALL USING (
    client_id = get_user_client_id() OR is_superadmin()
);

-- ============================================================
-- PASO 7: DATOS SEMILLA
-- ============================================================

INSERT INTO modules (code, name, description, icon) VALUES
('ADMINISTRATIVE', 'Gestion Administrativa', 'Control de recursos, presupuesto CNE, roles, votantes y gestion de campana', 'Shield'),
('TERRITORY', 'Gestion Territorial', 'Control geografico, georreferenciacion y censo en tiempo real', 'MapPin'),
('STRATEGY', 'Gestion Estrategica', 'Planeacion de campana, analisis FODA y metas electorales', 'Target'),
('CRM', 'CRM Electoral', 'Gestion de simpatizantes, votantes y arbol de referidos', 'Users'),
('ELECTORAL', 'Electoral (E14)', 'Digitalizacion, validacion de actas E-14 y control de escrutinio', 'Vote'),
('ANALYSIS', 'Analisis de Datos', 'Sondeos, tendencias y proyecciones estadisticas', 'BarChart3'),
('COMMUNICATIONS', 'Comunicaciones', 'Prensa, redes sociales y difusion multicanal', 'MessageSquare')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO module_functions (module_code, code, name, description) VALUES
('ADMINISTRATIVE', 'ADMIN_DASHBOARD', 'Inicio / Dashboard', 'Visualizacion de metricas generales y estadisticas'),
('ADMINISTRATIVE', 'ROLES_MANAGEMENT', 'Gestion de Roles', 'Creacion y administracion de roles y permisos'),
('ADMINISTRATIVE', 'LEADERS_VOTERS', 'Lideres y Votantes', 'Administracion de lideres territoriales y censo de votantes'),
('ADMINISTRATIVE', 'BUDGET_CNE', 'Presupuesto / CNE', 'Ingresos, gastos y reportes para CNE / Cuentas Claras'),
('ADMINISTRATIVE', 'CAMPAIGN_MANAGEMENT', 'Gestion de Campana', 'Objetivos, hitos y actividades de campana'),
('ADMINISTRATIVE', 'WITNESSES_MANAGEMENT', 'Gestion de Testigos', 'Acreditacion y monitoreo de testigos electorales'),
('ADMINISTRATIVE', 'JURORS_MANAGEMENT', 'Jurados Electorales', 'Monitoreo de jurados de votacion en mesas'),
('ADMINISTRATIVE', 'POLLS_SURVEYS', 'Encuestas y Sondeos', 'Creacion y analisis de encuestas de opinion'),
('ADMINISTRATIVE', 'SYSTEM_SETTINGS', 'Configuracion', 'Ajustes del sistema, usuarios y seguridad'),
('TERRITORY', 'TERRITORY_MAP', 'Mapa Territorial', 'Visualizacion geografica de territorios y puntos'),
('TERRITORY', 'TERRITORY_CENSUS', 'Censo Territorial', 'Registro y gestion del censo por territorios'),
('TERRITORY', 'TERRITORY_SECTORS', 'Sectores y Comunas', 'Gestion de sectores geograficos y comunas'),
('TERRITORY', 'TERRITORY_FICHES', 'Fichas Territoriales', 'Fichas detalladas por barrio/vereda'),
('STRATEGY', 'STRATEGY_SWOT', 'Matriz DOFA', 'Analisis de fortalezas, oportunidades, debilidades y amenazas'),
('STRATEGY', 'STRATEGY_PROGRAMS', 'Programa de Gobierno', 'Construccion y seguimiento del programa de gobierno'),
('STRATEGY', 'STRATEGY_DIAGNOSTICS', 'Diagnosticos AI', 'Diagnosticos territoriales y analisis con IA'),
('STRATEGY', 'STRATEGY_CALENDAR', 'Agenda Electoral', 'Calendario y planificacion de eventos de campana'),
('CRM', 'CRM_CONTACTS', 'Contactos', 'Base de datos de contactos y simpatizantes'),
('CRM', 'CRM_LEADERS', 'Red de Lideres', 'Gestion y seguimiento de lideres comunitarios'),
('CRM', 'CRM_COMMUNICATIONS', 'Comunicaciones', 'Envio y seguimiento de comunicaciones masivas'),
('CRM', 'CRM_REPORTS', 'Reportes CRM', 'Analisis y reportes de gestion de contactos'),
('ELECTORAL', 'ELECTORAL_E14', 'Actas E14', 'Registro y validacion de actas electorales'),
('ELECTORAL', 'ELECTORAL_WITNESSES', 'Testigos', 'Coordinacion de testigos electorales en mesas'),
('ELECTORAL', 'ELECTORAL_JURORS', 'Jurados', 'Seguimiento e identificacion de jurados de votacion'),
('ELECTORAL', 'ELECTORAL_RESULTS', 'Resultados', 'Seguimiento de resultados en tiempo real')
ON CONFLICT (module_code, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO plans (name, code, description, max_users, max_campaigns, allowed_module_codes) VALUES
('Plan Basico', 'BASIC', 'Acceso a modulos fundamentales para campana pequena', 5, 1, '{ADMINISTRATIVE,CRM}'),
('Plan Profesional', 'PRO', 'Acceso completo para campanas medianas con analisis territorial', 20, 3, '{ADMINISTRATIVE,TERRITORY,STRATEGY,CRM,ANALYSIS}'),
('Plan Empresa', 'ENTERPRISE', 'Acceso total a todos los modulos para grandes organizaciones', 100, 10, '{ADMINISTRATIVE,TERRITORY,STRATEGY,CRM,ELECTORAL,ANALYSIS,COMMUNICATIONS}')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================================
-- PASO 8: TABLA DE CONFIGURACION COMERCIAL DE LA LANDING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.landing_commercial_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  CHECK (jsonb_typeof(plans) = 'array'),
  CHECK (jsonb_typeof(contact) = 'object')
);

ALTER TABLE public.landing_commercial_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS landing_commercial_public_read ON public.landing_commercial_config;
CREATE POLICY landing_commercial_public_read ON public.landing_commercial_config
FOR SELECT USING (true);

DROP POLICY IF EXISTS landing_commercial_global_admin_write ON public.landing_commercial_config;
CREATE POLICY landing_commercial_global_admin_write ON public.landing_commercial_config
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(p.role) IN ('SUPERADMIN', 'GLOBAL_ADMIN')
      AND UPPER(p.status) IN ('ACTIVE', 'ACTIVO')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(p.role) IN ('SUPERADMIN', 'GLOBAL_ADMIN')
      AND UPPER(p.status) IN ('ACTIVE', 'ACTIVO')
  )
);

-- ============================================================
-- FIN DEL SCRIPT DE MIGRACION
-- Proyecto: cjvztlvxdsuiluybvtpl
-- Tablas: 36 | Politicas RLS: 40 | Triggers: 15 | Indices: 22
-- ============================================================
