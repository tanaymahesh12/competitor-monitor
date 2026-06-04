import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChangesPage } from '@/components/changes-page'
import type { Change, Client, Competitor } from '@/components/changes-page'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

interface RawCompetitorEmbed {
  id: string
  name: string
  url: string
  clients: { id: string; name: string } | { id: string; name: string }[] | null
}

interface RawChangeRow {
  id: string
  change_type: string
  severity: string
  diff_summary: string | null
  ai_insight: string | null
  is_reviewed: boolean | null
  detected_at: string
  competitors: RawCompetitorEmbed | RawCompetitorEmbed[] | null
}

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return <ChangesPage initialChanges={[]} initialClients={[]} initialCompetitors={[]} userEmail="" />
  }

  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const agencies: { id: string }[] = agencyRes.ok ? await agencyRes.json() : []
  console.log('[changes/page] agency lookup for', user.email, '→', agencies)
  const agencyId = agencies[0]?.id ?? ''

  if (!agencyId) {
    console.log('[changes/page] no agency found')
    return <ChangesPage initialChanges={[]} initialClients={[]} initialCompetitors={[]} userEmail={user.email} />
  }

  const clientsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name&agency_id=eq.${agencyId}&order=name.asc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const clients: Client[] = clientsRes.ok ? await clientsRes.json() : []
  console.log('[changes/page] clients:', clients.length)

  if (clients.length === 0) {
    return <ChangesPage initialChanges={[]} initialClients={[]} initialCompetitors={[]} userEmail={user.email} />
  }

  const clientIds = clients.map((c) => c.id)

  const competitorsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/competitors?select=id,name,url&client_id=in.(${clientIds.join(',')})&order=name.asc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const competitors: Competitor[] = competitorsRes.ok ? await competitorsRes.json() : []
  console.log('[changes/page] competitors:', competitors.length)
  console.log('[changes/page] competitor ids:', competitors.map(c => c.id))

  if (competitors.length === 0) {
    return (
      <ChangesPage
        initialChanges={[]}
        initialClients={clients}
        initialCompetitors={[]}
        userEmail={user.email}
      />
    )
  }

  const competitorIds = competitors.map((c) => c.id)

  const changesUrl = `${SUPABASE_URL}/rest/v1/changes?competitor_id=in.(${competitorIds.join(',')})&select=id,change_type,severity,diff_summary,ai_insight,is_reviewed,detected_at,competitors(id,name,url,clients(id,name))&order=detected_at.desc`
  console.log('[changes/page] changes query URL:', changesUrl)
  const changesRes = await fetch(changesUrl, { headers: serviceHeaders(), cache: 'no-store' })
  const changesBody: unknown = await changesRes.json().catch(() => null)
  console.log('[changes/page] changes raw response — status:', changesRes.status, 'body:', JSON.stringify(changesBody))
  const rawChanges: RawChangeRow[] = changesRes.ok && Array.isArray(changesBody) ? changesBody : []
  console.log('[changes/page] raw changes:', rawChanges.length)

  const changes: Change[] = rawChanges.map((c) => {
    const comp = Array.isArray(c.competitors) ? c.competitors[0] : c.competitors
    const client = comp
      ? Array.isArray(comp.clients)
        ? comp.clients[0]
        : comp.clients
      : null
    return {
      id: c.id,
      change_type: c.change_type,
      severity: (c.severity as 'low' | 'medium' | 'high') ?? 'low',
      description: c.diff_summary,
      ai_insight: c.ai_insight,
      diff_data: null,
      is_reviewed: c.is_reviewed ?? false,
      created_at: c.detected_at,
      competitor_name: comp?.name ?? '—',
      competitor_url: comp?.url ?? '',
      client_name: client?.name ?? '—',
    }
  })

  console.log('[changes/page] final:', changes.length, 'changes')

  return (
    <ChangesPage
      initialChanges={changes}
      initialClients={clients}
      initialCompetitors={competitors}
      userEmail={user.email}
    />
  )
}
