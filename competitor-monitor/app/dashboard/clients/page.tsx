'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Client = {
  id: string
  name: string
  industry: string | null
  website: string | null
  created_at: string
  competitor_count: number
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded animate-pulse"
            style={{ background: '#1e2130', width: i === 1 ? '60%' : i === 5 ? '30%' : '80%' }}
          />
        </td>
      ))}
    </tr>
  )
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [agencyId, setAgencyId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', industry: '', website: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!agency) return
    setAgencyId(agency.id)

    const { data } = await supabase
      .from('clients')
      .select('id, name, industry, website, created_at')
      .eq('agency_id', agency.id)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Count competitors per client
    const withCounts = await Promise.all(
      data.map(async (c) => {
        const { count } = await supabase
          .from('competitors')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', c.id)
        return { ...c, competitor_count: count ?? 0 }
      })
    )
    setClients(withCounts)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Name is required.'); return }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('clients').insert({
      agency_id: agencyId,
      name: form.name.trim(),
      industry: form.industry.trim() || null,
      website: form.website.trim() || null,
    })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setOpen(false)
    setForm({ name: '', industry: '', website: '' })
    await loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this client and all their competitors? This cannot be undone.')) return
    setDeleting(id)
    await supabase.from('clients').delete().eq('id', id)
    setClients((prev) => prev.filter((c) => c.id !== id))
    setDeleting(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Clients</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
            {clients.length} client{clients.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button
          onClick={() => { setOpen(true); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: '#6366f1' }}
        >
          <span>+</span> Add Client
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#13151c', border: '1px solid #1e2130' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1e2130' }}>
              {['Client Name', 'Industry', 'Website', 'Competitors', 'Added', ''].map((h) => (
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
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : clients.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: '#475569' }}>
                    No clients yet. Click &quot;Add Client&quot; to get started.
                  </td>
                </tr>
              )
              : clients.map((client) => (
                <tr
                  key={client.id}
                  style={{ borderTop: '1px solid #1e2130' }}
                  className="transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium" style={{ color: '#f1f5f9' }}>
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="hover:underline"
                      style={{ color: '#6366f1' }}
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                    {client.industry ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {client.website ? (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-xs"
                        style={{ color: '#94a3b8' }}
                      >
                        {client.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span style={{ color: '#475569' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                    {client.competitor_count}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
                    {formatDate(client.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(client.id)}
                      disabled={deleting === client.id}
                      className="text-xs px-2 py-1 rounded transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ background: '#ef444415', color: '#ef4444' }}
                    >
                      {deleting === client.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Add Client Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className="relative w-full max-w-md rounded-xl p-6 shadow-2xl z-10"
            style={{ background: '#13151c', border: '1px solid #1e2130' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: '#f1f5f9' }}>
              Add New Client
            </h2>
            <form onSubmit={handleAdd} className="space-y-3">
              {[
                { id: 'name', label: 'Client Name *', ph: 'Acme Digital' },
                { id: 'industry', label: 'Industry', ph: 'E-commerce' },
                { id: 'website', label: 'Website', ph: 'https://acme.in' },
              ].map(({ id, label, ph }) => (
                <div key={id}>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>{label}</label>
                  <input
                    type={id === 'website' ? 'url' : 'text'}
                    value={form[id as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [id]: e.target.value })}
                    placeholder={ph}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                  />
                </div>
              ))}
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
                  {saving ? 'Adding…' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
