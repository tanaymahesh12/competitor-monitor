import { createServerSupabaseClient } from '@/lib/supabase/server'

type ActivityEvent = {
  id: string
  event_text: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ActivityPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!agency) return null

  const { data: events } = await supabase
    .from('activity_feed')
    .select('id, event_text, created_at')
    .eq('agency_id', agency.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const activityEvents = (events ?? []) as ActivityEvent[]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>
          Activity
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
          {activityEvents.length} event{activityEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {activityEvents.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: '#13151c', border: '1px solid #1e2130' }}
        >
          <p className="text-sm" style={{ color: '#475569' }}>
            No activity yet.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#13151c', border: '1px solid #1e2130' }}
        >
          {activityEvents.map((event, index) => (
            <div
              key={event.id}
              className="flex items-start gap-4 px-5 py-4"
              style={{ borderTop: index > 0 ? '1px solid #1e2130' : undefined }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ background: '#6366f1' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: '#f1f5f9' }}>
                  {event.event_text ?? '—'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: '#475569' }}>
                    {formatTimestamp(event.created_at)}
                  </span>
                  <span className="text-xs" style={{ color: '#374151' }}>
                    ·
                  </span>
                  <span className="text-xs" style={{ color: '#475569' }}>
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
