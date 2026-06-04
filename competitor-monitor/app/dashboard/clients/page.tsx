import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ClientsPage } from '@/components/clients-page'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

interface ClientRow {
  id: string
  name: string
  industry: string | null
  website: string | null
  created_at: string
}

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return <ClientsPage initialClients={[]} initialUserEmail="" initialAgencyId="" />
  }

  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const agencies: { id: string }[] = agencyRes.ok ? await agencyRes.json() : []
  console.log('[clients/page] agency lookup for', user.email, '→', agencies)

  const agencyId = agencies[0]?.id ?? ''

  if (!agencyId) {
    console.log('[clients/page] no agency found, returning empty list')
    return (
      <ClientsPage initialClients={[]} initialUserEmail={user.email} initialAgencyId="" />
    )
  }

  const clientsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,name,industry,website,created_at&agency_id=eq.${agencyId}&order=created_at.desc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const rows: ClientRow[] = clientsRes.ok ? await clientsRes.json() : []
  console.log('[clients/page] clients for agency', agencyId, '→', rows.length, 'rows', rows)

  const withCounts = await Promise.all(
    rows.map(async (c) => {
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/competitors?select=id&client_id=eq.${c.id}`,
        { headers: serviceHeaders(), cache: 'no-store' }
      )
      const comps: { id: string }[] = compRes.ok ? await compRes.json() : []
      return { ...c, competitor_count: comps.length }
    })
  )

  console.log('[clients/page] final withCounts:', withCounts.length, 'clients')

  return (
    <ClientsPage
      initialClients={withCounts}
      initialUserEmail={user.email}
      initialAgencyId={agencyId}
    />
  )
}
