'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Competitor = {
  id: string
  name: string
  url: string
  scan_frequency: string
  last_scraped_at: string | null
  created_at: string
  last_change?: string | null
}

type ClientInfo = {
  id: string
  name: string
  industry: string | null
  website: string | null
}

const FREQ_STYLE: Record<string, { bg: string; color: string }> = {
  daily:  { bg: '#6366f115', color: '#6366f1' },
  weekly: { bg: '#f59e0b15', color: '#f59e0b' },
}

function SkeletonBlock() {
  return (
    <div className="h-4 rounded animate-pulse w-2/3" style={{ background: '#1e2130' }} />
  )
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const clientId = params.id

  const [client, setClient] = useState<ClientInfo | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', scan_frequency: 'weekly' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    const [clientRes, competitorsRes] = await Promise.all([
      supabase.from('clients').select('id, name, industry, website').eq('id', clientId).single(),
      supabase
        .from('competitors')
        .select('id, name, url, scan_frequency, last_scraped_at, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ])

    setClient(clientRes.data)

    const compData = competitorsRes.data ?? []

    // Get last change for each competitor
    const withChanges = await Promise.all(
      compData.map(async (comp) => {
        const { data } = await supabase
          .from('changes')
          .select('created_at')
          .eq('competitor_id', comp.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        return { ...comp, last_change: data?.created_at ?? null }
      })
    )

    setCompetitors(withChanges)
    setLoading(false)
  }, [clientId, supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleAddCompetitor(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) {
      setFormError('Name and URL are required.')
      return
    }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('competitors').insert({
      client_id: clientId,
      name: form.name.trim(),
      url: form.url.trim(),
      scan_frequency: form.scan_frequency,
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setOpen(false)
    setForm({ name: '', url: '', scan_frequency: 'weekly' })
    await loadData()
  }

  async function handleScrape(competitorId: string) {
    setScraping(competitorId)
    try {
      await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId }),
      })
      await loadData()
    } finally {
      setScraping(null)
    }
  }

  async function handleDelete(competitorId: string) {
    if (!confirm('Delete this competitor? All their snapshots and changes will also be removed.')) return
    setDeleting(competitorId)
    await supabase.from('competitors').delete().eq('id', competitorId)
    setCompetitors((prev) => prev.filter((c) => c.id !== competitorId))
    setDeleting(null)
  }

  function timeAgo(iso: string | null | undefined) {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-5" style={{ color: '#475569' }}>
        <Link href="/dashboard/clients" className="hover:underline" style={{ color: '#6366f1' }}>
          Clients
        </Link>
        <span>/</span>
        <span style={{ color: '#94a3b8' }}>{loading ? '…' : (client?.name ?? 'Client')}</span>
      </div>

      {/* Client info */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: '#13151c', border: '1px solid #1e2130' }}
      >
        {loading ? (
          <div className="space-y-2">
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        ) : client ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>{client.name}</h1>
              <div className="flex items-center gap-4 mt-1">
                {client.industry && (
                  <span className="text-sm" style={{ color: '#94a3b8' }}>{client.industry}</span>
                )}
                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                    style={{ color: '#6366f1' }}
                  >
                    {client.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => { setOpen(true); setFormError('') }}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-all"
              style={{ background: '#6366f1' }}
            >
              <span>+</span> Add Competitor
            </button>
          </div>
        ) : (
          <p style={{ color: '#ef4444' }}>Client not found.</p>
        )}
      </div>

      {/* Competitors */}
      <h2 className="text-sm font-semibold mb-3" style={{ color: '#94a3b8' }}>
        Tracked Competitors ({competitors.length})
      </h2>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 h-20 animate-pulse"
              style={{ background: '#13151c', border: '1px solid #1e2130' }}
            />
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#13151c', border: '1px solid #1e2130' }}
        >
          <p className="text-sm" style={{ color: '#475569' }}>
            No competitors tracked yet. Click &quot;Add Competitor&quot; above to start monitoring.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((comp) => {
            const freqStyle = FREQ_STYLE[comp.scan_frequency] ?? FREQ_STYLE.weekly
            return (
              <div
                key={comp.id}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: '#13151c', border: '1px solid #1e2130' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: '#f1f5f9' }}>
                      {comp.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: freqStyle.bg, color: freqStyle.color }}
                    >
                      {comp.scan_frequency}
                    </span>
                  </div>
                  <a
                    href={comp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline truncate block mt-0.5"
                    style={{ color: '#475569' }}
                  >
                    {comp.url}
                  </a>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#475569' }}>
                    <span>Last scraped: {timeAgo(comp.last_scraped_at)}</span>
                    <span>·</span>
                    <span>Last change: {timeAgo(comp.last_change)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleScrape(comp.id)}
                    disabled={scraping === comp.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#6366f1' }}
                  >
                    {scraping === comp.id ? 'Scraping…' : 'Scrape Now'}
                  </button>
                  <button
                    onClick={() => handleDelete(comp.id)}
                    disabled={deleting === comp.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                    style={{ background: '#ef444415', color: '#ef4444' }}
                  >
                    {deleting === comp.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Competitor Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="relative w-full max-w-md rounded-xl p-6 shadow-2xl z-10"
            style={{ background: '#13151c', border: '1px solid #1e2130' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: '#f1f5f9' }}>
              Add Competitor
            </h2>
            <form onSubmit={handleAddCompetitor} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
                  Competitor Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Competitor Inc"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
                  Website URL *
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://competitor.in"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>
                  Scan Frequency
                </label>
                <select
                  value={form.scan_frequency}
                  onChange={(e) => setForm({ ...form, scan_frequency: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
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
                  {saving ? 'Adding…' : 'Add Competitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
