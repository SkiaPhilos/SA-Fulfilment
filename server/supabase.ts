/**
 * Supabase Integration Layer for Ship Asaan
 * Provides cloud persistence for Vercel serverless and distributed environments.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema } from './db.js';

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (isInitialized) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`[SUPABASE] Connected successfully to ${supabaseUrl}`);
    } catch (err) {
      console.error('[SUPABASE] Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  } else {
    console.log('[SUPABASE] No SUPABASE_URL / SUPABASE_KEY detected. Operating in local JSON storage mode.');
  }

  isInitialized = true;
  return supabaseClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

/**
 * Fetch authoritative database snapshot from Supabase
 */
export async function fetchStateFromSupabase(): Promise<DatabaseSchema | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('ship_asaan_snapshots')
      .select('data, updated_at')
      .eq('id', 'master')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found - first time initialization
        console.log('[SUPABASE] No master snapshot found yet in Supabase. Will initialize on next write.');
        return null;
      }
      console.warn('[SUPABASE] Query returned error (ensure supabase/schema.sql has been executed):', error.message);
      return null;
    }

    if (data && data.data) {
      console.log(`[SUPABASE] Successfully loaded cloud state snapshot (last updated: ${data.updated_at})`);
      return data.data as DatabaseSchema;
    }

    return null;
  } catch (err: any) {
    console.error('[SUPABASE] Unexpected error loading state from Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Save authoritative database snapshot to Supabase
 */
export async function syncStateToSupabase(schema: DatabaseSchema): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload = {
      id: 'master',
      data: schema,
      updated_at: new Date().toISOString()
    };

    const { error } = await client
      .from('ship_asaan_snapshots')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[SUPABASE] Failed to sync snapshot to Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[SUPABASE] Sync exception:', err?.message || err);
    return false;
  }
}
