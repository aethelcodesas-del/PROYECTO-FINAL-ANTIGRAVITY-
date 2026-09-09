-- ==============================================================================
-- MIGRACIÓN: LOCK DISTRIBUIDO PARA SINCRONIZADOR ELECTORAL OFICIAL (FASE 6.1)
-- Archivo: supabase/migrations/20260909_official_electoral_sync_lock.sql
--
-- Garantiza exclusión mutua distribuida entre instancias de Cloudflare Workers
-- y ejecuciones paralelas contra la base de datos de Supabase.
-- ==============================================================================

-- 1. TABLA DE LOCKS DISTRIBUIDOS
CREATE TABLE IF NOT EXISTS public.official_sync_locks (
    lock_key VARCHAR(100) PRIMARY KEY,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.official_sync_locks IS 'Tabla de sincronización y exclusión mutua distribuida para schedulers y workers electorales';

-- Habilitar RLS
ALTER TABLE public.official_sync_locks ENABLE ROW LEVEL SECURITY;

-- Política de RLS: solo service_role y superadmin tienen acceso total
DROP POLICY IF EXISTS "Service role sync locks access" ON public.official_sync_locks;
CREATE POLICY "Service role sync locks access"
ON public.official_sync_locks
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 2. RPC: ADQUIRIR LOCK DISTRIBUIDO CON AUTO-RECUPERACIÓN POR TTL
CREATE OR REPLACE FUNCTION public.acquire_official_sync_lock(
    p_lock_key TEXT,
    p_locked_by TEXT,
    p_ttl_minutes INT DEFAULT 15,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_expires_at TIMESTAMPTZ := v_now + (p_ttl_minutes || ' minutes')::interval;
    v_current_lock RECORD;
BEGIN
    -- Verificar si existe un lock activo
    SELECT * INTO v_current_lock
    FROM public.official_sync_locks
    WHERE lock_key = p_lock_key
    FOR UPDATE;

    IF FOUND THEN
        -- Si el lock ya expiró o pertenece al mismo ejecutor, se renueva (auto-recuperación)
        IF v_current_lock.expires_at <= v_now OR v_current_lock.locked_by = p_locked_by THEN
            UPDATE public.official_sync_locks
            SET locked_at = v_now,
                expires_at = v_expires_at,
                locked_by = p_locked_by,
                metadata = p_metadata
            WHERE lock_key = p_lock_key;

            RETURN jsonb_build_object(
                'acquired', true,
                'recovered_expired', (v_current_lock.expires_at <= v_now),
                'lock_key', p_lock_key,
                'locked_by', p_locked_by,
                'expires_at', v_expires_at
            );
        ELSE
            -- Lock activo por otro ejecutor y aún no expira
            RETURN jsonb_build_object(
                'acquired', false,
                'reason', format('Lock ocupado por %s hasta %s', v_current_lock.locked_by, v_current_lock.expires_at),
                'lock_key', p_lock_key,
                'current_owner', v_current_lock.locked_by,
                'expires_at', v_current_lock.expires_at
            );
        END IF;
    ELSE
        -- No existe lock previo, se crea uno nuevo
        INSERT INTO public.official_sync_locks (lock_key, locked_at, expires_at, locked_by, metadata)
        VALUES (p_lock_key, v_now, v_expires_at, p_locked_by, p_metadata);

        RETURN jsonb_build_object(
            'acquired', true,
            'recovered_expired', false,
            'lock_key', p_lock_key,
            'locked_by', p_locked_by,
            'expires_at', v_expires_at
        );
    END IF;
END;
$$;

-- 3. RPC: LIBERAR LOCK DISTRIBUIDO
CREATE OR REPLACE FUNCTION public.release_official_sync_lock(
    p_lock_key TEXT,
    p_locked_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    -- Eliminar lock si coincide el dueño o si ya está expirado
    DELETE FROM public.official_sync_locks
    WHERE lock_key = p_lock_key
      AND (locked_by = p_locked_by OR expires_at <= NOW());

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'released', (v_deleted_count > 0),
        'lock_key', p_lock_key,
        'deleted_count', v_deleted_count
    );
END;
$$;

-- 4. RPC: CONSULTAR ESTADO DE LOCK
CREATE OR REPLACE FUNCTION public.get_official_sync_lock_status(
    p_lock_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_lock
    FROM public.official_sync_locks
    WHERE lock_key = p_lock_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_locked', false,
            'lock_key', p_lock_key
        );
    END IF;

    RETURN jsonb_build_object(
        'is_locked', (v_lock.expires_at > v_now),
        'is_expired', (v_lock.expires_at <= v_now),
        'lock_key', v_lock.lock_key,
        'locked_by', v_lock.locked_by,
        'locked_at', v_lock.locked_at,
        'expires_at', v_lock.expires_at,
        'metadata', v_lock.metadata
    );
END;
$$;
