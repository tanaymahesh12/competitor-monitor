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

export async function POST() {
  const user = await getSessionUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}&limit=1`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  if (!agencyRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch agency' }, { status: 500 })
  }
  const agencies: { id: string }[] = await agencyRes.json()
  const agencyId = agencies[0]?.id
  if (!agencyId) {
    return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
  }

  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?id=eq.${agencyId}`,
    {
      method: 'PATCH',
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ plan: 'starter' }),
    }
  )
  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({})) as Record<string, unknown>
    return NextResponse.json({ error: err.message ?? 'Failed to cancel subscription' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
