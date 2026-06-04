import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CompetitorsPage } from '@/components/competitors-page'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

interface CompetitorRow {
  id: string
  name: string
  url: string
  is_active: boolean
  scan_frequency: string
  created_at: string
  client_id: string
  clients: { name: string } | null
}

interface ClientRow {
  id: string
  name: string
}

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return <CompetitorsPage initialCompetitors={[]} initialClients={[]} userEmail="" />
  }

  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const agencies: { id: string }[] = agencyRes.ok ? await agencyRes.json() : []
  console.log('[competitors/page] agency lookup for', user.email, '→', agencies)
  const agencyId = agencies[0]?.id ?? ''

  if (!agencyId) {
    console.log('[competitors/page] no agency found')
    return <CompetitorsPage initialCompetitors={[]} initialClients={[]} userEmail={user.email} />
  }

  const clientsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name&agency_id=eq.${agencyId}&order=name.asc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const clients: ClientRow[] = clientsRes.ok ? await clientsRes.json() : []
  console.log('[competitors/page] clients:', clients.length)

  if (clients.length === 0) {
    return <CompetitorsPage initialCompetitors={[]} initialClients={[]} userEmail={user.email} />
  }

  const clientIds = clients.map((c) => c.id)

  const compRes = await fetch(
    `${SUPABASE_URL}/rest/v1/competitors?select=id,name,url,is_active,scan_frequency,created_at,client_id,clients(name)&client_id=in.(${clientIds.join(',')})&order=created_at.desc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const competitorRows: CompetitorRow[] = compRes.ok ? await compRes.json() : []
  console.log('[competitors/page] competitors:', competitorRows.length)

  if (competitorRows.length === 0) {
    return (
      <CompetitorsPage initialCompetitors={[]} initialClients={clients} userEmail={user.email} />
    )
  }

  const competitorIds = competitorRows.map((c) => c.id)

  const [snapshotsRes, changesRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/snapshots?select=competitor_id,scraped_at&competitor_id=in.(${competitorIds.join(',')})&order=scraped_at.desc`,
      { headers: serviceHeaders(), cache: 'no-store' }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/changes?select=competitor_id,detected_at&competitor_id=in.(${competitorIds.join(',')})&order=detected_at.desc`,
      { headers: serviceHeaders(), cache: 'no-store' }
    ),
  ])

  const snapshots: { competitor_id: string; scraped_at: string }[] =
    snapshotsRes.ok ? await snapshotsRes.json() : []
  const changes: { competitor_id: string; detected_at: string }[] =
    changesRes.ok ? await changesRes.json() : []

  const lastScraped: Record<string, string> = {}
  for (const s of snapshots) {
    if (!lastScraped[s.competitor_id]) lastScraped[s.competitor_id] = s.scraped_at
  }
  const lastChange: Record<string, string> = {}
  for (const c of changes) {
    if (!lastChange[c.competitor_id]) lastChange[c.competitor_id] = c.detected_at
  }

  const competitors = competitorRows.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    is_active: c.is_active,
    scan_frequency: c.scan_frequency,
    created_at: c.created_at,
    client_name: (c.clients as { name: string } | null)?.name ?? '—',
    last_scraped: lastScraped[c.id] ?? null,
    last_change: lastChange[c.id] ?? null,
  }))

  console.log('[competitors/page] final:', competitors.length, 'competitors')

  return (
    <CompetitorsPage
      initialCompetitors={competitors}
      initialClients={clients}
      userEmail={user.email}
    />
  )
}
