import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Target,
  RefreshCw,
  Bell,
  Mail,
  Activity,
  Settings,
} from "lucide-react"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { LogoutButton } from "./LogoutButton"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Clients", href: "/dashboard/clients" },
  { icon: Target, label: "Competitors", href: "/dashboard/competitors" },
  { icon: RefreshCw, label: "Changes", href: "/dashboard/changes" },
  { icon: Bell, label: "Alerts", href: "/dashboard/alerts" },
  { icon: Mail, label: "Digests", href: "/dashboard/digests" },
  { icon: Activity, label: "Activity", href: "/dashboard/activity" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

type ChangeRow = {
  id: string
  change_type: string
  severity: string
  ai_insight: string | null
  description: string | null
  created_at: string
  competitors: { name: string } | { name: string }[] | null
}

function getSeverityStyles(severity: string) {
  switch (severity) {
    case "high":
      return "bg-[#3b1219] text-[#f87171]"
    case "medium":
      return "bg-[#3b2f1a] text-[#fbbf24]"
    case "low":
      return "bg-[#1a3b2a] text-[#4ade80]"
    default:
      return "bg-[#1a1d27] text-[#6b7280]"
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export async function Dashboard() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id")
    .eq("email", user.email)
    .single()

  console.log("[Dashboard] agency query:", { email: user.email, agency, error: agencyError?.message })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let clientIds: string[] = []
  let competitorIds: string[] = []
  let alertIds: string[] = []
  let clientCount = 0
  let competitorCount = 0
  let changesThisWeek = 0
  let changesData: ChangeRow[] = []
  let alertsThisWeek = 0

  if (agency) {
    // Client IDs for this agency
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id")
      .eq("agency_id", agency.id)
    clientIds = clientRows?.map((c) => c.id) ?? []

    // Competitor IDs for this agency
    if (clientIds.length > 0) {
      const { data: compRows } = await supabase
        .from("competitors")
        .select("id")
        .in("client_id", clientIds)
      competitorIds = compRows?.map((c) => c.id) ?? []
    }

    // Alert IDs for this agency
    const { data: alertRows } = await supabase
      .from("alerts")
      .select("id")
      .eq("agency_id", agency.id)
    alertIds = alertRows?.map((a) => a.id) ?? []

    // Stat counts
    const { count: cc } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id)
    clientCount = cc ?? 0

    if (clientIds.length > 0) {
      const { count } = await supabase
        .from("competitors")
        .select("id", { count: "exact", head: true })
        .in("client_id", clientIds)
      competitorCount = count ?? 0
    }

    if (competitorIds.length > 0) {
      const [changesCountRes, changesDataRes] = await Promise.all([
        supabase
          .from("changes")
          .select("id", { count: "exact", head: true })
          .in("competitor_id", competitorIds)
          .gte("created_at", weekAgo),
        supabase
          .from("changes")
          .select("id, change_type, severity, ai_insight, description, created_at, competitors(name)")
          .in("competitor_id", competitorIds)
          .order("created_at", { ascending: false })
          .limit(5),
      ])
      changesThisWeek = changesCountRes.count ?? 0
      changesData = (changesDataRes.data ?? []) as ChangeRow[]
    }

    if (alertIds.length > 0) {
      const { count } = await supabase
        .from("alert_triggers")
        .select("id", { count: "exact", head: true })
        .in("alert_id", alertIds)
        .gte("created_at", weekAgo)
      alertsThisWeek = count ?? 0
    }
  }

  const stats = [
    { label: "Total Clients", value: String(clientCount) },
    { label: "Competitors Tracked", value: String(competitorCount) },
    { label: "Changes This Week", value: String(changesThisWeek) },
    { label: "Alerts Fired", value: String(alertsThisWeek) },
  ]

  const recentChanges = changesData.map((c) => {
    const comp = Array.isArray(c.competitors) ? c.competitors[0] : c.competitors
    return {
      id: c.id,
      competitor: comp?.name ?? "—",
      changeType: c.change_type,
      severity: c.severity,
      insight: c.ai_insight ?? c.description ?? "—",
      detected: timeAgo(c.created_at),
    }
  })

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside className="w-[220px] h-full bg-[#0f1117] border-r border-[#1e2130] flex flex-col">
        {/* Logo */}
        <div className="px-4 pt-5 pb-10">
          <div className="flex items-center gap-2.5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="2" y="2" width="28" height="28" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              <line x1="2" y1="11" x2="30" y2="11" stroke="#ffffff" strokeWidth="1" />
              <line x1="2" y1="21" x2="30" y2="21" stroke="#ffffff" strokeWidth="1" />
              <line x1="11" y1="2" x2="11" y2="30" stroke="#ffffff" strokeWidth="1" />
              <line x1="21" y1="2" x2="21" y2="30" stroke="#ffffff" strokeWidth="1" />
              <line x1="16" y1="6" x2="16" y2="12" stroke="#8b1a1a" strokeWidth="2" />
              <line x1="16" y1="20" x2="16" y2="26" stroke="#8b1a1a" strokeWidth="2" />
              <line x1="6" y1="16" x2="12" y2="16" stroke="#8b1a1a" strokeWidth="2" />
              <line x1="20" y1="16" x2="26" y2="16" stroke="#8b1a1a" strokeWidth="2" />
              <rect x="14" y="14" width="4" height="4" fill="#8b1a1a" />
            </svg>
            <span className="text-white text-sm font-semibold">SpyGrid</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 w-full h-9 px-3 rounded-md text-[13px] transition-colors ${
                  item.href === "/dashboard"
                    ? "bg-[#1a1d27] text-white"
                    : "text-[#6b7280] hover:bg-[#13151c]"
                }`}
              >
                <item.icon size={16} strokeWidth={1.5} />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-[#1e2130]">
          <p className="text-[12px] text-[#6b7280] truncate">{user.email}</p>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-white text-xl font-semibold">Dashboard</h1>
            <p className="text-[#6b7280] text-[13px] mt-1">
              Good morning, here&apos;s what changed this week
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-[#111114] border border-[#1e2130] rounded-lg p-5"
              >
                <p className="text-white text-[28px] font-semibold">{stat.value}</p>
                <p className="text-[#6b7280] text-[12px] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Recent Changes Table */}
          <div>
            <h2 className="text-white text-sm font-medium mb-4">Recent Changes</h2>
            <div className="bg-[#111114] border border-[#1e2130] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1d27]">
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Competitor
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Change Type
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Severity
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      AI Insight
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Detected
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentChanges.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-[13px] text-[#6b7280]"
                      >
                        No changes yet
                      </td>
                    </tr>
                  ) : (
                    recentChanges.map((change) => (
                      <tr
                        key={change.id}
                        className="border-b border-[#1a1d27] last:border-b-0 hover:bg-[#0f1117] transition-colors"
                      >
                        <td className="px-4 py-3 text-[13px] text-[#94a3b8]">
                          {change.competitor}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-[#1a1d27] text-[#94a3b8]">
                            {change.changeType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block text-[11px] px-2 py-0.5 rounded ${getSeverityStyles(change.severity)}`}
                          >
                            {change.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#94a3b8] max-w-[300px] truncate">
                          {change.insight}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#6b7280]">
                          {change.detected}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
