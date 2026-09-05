import { createClient } from '@supabase/supabase-js';
import crypto from "node:crypto";

const normalizeSupabaseUrl = (url: string | undefined): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch (e) {
    return url.split('/rest/v1')[0].split('/auth/v1')[0].replace(/\/$/, '');
  }
};

const normalizeSecret = (value: string | undefined): string =>
  String(value || '').trim().replace(/^['"]|['"]$/g, '');

const supabaseUrl = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServerKey = normalizeSecret(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
export const supabaseAdmin = supabaseUrl && supabaseServerKey
  ? createClient(supabaseUrl, supabaseServerKey)
  : null;

// In-memory data store for fallback
const inMemoryTables: Record<string, any[]> = {
  candidates: [],
  swot_matrices: []
};

// Memory cache store to optimize read queries
interface CacheEntry {
  data: any;
  timestamp: number;
}
const dbCache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 6000; // Cache cacheable reads for 6 seconds to optimize polling calls

const invalidateCache = (table: string, clientId?: string | null) => {
  const cacheKey = `${table}:${clientId || 'global'}`;
  delete dbCache[cacheKey];
  delete dbCache[`${table}:global`];
};

export const dbService = {
  async select(table: string, clientId?: string | null) {
    const cacheKey = `${table}:${clientId || 'global'}`;
    const now = Date.now();
    if (dbCache[cacheKey] && (now - dbCache[cacheKey].timestamp) < CACHE_TTL_MS) {
      return dbCache[cacheKey].data;
    }

    let resultData: any[] | null = null;
    if (supabaseAdmin) {
      try {
        let query = supabaseAdmin.from(table).select('*');
        if (clientId && table !== 'clients' && table !== 'plans' && table !== 'modules') {
          query = query.eq('client_id', clientId);
        }
        const { data, error } = await query;
        if (!error && data) {
          resultData = data;
        } else if (error) {
          console.warn(`Supabase generic select warning for ${table}:`, error);
        }
      } catch (dbErr) {
        console.warn(`Supabase generic select failed for table ${table}, using memory fallback:`, dbErr);
      }
    }

    if (resultData === null) {
      if (!inMemoryTables[table]) inMemoryTables[table] = [];
      resultData = inMemoryTables[table];
    }

    // Cache read queries
    dbCache[cacheKey] = {
      data: resultData,
      timestamp: now
    };
    return resultData;
  },

  async insert(table: string, records: any[], clientId?: string | null) {
    const isUuid = (val: any) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

    const processedRecords = records.map(r => {
      const resolvedClientId = isUuid(r.client_id) ? r.client_id : isUuid(clientId) ? clientId : null;
      const record: Record<string, any> = {
        ...r,
        id: r.id || crypto.randomUUID(),
        created_at: r.created_at || new Date().toISOString()
      };
      if (resolvedClientId) {
        record.client_id = resolvedClientId;
      }
      return record;
    });

    // Invalidate reads cache for table
    invalidateCache(table, clientId);

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from(table).insert(processedRecords).select();
        if (!error && data) return data;
        if (error) console.warn(`Supabase generic insert warning for ${table}:`, error);
      } catch (dbErr) {
        console.warn(`Supabase generic insert failed for table ${table}, using memory fallback:`, dbErr);
      }
    }
    if (!inMemoryTables[table]) inMemoryTables[table] = [];
    inMemoryTables[table] = [...processedRecords, ...inMemoryTables[table]];
    return processedRecords;
  },

  async update(table: string, updateData: any, id?: string, field?: string, value?: any, clientId?: string | null) {
    // Invalidate reads cache for table
    invalidateCache(table, clientId);

    if (supabaseAdmin) {
      try {
        let query = supabaseAdmin.from(table).update(updateData);
        if (id) {
          query = query.eq('id', id);
        } else if (field && value) {
          query = query.eq(field, value);
        }
        const { data, error } = await query.select();
        if (!error && data) return data;
        if (error) console.warn(`Supabase generic update warning for ${table}:`, error);
      } catch (dbErr) {
        console.warn(`Supabase generic update failed for table ${table}, using memory fallback:`, dbErr);
      }
    }

    if (!inMemoryTables[table]) inMemoryTables[table] = [];
    inMemoryTables[table] = inMemoryTables[table].map(item => {
      const matchId = id && String(item.id) === String(id);
      const matchField = field && value && String(item[field]) === String(value);
      if (matchId || matchField) {
        return { ...item, ...updateData, updated_at: new Date().toISOString() };
      }
      return item;
    });
    return updateData;
  },

  async delete(table: string, id?: string, field?: string, value?: any, clientId?: string | null) {
    // Invalidate reads cache for table
    invalidateCache(table, clientId);

    if (supabaseAdmin) {
      try {
        let query = supabaseAdmin.from(table).delete();
        if (id) {
          query = query.eq('id', id);
        } else if (field && value) {
          query = query.eq(field, value);
        } else if (clientId) {
          query = query.eq('client_id', clientId);
        }
        const { data, error } = await query.select();
        if (!error && data) return data;
        if (error) console.warn(`Supabase generic delete warning for ${table}:`, error);
      } catch (dbErr) {
        console.warn(`Supabase generic delete failed for table ${table}, using memory fallback:`, dbErr);
      }
    }

    if (!inMemoryTables[table]) inMemoryTables[table] = [];
    if (id) {
      inMemoryTables[table] = inMemoryTables[table].filter(item => String(item.id) !== String(id));
    } else if (field && value) {
      inMemoryTables[table] = inMemoryTables[table].filter(item => String(item[field]) !== String(value));
    } else if (clientId) {
      inMemoryTables[table] = inMemoryTables[table].filter(item => String(item.client_id) !== String(clientId));
    } else {
      inMemoryTables[table] = [];
    }
    return { success: true };
  }
};
