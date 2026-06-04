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
  console.error(`[clients/route] FAILED — ${operation}`)
  console.error(`  status: ${res.status} ${res.statusText}`)
  console.error(`  code: ${(body as Record<string, unknown>)?.code ?? 'n/a'}`)
  console.error(`  message: ${(body as Record<string, unknown>)?.message ?? 'n/a'}`)
  console.error(`  details: ${(body as Record<string, unknown>)?.details ?? 'n/a'}`)
  console.error(`  hint: ${(body as Record<string, unknown>)?.hint ?? 'n/a'}`)
  console.error(`  full body: ${JSON.stringify(body)}`)
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>

  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[clients/route] getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }

  console.log('[clients/route] user after getSessionUser():', JSON.stringify(user))

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, industry, website } = await request.json()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // ── OPERATION 1: look up agency ───────────────────────────────────────────
  console.log('[clients/route] starting: fetch agency for email:', user.email)
  let agencyId: string | undefined

  try {
    const agencyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
      { headers: serviceHeaders(), cache: 'no-store' }
    )
    console.log('[clients/route] fetch agency — status:', agencyRes.status)
    if (!agencyRes.ok) {
      await logFetchError('fetch agency', agencyRes)
      const err = await agencyRes.clone().json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json({ error: err.message ?? 'Failed to fetch agency' }, { status: 500 })
    }
    const agencies: { id: string }[] = await agencyRes.json()
    console.log('[clients/route] agencies result:', JSON.stringify(agencies))
    agencyId = agencies[0]?.id
  } catch (e) {
    console.error('[clients/route] fetch agency threw:', e)
    return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 })
  }

  // ── OPERATION 2: create agency if missing ─────────────────────────────────
  if (!agencyId) {
    console.log('[clients/route] starting: create agency')
    try {
      const createRes = await fetch(
        `${SUPABASE_URL}/rest/v1/agencies`,
        {
          method: 'POST',
          headers: serviceHeaders({ Prefer: 'return=representation' }),
          body: JSON.stringify({ email: user.email, name: 'My Agency' }),
        }
      )
      console.log('[clients/route] create agency — status:', createRes.status)
      if (!createRes.ok) {
        await logFetchError('create agency', createRes)
        const err = await createRes.clone().json().catch(() => ({})) as Record<string, unknown>
        return NextResponse.json({ error: err.message ?? 'Failed to create agency' }, { status: 500 })
      }
      const created: { id: string }[] = await createRes.json()
      console.log('[clients/route] created agency result:', JSON.stringify(created))
      agencyId = created[0]?.id
      if (!agencyId) {
        return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 })
      }
    } catch (e) {
      console.error('[clients/route] create agency threw:', e)
      return NextResponse.json({ error: 'Failed to create agency' }, { status: 500 })
    }
  }

  // ── OPERATION 3: insert client ────────────────────────────────────────────
  console.log('[clients/route] starting: insert client for agency_id:', agencyId)
  try {
    const clientRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients`,
      {
        method: 'POST',
        headers: serviceHeaders(),
        body: JSON.stringify({
          agency_id: agencyId,
          name,
          industry: industry ?? null,
          website: website ?? null,
        }),
      }
    )
    console.log('[clients/route] insert client — status:', clientRes.status)
    if (!clientRes.ok) {
      await logFetchError('insert client', clientRes)
      const err = await clientRes.clone().json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json({ error: err.message ?? 'Failed to add client' }, { status: 500 })
    }
  } catch (e) {
    console.error('[clients/route] insert client threw:', e)
    return NextResponse.json({ error: 'Failed to add client' }, { status: 500 })
  }

  console.log('[clients/route] success')
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>

  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[clients/route] DELETE getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }

  console.log('[clients/route] DELETE user:', JSON.stringify(user))

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // ── OPERATION 4: delete client ────────────────────────────────────────────
  console.log('[clients/route] starting: delete client id:', id)
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: serviceHeaders(),
      }
    )
    console.log('[clients/route] delete client — status:', res.status)
    if (!res.ok) {
      await logFetchError('delete client', res)
      const err = await res.clone().json().catch(() => ({})) as Record<string, unknown>
      return NextResponse.json({ error: err.message ?? 'Failed to delete client' }, { status: 500 })
    }
  } catch (e) {
    console.error('[clients/route] delete client threw:', e)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
