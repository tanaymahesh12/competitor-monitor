'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Change = {
  id: string
  change_type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  ai_insight: string | null
  diff_data: { added: string[]; removed: string[]; changePercent: number } | null
  reviewed: boolean
  created_at: string
  competitor_name: string
  client_name: string
}

type FilterState = {
  client: string
  competitor: string
  severity: string
  change_type: string
  from: string
  to: string
}

const SEV: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: '#ef444415', color: '#ef4444', label: 'High' },
  medium: { bg: '#f59e0b15', color: '#f59e0b', label: 'Medium' },
  low:    { bg: '#22c55e15', color: '#22c55e', label: 'Low' },
}

const CHANGE_TYPES = ['copy_change', 'tech_change', 'new_page', 'pricing_change', 'initial_scan']

export default function ChangesPage() {
  const [changes, setChanges] = useState<Change[]>([])
  const [filtered, setFiltered] = useState<Change[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [competitors, setCompetitors] = useState<{ id: string; name: string }[]>([])

  const [filters, setFilters] = useState<FilterState>({
    client: '', competitor: '', severity: '', change_type: '', from: '', to: '',
  })

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: agency } = await supabase
      .from('agencies').select('id').eq('user_id', user.id).single()
    if (!agency) return

    const [clientsRes, changesRes] = await Promise.all([
      supabase.from('clients').select('id, name').eq('agency_id', agency.id),
      supabase
        .from('changes')
        .select(
          `id, change_type, severity, description, ai_insight, diff_data, reviewed, created_at,
           competitors(id, name, clients!inner(id, name, agency_id))`
        )
        .eq('competitors.clients.agency_id', agency.id)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    const clientList = clientsRes.data ?? []
    setClients(clientList)

    const raw = changesRes.data ?? []
    const mapped: Change[] = raw.map((c) => {
      const comp = Array.isArray(c.competitors) ? c.competitors[0] : c.competitors
      const client = Array.isArray(comp?.clients) ? comp?.clients[0] : comp?.clients
      return {
        id: c.id,
        change_type: c.change_type,
        severity: c.severity,
        description: c.description,
        ai_insight: c.ai_insight,
        diff_data: c.diff_data,
        reviewed: c.reviewed,
        created_at: c.created_at,
        competitor_name: comp?.name ?? '—',
        client_name: client?.name ?? '—',
      }
    })

    setChanges(mapped)

    // Unique competitors
    const compMap = new Map<string, string>()
    mapped.forEach((ch) => compMap.set(ch.competitor_name, ch.competitor_name))
    setCompetitors([...compMap.entries()].map(([id, name]) => ({ id, name })))

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Apply filters
  useEffect(() => {
    let result = changes
    if (filters.client) result = result.filter((c) => c.client_name === filters.client)
    if (filters.competitor) result = result.filter((c) => c.competitor_name === filters.competitor)
    if (filters.severity) result = result.filter((c) => c.severity === filters.severity)
    if (filters.change_type) result = result.filter((c) => c.change_type === filters.change_type)
    if (filters.from) result = result.filter((c) => new Date(c.created_at) >= new Date(filters.from))
    if (filters.to) result = result.filter((c) => new Date(c.created_at) <= new Date(filters.to + 'T23:59:59'))
    setFiltered(result)
  }, [changes, filters])

  async function markReviewed(id: string) {
    setMarking(id)
    await supabase.from('changes').update({ reviewed: true }).eq('id', id)
    setChanges((prev) => prev.map((c) => c.id === id ? { ...c, reviewed: true } : c))
    setMarking(null)
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const selectStyle = {
    background: '#0f1117',
    border: '1px solid #1e2130',
    color: '#94a3b8',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '13px',
    outline: 'none',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Changes</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
          {filtered.length} change{filtered.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="rounded-xl p-4 mb-5 flex flex-wrap gap-3"
        style={{ background: '#13151c', border: '1px solid #1e2130' }}
      >
        <select style={selectStyle} value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })}>
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <select style={selectStyle} value={filters.competitor} onChange={(e) => setFilters({ ...filters, competitor: e.target.value })}>
          <option value="">All Competitors</option>
          {competitors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <select style={selectStyle} value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
          <option value="">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select style={selectStyle} value={filters.change_type} onChange={(e) => setFilters({ ...filters, change_type: e.target.value })}>
          <option value="">All Types</option>
          {CHANGE_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          type="date"
          style={selectStyle}
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          title="From date"
        />
        <input
          type="date"
          style={selectStyle}
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          title="To date"
        />

        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() => setFilters({ client: '', competitor: '', severity: '', change_type: '', from: '', to: '' })}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: '#1e2130', color: '#94a3b8' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Changes list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 h-24 animate-pulse" style={{ background: '#13151c', border: '1px solid #1e2130' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: '#13151c', border: '1px solid #1e2130' }}>
          <p className="text-sm" style={{ color: '#475569' }}>No changes match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ch) => {
            const sev = SEV[ch.severity] ?? SEV.low
            const isExpanded = expanded === ch.id
            return (
              <div
                key={ch.id}
                className="rounded-xl overflow-hidden"
                style={{
                  background: '#13151c',
                  border: `1px solid ${isExpanded ? '#6366f140' : '#1e2130'}`,
                  opacity: ch.reviewed ? 0.65 : 1,
                }}
              >
                {/* Header row */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : ch.id)}
                >
                  <span
                    className="mt-0.5 px-2 py-0.5 rounded text-xs font-bold shrink-0"
                    style={{ background: sev.bg, color: sev.color }}
                  >
                    {sev.label}
                  </span>
                  <span
                    className="mt-0.5 px-2 py-0.5 rounded text-xs font-medium shrink-0"
                    style={{ background: '#6366f115', color: '#6366f1' }}
                  >
                    {ch.change_type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
                      {ch.client_name} › {ch.competitor_name}
                    </p>
                    <p className="text-sm mt-0.5 line-clamp-2" style={{ color: '#f1f5f9' }}>
                      {ch.ai_insight ?? ch.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs" style={{ color: '#475569' }}>{timeAgo(ch.created_at)}</p>
                    {ch.reviewed && (
                      <span className="text-xs mt-1 block" style={{ color: '#22c55e' }}>✓ Reviewed</span>
                    )}
                  </div>
                  <span className="text-xs shrink-0 self-center" style={{ color: '#475569' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded diff view */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #1e2130' }}>
                    <div className="p-4 space-y-4">
                      {ch.ai_insight && (
                        <div
                          className="rounded-lg p-3"
                          style={{ background: '#6366f110', border: '1px solid #6366f125' }}
                        >
                          <p className="text-xs font-semibold mb-1" style={{ color: '#6366f1' }}>
                            AI Insight
                          </p>
                          <p className="text-sm" style={{ color: '#f1f5f9' }}>{ch.ai_insight}</p>
                        </div>
                      )}

                      {ch.diff_data && (
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            className="rounded-lg p-3"
                            style={{ background: '#22c55e08', border: '1px solid #22c55e20' }}
                          >
                            <p className="text-xs font-semibold mb-2" style={{ color: '#22c55e' }}>
                              + Added ({ch.diff_data.added.length} terms)
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {ch.diff_data.added.slice(0, 20).map((w, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: '#22c55e15', color: '#22c55e' }}
                                >
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div
                            className="rounded-lg p-3"
                            style={{ background: '#ef444408', border: '1px solid #ef444420' }}
                          >
                            <p className="text-xs font-semibold mb-2" style={{ color: '#ef4444' }}>
                              − Removed ({ch.diff_data.removed.length} terms)
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {ch.diff_data.removed.slice(0, 20).map((w, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: '#ef444415', color: '#ef4444' }}
                                >
                                  {w}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {!ch.reviewed && (
                        <div className="flex justify-end">
                          <button
                            onClick={() => markReviewed(ch.id)}
                            disabled={marking === ch.id}
                            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: '#22c55e' }}
                          >
                            {marking === ch.id ? 'Marking…' : '✓ Mark as Reviewed'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
