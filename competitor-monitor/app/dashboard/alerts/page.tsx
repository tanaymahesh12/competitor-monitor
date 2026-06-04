import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AlertsPage } from '@/components/alerts-page'
import type { Alert, Trigger, Competitor } from '@/components/alerts-page'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

interface RawAlertRow {
  id: string
  competitor_id: string
  alert_type: string
  notify_email: boolean
  notify_whatsapp: boolean | null
  is_active: boolean
  created_at: string
  competitors: { name: string } | { name: string }[] | null
}

interface RawTriggerStat {
  alert_id: string
  created_at: string
}

interface RawTriggerRow {
  id: string
  alert_id: string
  created_at: string
  details: Record<string, unknown> | null
  alerts: {
    alert_type: string
    competitors: { name: string } | { name: string }[] | null
  } | {
    alert_type: string
    competitors: { name: string } | { name: string }[] | null
  }[] | null
}

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const empty = (
    <AlertsPage
      initialAlerts={[]}
      initialTriggers={[]}
      initialCompetitors={[]}
      userEmail=""
    />
  )

  if (!user?.email) return empty

  // ── Agency ──────────────────────────────────────────────────────────────
  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id&email=eq.${encodeURIComponent(user.email)}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const agencies: { id: string }[] = agencyRes.ok ? await agencyRes.json() : []
  console.log('[alerts/page] agency lookup for', user.email, '→', agencies)
  const agencyId = agencies[0]?.id ?? ''

  if (!agencyId) {
    console.log('[alerts/page] no agency found')
    return (
      <AlertsPage
        initialAlerts={[]}
        initialTriggers={[]}
        initialCompetitors={[]}
        userEmail={user.email}
      />
    )
  }

  // ── Clients → Competitors (for dropdown) ────────────────────────────────
  const clientsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id&agency_id=eq.${agencyId}`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const clients: { id: string }[] = clientsRes.ok ? await clientsRes.json() : []
  const clientIds = clients.map((c) => c.id)

  let competitors: Competitor[] = []
  if (clientIds.length > 0) {
    const compRes = await fetch(
      `${SUPABASE_URL}/rest/v1/competitors?select=id,name&client_id=in.(${clientIds.join(',')})&order=name.asc`,
      { headers: serviceHeaders(), cache: 'no-store' }
    )
    competitors = compRes.ok ? await compRes.json() : []
  }
  console.log('[alerts/page] competitors for dropdown:', competitors.length)

  // ── Alerts ───────────────────────────────────────────────────────────────
  const alertsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alerts?select=id,competitor_id,alert_type,notify_email,notify_whatsapp,is_active,created_at,competitors(name)&agency_id=eq.${agencyId}&order=created_at.desc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const rawAlerts: RawAlertRow[] = alertsRes.ok ? await alertsRes.json() : []
  console.log('[alerts/page] alerts:', rawAlerts.length)

  if (rawAlerts.length === 0) {
    return (
      <AlertsPage
        initialAlerts={[]}
        initialTriggers={[]}
        initialCompetitors={competitors}
        userEmail={user.email}
      />
    )
  }

  const alertIds = rawAlerts.map((a) => a.id)

  // ── Trigger stats (count + last_triggered per alert) ────────────────────
  const statsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_triggers?select=alert_id,created_at&alert_id=in.(${alertIds.join(',')})&order=created_at.desc`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const triggerStats: RawTriggerStat[] = statsRes.ok ? await statsRes.json() : []

  const triggerCount: Record<string, number> = {}
  const lastTriggered: Record<string, string> = {}
  for (const t of triggerStats) {
    triggerCount[t.alert_id] = (triggerCount[t.alert_id] ?? 0) + 1
    if (!lastTriggered[t.alert_id]) lastTriggered[t.alert_id] = t.created_at
  }

  // ── Recent triggers (limit 20) with joins ───────────────────────────────
  const triggersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alert_triggers?select=id,alert_id,created_at,details,alerts(alert_type,competitors(name))&alert_id=in.(${alertIds.join(',')})&order=created_at.desc&limit=20`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const rawTriggers: RawTriggerRow[] = triggersRes.ok ? await triggersRes.json() : []
  console.log('[alerts/page] recent triggers:', rawTriggers.length)

  // ── Map to component types ───────────────────────────────────────────────
  const alerts: Alert[] = rawAlerts.map((a) => {
    const comp = Array.isArray(a.competitors) ? a.competitors[0] : a.competitors
    return {
      id: a.id,
      alert_type: a.alert_type,
      condition_value: '',
      notify_email: a.notify_email,
      notify_whatsapp: a.notify_whatsapp ?? false,
      is_active: a.is_active,
      created_at: a.created_at,
      competitor_name: comp?.name ?? '—',
    }
  })

  const triggers: Trigger[] = rawTriggers.map((t) => {
    const al = Array.isArray(t.alerts) ? t.alerts[0] : t.alerts
    const comp = al ? (Array.isArray(al.competitors) ? al.competitors[0] : al.competitors) : null
    const message = t.details
      ? JSON.stringify(t.details).slice(0, 120)
      : '—'
    return {
      id: t.id,
      alert_id: t.alert_id,
      triggered_at: t.created_at,
      message,
      competitor_name: comp?.name ?? '—',
      alert_type: al?.alert_type ?? '—',
    }
  })

  console.log('[alerts/page] final:', alerts.length, 'alerts,', triggers.length, 'triggers')

  return (
    <AlertsPage
      initialAlerts={alerts}
      initialTriggers={triggers}
      initialCompetitors={competitors}
      userEmail={user.email}
    />
  )
}
