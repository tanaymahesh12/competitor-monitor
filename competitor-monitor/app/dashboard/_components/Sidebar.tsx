'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/dashboard/clients', label: 'Clients', icon: '◈' },
  { href: '/dashboard/competitors', label: 'Competitors', icon: '◎' },
  { href: '/dashboard/changes', label: 'Changes', icon: '⟳' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: '◬' },
  { href: '/dashboard/digests', label: 'Digests', icon: '≡' },
  { href: '/dashboard/activity', label: 'Activity', icon: '⚡' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-screen overflow-y-auto"
      style={{ background: '#0f1117', borderRight: '1px solid #1e2130' }}
    >
      {/* Logo */}
      <div className="px-4 pt-6 pb-5" style={{ borderBottom: '1px solid #1e2130' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: '#6366f1' }}
          >
            S
          </div>
          <span className="font-bold text-base tracking-tight" style={{ color: '#f1f5f9' }}>
            SpyGrid
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100"
              style={{
                background: active ? '#6366f118' : 'transparent',
                color: active ? '#6366f1' : '#94a3b8',
                borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
              }}
            >
              <span className="text-base leading-none w-4 text-center">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid #1e2130' }}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: '#6366f120', color: '#6366f1' }}
          >
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <span
            className="text-xs truncate flex-1"
            style={{ color: '#94a3b8' }}
            title={userEmail}
          >
            {userEmail}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all duration-100 hover:opacity-80"
          style={{
            background: '#ef444415',
            color: '#ef4444',
            border: '1px solid #ef444425',
          }}
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
