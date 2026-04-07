/**
 * Convert camelCase keys to snake_case for Supabase
 */
export function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Convert snake_case keys to camelCase from Supabase
 */
export function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

/**
 * Map array of Supabase rows (snake_case) to camelCase
 */
export function mapFromDb<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(row => toCamel(row) as T);
}

/**
 * Map a single object from camelCase to snake_case for DB insert/update
 */
export function mapToDb(obj: Record<string, unknown>, excludeKeys: string[] = ['id', 'certificates']): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!excludeKeys.includes(key) && value !== undefined) {
      filtered[key] = value;
    }
  }
  return toSnake(filtered);
}
