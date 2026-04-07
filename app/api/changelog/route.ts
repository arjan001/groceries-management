import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── GET: Fetch all changelog data ──────────────────────────────────────────
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: 'Server not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch versions ordered by created_at desc
  const { data: versions, error: vError } = await supabase
    .from('changelog_versions')
    .select('*')
    .order('created_at', { ascending: false });

  if (vError) {
    return NextResponse.json({ success: false, message: vError.message }, { status: 500 });
  }

  // Fetch all entries
  const { data: entries, error: eError } = await supabase
    .from('changelog_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (eError) {
    return NextResponse.json({ success: false, message: eError.message }, { status: 500 });
  }

  // Fetch system health
  const { data: health } = await supabase
    .from('system_health')
    .select('*')
    .order('created_at', { ascending: true });

  // Group entries by version
  const changelog = (versions || []).map((v: Record<string, unknown>) => ({
    id: v.id,
    version: v.version,
    releaseDate: v.release_date,
    summary: v.summary,
    changes: (entries || [])
      .filter((e: Record<string, unknown>) => e.version_id === v.id)
      .map((e: Record<string, unknown>) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        details: typeof e.details === 'string' ? JSON.parse(e.details as string) : (e.details || []),
        status: e.status,
        category: e.category,
        date: e.date,
      })),
  }));

  const systemHealth = (health || []).map((h: Record<string, unknown>) => ({
    label: h.label,
    value: h.value,
    status: h.status,
  }));

  return NextResponse.json({ success: true, changelog, systemHealth });
}

// ─── POST: Add a new changelog entry ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: 'Server not configured' }, { status: 500 });
  }

  // Verify admin auth
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, details, category, status, version, releaseDate, summary } = body;

  if (!title || !category) {
    return NextResponse.json({ success: false, message: 'Title and category are required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];

  // Get or create version
  let versionId: string;

  if (version) {
    // Use specific version if provided
    const { data: existing } = await supabase
      .from('changelog_versions')
      .select('id')
      .eq('version', version)
      .single();

    if (existing) {
      versionId = existing.id as string;
    } else {
      const { data: newV, error: vErr } = await supabase
        .from('changelog_versions')
        .insert({
          version,
          release_date: releaseDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          summary: summary || '',
        })
        .select()
        .single();

      if (vErr || !newV) {
        return NextResponse.json({ success: false, message: 'Failed to create version: ' + vErr?.message }, { status: 500 });
      }
      versionId = newV.id as string;
    }
  } else {
    // Auto-assign to today's version or create a new one
    const { data: latest } = await supabase
      .from('changelog_versions')
      .select('id, version, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      const createdDate = new Date(latest.created_at as string).toISOString().split('T')[0];
      if (createdDate === today) {
        versionId = latest.id as string;
      } else {
        // Bump version
        const match = (latest.version as string).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
        let newVer = 'v1.0.0';
        if (match) {
          const [, maj, min, pat] = match.map(Number);
          const isMajor = category === 'security' || category === 'feature' || category === 'integration';
          newVer = isMajor ? `v${maj}.${min + 1}.0` : `v${maj}.${min}.${pat + 1}`;
        }

        const { data: newV, error: vErr } = await supabase
          .from('changelog_versions')
          .insert({
            version: newVer,
            release_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            summary: '',
          })
          .select()
          .single();

        if (vErr || !newV) {
          return NextResponse.json({ success: false, message: 'Failed to create version' }, { status: 500 });
        }
        versionId = newV.id as string;
      }
    } else {
      // No versions exist yet
      const { data: newV, error: vErr } = await supabase
        .from('changelog_versions')
        .insert({
          version: 'v1.0.0',
          release_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          summary: '',
        })
        .select()
        .single();

      if (vErr || !newV) {
        return NextResponse.json({ success: false, message: 'Failed to create version' }, { status: 500 });
      }
      versionId = newV.id as string;
    }
  }

  // Insert the changelog entry
  const { data: entry, error: insertErr } = await supabase
    .from('changelog_entries')
    .insert({
      version_id: versionId,
      title,
      description: description || '',
      details: JSON.stringify(details || []),
      status: status || 'completed',
      category,
      date: today,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ success: false, message: insertErr.message }, { status: 500 });
  }

  // Auto-update version summary
  const { data: allEntries } = await supabase
    .from('changelog_entries')
    .select('title, category')
    .eq('version_id', versionId);

  if (allEntries && allEntries.length > 0) {
    const categories = [...new Set(allEntries.map(e => e.category as string))];
    const summaryParts = categories.map(cat => {
      const count = allEntries.filter(e => e.category === cat).length;
      const label = cat === 'feature' ? 'new feature' : cat === 'fix' ? 'bug fix' : cat;
      return `${count} ${label}${count > 1 ? (label.endsWith('x') ? 'es' : 's') : ''}`;
    });
    const autoSummary = summaryParts.join(', ') + '.';

    await supabase
      .from('changelog_versions')
      .update({ summary: autoSummary.charAt(0).toUpperCase() + autoSummary.slice(1) })
      .eq('id', versionId);
  }

  return NextResponse.json({ success: true, entry, message: 'Changelog entry added' }, { status: 201 });
}
