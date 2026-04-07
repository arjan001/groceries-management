import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== '';
};

// ── Generic CRUD helpers ──
export async function dbFetchAll<T>(table: string, orderBy = 'created_at', ascending = false): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending });
  if (error) { console.error(`Fetch ${table}:`, error.message); return []; }
  return (data || []) as T[];
}

export async function dbFetchWithFilter<T>(table: string, filters: Record<string, unknown>, orderBy = 'created_at'): Promise<T[]> {
  let query = supabase.from(table).select('*');
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.order(orderBy, { ascending: false });
  if (error) { console.error(`Fetch ${table}:`, error.message); return []; }
  return (data || []) as T[];
}

export async function dbInsert<T>(table: string, row: Partial<T>): Promise<T | null> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) { console.error(`Insert ${table}:`, error.message); throw error; }
  return data as T;
}

export async function dbUpdate<T>(table: string, id: string, updates: Partial<T>): Promise<T | null> {
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
  if (error) { console.error(`Update ${table}:`, error.message); throw error; }
  return data as T;
}

export async function dbDelete(table: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) { console.error(`Delete ${table}:`, error.message); throw error; }
  return true;
}

export async function dbUpsert<T>(table: string, row: Partial<T>): Promise<T | null> {
  const { data, error } = await supabase.from(table).upsert(row).select().single();
  if (error) { console.error(`Upsert ${table}:`, error.message); throw error; }
  return data as T;
}
