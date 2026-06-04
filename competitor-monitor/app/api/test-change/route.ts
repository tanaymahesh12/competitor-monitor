import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders(extra?: Record<string, string>) {
  return {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'global.headers.Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra,
  }
}

async function getSessionUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            )
          } catch { /* read-only in route handlers */ }
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function logFetchError(operation: string, res: Response) {
  let body: unknown = '<empty body>'
  try { body = await res.clone().json() } catch { /* non-JSON body */ }
  console.error(`[test-change/route] FAILED — ${operation}`)
  console.error(`  status: ${res.status} ${res.statusText}`)
  console.error(`  body: ${JSON.stringify(body)}`)
}

export async function POST(_request: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[test-change/route] getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch agency ───────────────────────────────────────────────────────────
  console.log('[test-change/route] fetching agency for', user.email)
  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  if (!agencyRes.ok) {
    await logFetchError('fetch agency', agencyRes)
    return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 })
  }
  const agencies: { id: string }[] = await agencyRes.json()
  const agencyId = agencies[0]?.id
  if (!agencyId) {
    return NextResponse.json({ error: 'No agency found for this user' }, { status: 404 })
  }

  // ── Fetch first client for agency ──────────────────────────────────────────
  console.log('[test-change/route] fetching first client for agency', agencyId)
  const clientsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?agency_id=eq.${encodeURIComponent(agencyId)}&select=id&limit=1`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  if (!clientsRes.ok) {
    await logFetchError('fetch clients', clientsRes)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
  const clients: { id: string }[] = await clientsRes.json()
  const clientId = clients[0]?.id
  if (!clientId) {
    return NextResponse.json({ error: 'No clients found for this agency' }, { status: 404 })
  }

  // ── Fetch first competitor for that client ─────────────────────────────────
  console.log('[test-change/route] fetching first competitor for client', clientId)
  const competitorsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/competitors?client_id=eq.${encodeURIComponent(clientId)}&select=id&limit=1`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  if (!competitorsRes.ok) {
    await logFetchError('fetch competitors', competitorsRes)
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 })
  }
  const competitors: { id: string }[] = await competitorsRes.json()
  const competitorId = competitors[0]?.id
  if (!competitorId) {
    return NextResponse.json({ error: 'No competitors found' }, { status: 404 })
  }

  // ── Fetch two most recent snapshots ───────────────────────────────────────
  console.log('[test-change/route] fetching snapshots for competitor', competitorId)
  const snapshotsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/snapshots?competitor_id=eq.${encodeURIComponent(competitorId)}&select=id&order=scraped_at.desc&limit=2`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  if (!snapshotsRes.ok) {
    await logFetchError('fetch snapshots', snapshotsRes)
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
  }
  const snapshots: { id: string }[] = await snapshotsRes.json()
  const snapshotNewId = snapshots[0]?.id ?? null
  const snapshotOldId = snapshots[1]?.id ?? null

  // ── Insert fake change ────────────────────────────────────────────────────
  console.log('[test-change/route] inserting fake change for competitor', competitorId)
  const changeRes = await fetch(`${SUPABASE_URL}/rest/v1/changes`, {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      competitor_id: competitorId,
      snapshot_old_id: snapshotOldId,
      snapshot_new_id: snapshotNewId,
      change_type: 'pricing',
      severity: 'high',
      diff_summary: 'Price changed from ₹999/mo to ₹1299/mo for Pro plan',
      ai_insight:
        'Great Learning increased Pro plan pricing by 30%, likely testing higher LTV customers ahead of a product expansion',
      is_reviewed: false,
      detected_at: new Date().toISOString(),
    }),
  })
  if (!changeRes.ok) {
    await logFetchError('insert change', changeRes)
    const err = await changeRes.clone().json().catch(() => ({})) as Record<string, unknown>
    return NextResponse.json({ error: err.message ?? 'Failed to insert change' }, { status: 500 })
  }

  const inserted: unknown[] = await changeRes.json()
  console.log('[test-change/route] done:', JSON.stringify(inserted[0]))
  return NextResponse.json({ success: true, change: inserted[0] })
}
