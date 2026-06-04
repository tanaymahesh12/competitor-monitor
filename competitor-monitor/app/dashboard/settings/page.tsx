import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SettingsPage } from '@/components/settings-page'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

interface AgencyRow {
  id: string
  name: string
  email: string
  plan: 'starter' | 'agency' | 'scale'
  logo_url: string | null
  brand_color: string
  created_at: string
}

const FALLBACK_AGENCY: AgencyRow = {
  id: '',
  name: 'My Agency',
  email: '',
  plan: 'starter',
  logo_url: null,
  brand_color: '#6366f1',
  created_at: new Date().toISOString(),
}

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return <SettingsPage agency={{ ...FALLBACK_AGENCY, email: '' }} userEmail="" />
  }

  const agencyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/agencies?select=id,name,email,plan,logo_url,brand_color,created_at&email=eq.${encodeURIComponent(user.email)}&limit=1`,
    { headers: serviceHeaders(), cache: 'no-store' }
  )
  const agencies: AgencyRow[] = agencyRes.ok ? await agencyRes.json() : []
  console.log('[settings/page] agency lookup for', user.email, '→', agencies.length, 'rows')

  const agency = agencies[0] ?? { ...FALLBACK_AGENCY, email: user.email }

  return <SettingsPage agency={agency} userEmail={user.email} />
}
