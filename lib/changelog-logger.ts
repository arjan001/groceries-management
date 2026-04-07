import { supabase } from '@/lib/supabase';

// ─── Changelog Logger ────────────────────────────────────────────────────────
// Utility to automatically log changes to the changelog database tables.
// Call this from any module after implementing a significant feature, fix, etc.

export type ChangeCategory = 'security' | 'feature' | 'integration' | 'fix' | 'performance' | 'infrastructure';
export type ChangeStatus = 'completed' | 'in-progress' | 'pending';

interface LogChangeParams {
  title: string;
  description: string;
  details?: string[];
  category: ChangeCategory;
  status?: ChangeStatus;
}

/**
 * Get the current version from the latest changelog_versions entry.
 */
async function getLatestVersion(): Promise<{ id: string; version: string } | null> {
  try {
    const { data, error } = await supabase
      .from('changelog_versions')
      .select('id, version')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return { id: data.id as string, version: data.version as string };
  } catch {
    return null;
  }
}

/**
 * Bump the version number. Supports major/minor/patch bumps.
 * e.g., "v2.0.4" → "v2.0.5" (patch), "v2.1.0" (minor), "v3.0.0" (major)
 */
function bumpVersion(current: string, type: 'major' | 'minor' | 'patch'): string {
  const match = current.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return 'v1.0.0';
  let [, major, minor, patch] = match.map(Number);
  if (type === 'major') { major++; minor = 0; patch = 0; }
  else if (type === 'minor') { minor++; patch = 0; }
  else { patch++; }
  return `v${major}.${minor}.${patch}`;
}

/**
 * Get or create today's version. If the latest version was created today,
 * reuse it. Otherwise, create a new patch version.
 */
async function getOrCreateTodayVersion(bumpType?: 'major' | 'minor' | 'patch'): Promise<{ id: string; version: string } | null> {
  try {
    const latest = await getLatestVersion();
    const today = new Date().toISOString().split('T')[0];

    // Check if the latest version was created today
    if (latest) {
      const { data: versionRow } = await supabase
        .from('changelog_versions')
        .select('id, version, created_at')
        .eq('id', latest.id)
        .single();

      if (versionRow) {
        const createdDate = new Date(versionRow.created_at as string).toISOString().split('T')[0];
        if (createdDate === today) {
          return { id: versionRow.id as string, version: versionRow.version as string };
        }
      }
    }

    // Create a new version for today
    const newVersion = latest ? bumpVersion(latest.version, bumpType || 'patch') : 'v1.0.0';
    const releaseDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const { data, error } = await supabase
      .from('changelog_versions')
      .insert({ version: newVersion, release_date: releaseDate, summary: '' })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create changelog version:', error?.message);
      return null;
    }

    return { id: data.id as string, version: data.version as string };
  } catch (err) {
    console.error('Changelog version error:', err);
    return null;
  }
}

/**
 * Log a change to the changelog. Automatically assigns it to today's version,
 * creating a new version if needed. Prevents duplicate entries with the same title
 * on the same date.
 */
export async function logChangelog(params: LogChangeParams): Promise<boolean> {
  try {
    // Determine bump type based on category
    const bumpType: 'major' | 'minor' | 'patch' =
      params.category === 'security' ? 'minor' :
      params.category === 'feature' ? 'minor' :
      params.category === 'integration' ? 'minor' : 'patch';

    const version = await getOrCreateTodayVersion(bumpType);
    if (!version) return false;

    const today = new Date().toISOString().split('T')[0];

    // Check for duplicate (same title on same date within same version)
    const { data: existing } = await supabase
      .from('changelog_entries')
      .select('id')
      .eq('version_id', version.id)
      .eq('title', params.title)
      .eq('date', today)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing entry instead of creating duplicate
      const { error } = await supabase
        .from('changelog_entries')
        .update({
          description: params.description,
          details: JSON.stringify(params.details || []),
          status: params.status || 'completed',
          category: params.category,
        })
        .eq('id', existing[0].id);

      if (error) console.error('Changelog update error:', error.message);
      return !error;
    }

    // Insert new entry
    const { error } = await supabase
      .from('changelog_entries')
      .insert({
        version_id: version.id,
        title: params.title,
        description: params.description,
        details: JSON.stringify(params.details || []),
        status: params.status || 'completed',
        category: params.category,
        date: today,
      });

    if (error) {
      console.error('Changelog insert error:', error.message);
      return false;
    }

    // Update version summary with count of changes
    const { data: entries } = await supabase
      .from('changelog_entries')
      .select('title, category')
      .eq('version_id', version.id);

    if (entries && entries.length > 0) {
      const categories = [...new Set(entries.map(e => e.category as string))];
      const summaryParts = categories.map(cat => {
        const count = entries.filter(e => e.category === cat).length;
        const label = cat === 'feature' ? 'new feature' : cat === 'fix' ? 'bug fix' : cat;
        return `${count} ${label}${count > 1 ? (label.endsWith('x') ? 'es' : 's') : ''}`;
      });
      const summary = summaryParts.join(', ') + '.';

      await supabase
        .from('changelog_versions')
        .update({ summary: summary.charAt(0).toUpperCase() + summary.slice(1) })
        .eq('id', version.id);
    }

    return true;
  } catch (err) {
    console.error('Changelog logger failed:', err);
    return false;
  }
}

/**
 * Update system health status for a specific label.
 */
export async function updateSystemHealth(label: string, value: string, status: 'healthy' | 'pending' | 'degraded'): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('system_health')
      .upsert({ label, value, status, updated_at: new Date().toISOString() }, { onConflict: 'label' });

    if (error) {
      console.error('System health update error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('System health update failed:', err);
    return false;
  }
}
