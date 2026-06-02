'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ALERT_TYPES = [
  { value: 'pricing_change', label: 'Pricing Change' },
  { value: 'new_page', label: 'New Page' },
  { value: 'copy_change', label: 'Copy Change' },
  { value: 'tech_change', label: 'Tech Stack Change' },
]

type Alert = {
  id: string
  competitor_id: string
  competitor_name: string
  alert_type: string
  notify_email: boolean
  is_active: boolean
  created_at: string
  trigger_count: number
  last_triggered: string | null
}

type Trigger = {
  id: string
  alert_id: string
  created_at: string
  details: Record<string, unknown> | null
  alert?: { alert_type: string; competitors?: { name: string } | null }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [competitors, setCompetitors] = useState<{ id: string; name: string }[]>([])
  const [agencyId, setAgencyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    competitor_id: '',
    alert_type: 'copy_change',
    notify_email: true,
  })

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: agency } = await supabase
      .from('agencies').select('id').eq('user_id', user.id).single()
    if (!agency) return
    setAgencyId(agency.id)

    // Get client ids for this agency
    const { data: clientRows } = await supabase
      .from('clients').select('id').eq('agency_id', agency.id)
    const clientIds = (clientRows ?? []).map((c) => c.id)

    // Get competitors for this agency
    const { data: compRows } = clientIds.length
      ? await supabase.from('competitors').select('id, name').in('client_id', clientIds)
      : { data: [] }
    setCompetitors(compRows ?? [])

    const compIds = (compRows ?? []).map((c) => c.id)
    if (!compIds.length) { setLoading(false); return }

    // Alerts
    const { data: alertRows } = await supabase
      .from('alerts')
      .select('id, competitor_id, alert_type, notify_email, is_active, created_at, competitors(name)')
      .eq('agency_id', agency.id)
      .order('created_at', { ascending: false })

    // Triggers (last 20)
    const { data: triggerRows } = await supabase
      .from('alert_triggers')
      .select('id, alert_id, created_at, details, alerts(alert_type, competitors(name))')
      .in('alerts.competitor_id', compIds)
      .order('created_at', { ascending: false })
      .limit(20)

    // Enrich alerts with trigger counts
    const withCounts: Alert[] = await Promise.all(
      (alertRows ?? []).map(async (a) => {
        const { count } = await supabase
          .from('alert_triggers')
          .select('id', { count: 'exact', head: true })
          .eq('alert_id', a.id)
        const { data: lastTrigger } = await supabase
          .from('alert_triggers')
          .select('created_at')
          .eq('alert_id', a.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        const comp = Array.isArray(a.competitors) ? a.competitors[0] : a.competitors
        return {
          id: a.id,
          competitor_id: a.competitor_id,
          competitor_name: (comp as { name?: string } | null)?.name ?? '—',
          alert_type: a.alert_type,
          notify_email: a.notify_email,
          is_active: a.is_active,
          created_at: a.created_at,
          trigger_count: count ?? 0,
          last_triggered: lastTrigger?.created_at ?? null,
        }
      })
    )

    setAlerts(withCounts)
    setTriggers(triggerRows ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.competitor_id) { setFormError('Please select a competitor.'); return }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('alerts').insert({
      agency_id: agencyId,
      competitor_id: form.competitor_id,
      alert_type: form.alert_type,
      notify_email: form.notify_email,
      is_active: true,
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setOpen(false)
    setForm({ competitor_id: '', alert_type: 'copy_change', notify_email: true })
    await loadData()
  }

  async function toggleActive(alertId: string, current: boolean) {
    setToggling(alertId)
    await supabase.from('alerts').update({ is_active: !current }).eq('id', alertId)
    setAlerts((prev) =>
      prev.map((a) => a.id === alertId ? { ...a, is_active: !current } : a)
    )
    setToggling(null)
  }

  async function handleDelete(alertId: string) {
    if (!confirm('Delete this alert?')) return
    setDeleting(alertId)
    await supabase.from('alerts').delete().eq('id', alertId)
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    setDeleting(null)
  }

  function timeAgo(iso: string | null) {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const alertTypeLabel = (t: string) =>
    ALERT_TYPES.find((a) => a.value === t)?.label ?? t

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
            {alerts.filter((a) => a.is_active).length} active alert{alerts.filter((a) => a.is_active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setOpen(true); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-all"
          style={{ background: '#6366f1' }}
        >
          <span>+</span> Create Alert
        </button>
      </div>

      {/* Active Alerts */}
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>
        Active Alerts
      </h2>

      {loading ? (
        <div className="space-y-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl h-16 animate-pulse" style={{ background: '#13151c', border: '1px solid #1e2130' }} />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center mb-6"
          style={{ background: '#13151c', border: '1px solid #1e2130' }}
        >
          <p className="text-sm" style={{ color: '#475569' }}>
            No alerts configured. Click &quot;Create Alert&quot; to get notified when competitors change.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-xl p-4 flex items-center gap-4"
              style={{
                background: '#13151c',
                border: `1px solid ${alert.is_active ? '#1e2130' : '#1e213060'}`,
                opacity: alert.is_active ? 1 : 0.6,
              }}
            >
              {/* Status dot */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: alert.is_active ? '#22c55e' : '#475569' }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>
                    {alert.competitor_name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: '#6366f115', color: '#6366f1' }}
                  >
                    {alertTypeLabel(alert.alert_type)}
                  </span>
                  {alert.notify_email && (
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ background: '#f59e0b15', color: '#f59e0b' }}
                    >
                      Email
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: '#475569' }}>
                  <span>Fired {alert.trigger_count}×</span>
                  <span>·</span>
                  <span>Last: {timeAgo(alert.last_triggered)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(alert.id, alert.is_active)}
                  disabled={toggling === alert.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                  style={{
                    background: alert.is_active ? '#22c55e15' : '#6366f115',
                    color: alert.is_active ? '#22c55e' : '#6366f1',
                  }}
                >
                  {toggling === alert.id ? '…' : alert.is_active ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(alert.id)}
                  disabled={deleting === alert.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: '#ef444415', color: '#ef4444' }}
                >
                  {deleting === alert.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Triggers */}
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>
        Recent Alert Triggers
      </h2>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#13151c', border: '1px solid #1e2130' }}
      >
        {triggers.length === 0 ? (
          <p className="p-6 text-sm text-center" style={{ color: '#475569' }}>
            No alert triggers yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2130' }}>
                {['Competitor', 'Alert Type', 'Triggered', 'Details'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#475569' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => {
                const al = Array.isArray(t.alert) ? t.alert[0] : t.alert
                const comp = Array.isArray(al?.competitors) ? al?.competitors[0] : al?.competitors
                return (
                  <tr
                    key={t.id}
                    style={{ borderTop: '1px solid #1e2130' }}
                    className="hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-sm" style={{ color: '#f1f5f9' }}>
                      {(comp as { name?: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: '#6366f115', color: '#6366f1' }}
                      >
                        {alertTypeLabel(al?.alert_type ?? '')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
                      {timeAgo(t.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#94a3b8' }}>
                      {t.details ? JSON.stringify(t.details).slice(0, 60) + '…' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Alert Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="relative w-full max-w-md rounded-xl p-6 shadow-2xl z-10"
            style={{ background: '#13151c', border: '1px solid #1e2130' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: '#f1f5f9' }}>
              Create Alert
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
                  Competitor *
                </label>
                <select
                  value={form.competitor_id}
                  onChange={(e) => setForm({ ...form, competitor_id: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                >
                  <option value="">Select competitor…</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
                  Alert Type *
                </label>
                <select
                  value={form.alert_type}
                  onChange={(e) => setForm({ ...form, alert_type: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                >
                  {ALERT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div
                className="flex items-center justify-between rounded-lg px-3 py-3"
                style={{ background: '#0f1117', border: '1px solid #1e2130' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: '#f1f5f9' }}>
                    Notify via Email
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    Send an email when this alert fires
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, notify_email: !form.notify_email })}
                  className="relative w-10 h-5 rounded-full transition-all duration-200 shrink-0"
                  style={{ background: form.notify_email ? '#6366f1' : '#1e2130' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                    style={{ left: form.notify_email ? '22px' : '2px' }}
                  />
                </button>
              </div>

              {formError && <p className="text-xs" style={{ color: '#ef4444' }}>{formError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#1e2130', color: '#94a3b8' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: '#6366f1' }}
                >
                  {saving ? 'Creating…' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
