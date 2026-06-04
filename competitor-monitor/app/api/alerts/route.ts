import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders(extra?: Record<string, string>) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
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
  console.error(`[alerts/route] FAILED — ${operation}`)
  console.error(`  status: ${res.status} ${res.statusText}`)
  console.error(`  full body: ${JSON.stringify(body)}`)
}

// ── POST — create alert ──────────────────────────────────────────────────────
export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[alerts/route] POST getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { competitor_id, alert_type, notify_email, notify_whatsapp } = await request.json()
  if (!competitor_id || !alert_type) {
    return NextResponse.json({ error: 'competitor_id and alert_type are required' }, { status: 400 })
  }

  // Look up agency by email
  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  console.log('[alerts/route] POST fetch agency — status:', agencyRes.status)
  if (!agencyRes.ok) {
    await logFetchError('fetch agency', agencyRes)
    return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 })
  }
  const agencies: { id: string }[] = await agencyRes.json()
  const agencyId = agencies[0]?.id

  if (!agencyId) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  // Insert alert
  const insertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alerts`,
    {
      method: 'POST',
      headers: serviceHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        competitor_id,
        alert_type,
        notify_email: notify_email ?? true,
        notify_whatsapp: notify_whatsapp ?? false,
        agency_id: agencyId,
        is_active: true,
      }),
    }
  )
  console.log('[alerts/route] POST insert alert — status:', insertRes.status)
  if (!insertRes.ok) {
    await logFetchError('insert alert', insertRes)
    const err = await insertRes.clone().json().catch(() => ({})) as Record<string, unknown>
    return NextResponse.json({ error: err.message ?? 'Failed to create alert' }, { status: 500 })
  }

  console.log('[alerts/route] POST success')
  return NextResponse.json({ success: true })
}

// ── DELETE — remove alert by id ──────────────────────────────────────────────
export async function DELETE(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[alerts/route] DELETE getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  console.log('[alerts/route] DELETE alert id:', id)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/alerts?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: serviceHeaders() }
  )
  console.log('[alerts/route] DELETE — status:', res.status)
  if (!res.ok) {
    await logFetchError('delete alert', res)
    const err = await res.clone().json().catch(() => ({})) as Record<string, unknown>
    return NextResponse.json({ error: err.message ?? 'Failed to delete alert' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── PATCH — update is_active by id ──────────────────────────────────────────
export async function PATCH(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>
  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[alerts/route] PATCH getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { is_active } = await request.json()
  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) is required' }, { status: 400 })
  }

  console.log('[alerts/route] PATCH alert id:', id, '→ is_active:', is_active)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/alerts?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: serviceHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ is_active }),
    }
  )
  console.log('[alerts/route] PATCH — status:', res.status)
  if (!res.ok) {
    await logFetchError('update alert', res)
    const err = await res.clone().json().catch(() => ({})) as Record<string, unknown>
    return NextResponse.json({ error: err.message ?? 'Failed to update alert' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
