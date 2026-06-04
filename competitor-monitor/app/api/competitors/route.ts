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

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>

  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[competitors/route] getSessionUser() threw:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, url, client_id, scan_frequency } = await request.json()
  if (!name || !url || !client_id) {
    return NextResponse.json({ error: 'name, url, and client_id are required' }, { status: 400 })
  }

  console.log('[competitors/route] inserting:', { name, url, client_id, scan_frequency })
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/competitors`,
      {
        method: 'POST',
        headers: serviceHeaders(),
        body: JSON.stringify({
          name,
          url,
          client_id,
          scan_frequency: scan_frequency ?? 'weekly',
          is_active: true,
        }),
      }
    )
    console.log('[competitors/route] insert — status:', res.status)
    if (!res.ok) {
      const err = await res.clone().json().catch(() => ({})) as Record<string, unknown>
      console.error('[competitors/route] insert failed:', JSON.stringify(err))
      return NextResponse.json({ error: err.message ?? 'Failed to add competitor' }, { status: 500 })
    }
  } catch (e) {
    console.error('[competitors/route] insert threw:', e)
    return NextResponse.json({ error: 'Failed to add competitor' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  let user: Awaited<ReturnType<typeof getSessionUser>>

  try {
    user = await getSessionUser()
  } catch (e) {
    console.error('[competitors/route] DELETE getSessionUser() threw:', e)
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

  console.log('[competitors/route] deleting id:', id)
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/competitors?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: serviceHeaders(),
      }
    )
    console.log('[competitors/route] delete — status:', res.status)
    if (!res.ok) {
      const err = await res.clone().json().catch(() => ({})) as Record<string, unknown>
      console.error('[competitors/route] delete failed:', JSON.stringify(err))
      return NextResponse.json({ error: err.message ?? 'Failed to delete competitor' }, { status: 500 })
    }
  } catch (e) {
    console.error('[competitors/route] delete threw:', e)
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
