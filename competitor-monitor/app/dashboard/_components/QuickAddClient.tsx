'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function QuickAddClient({ agencyId }: { agencyId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('clients').insert({
      agency_id: agencyId,
      name,
      industry,
      website,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setOpen(false)
    setName(''); setIndustry(''); setWebsite('')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
        style={{ background: '#6366f1' }}
      >
        <span className="text-base leading-none">+</span> Add Client
      </button>

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
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { id: 'name', label: 'Client Name', value: name, set: setName, placeholder: 'Acme Digital', required: true },
                { id: 'industry', label: 'Industry', value: industry, set: setIndustry, placeholder: 'E-commerce', required: false },
                { id: 'website', label: 'Website', value: website, set: setWebsite, placeholder: 'https://acme.in', required: false },
              ].map(({ id, label, value, set, placeholder, required }) => (
                <div key={id}>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#94a3b8' }}>{label}</label>
                  <input
                    id={id}
                    type={id === 'website' ? 'url' : 'text'}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    required={required}
                    placeholder={placeholder}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    style={{ background: '#0f1117', border: '1px solid #1e2130', color: '#f1f5f9' }}
                  />
                </div>
              ))}
              {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                  style={{ background: '#1e2130', color: '#94a3b8' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#6366f1' }}
                >
                  {loading ? 'Adding…' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
