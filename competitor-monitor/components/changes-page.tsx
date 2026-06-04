"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Target,
  RefreshCw,
  Bell,
  Settings,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Clients", href: "/dashboard/clients" },
  { icon: Target, label: "Competitors", href: "/dashboard/competitors" },
  { icon: RefreshCw, label: "Changes", href: "/dashboard/changes" },
  { icon: Bell, label: "Alerts", href: "/dashboard/alerts" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

export interface Change {
  id: string
  change_type: string
  severity: "low" | "medium" | "high"
  description: string | null
  ai_insight: string | null
  diff_data: { added: string[]; removed: string[]; changePercent: number } | null
  is_reviewed: boolean
  created_at: string
  competitor_name: string
  competitor_url: string
  client_name: string
}

export interface Client {
  id: string
  name: string
}

export interface Competitor {
  id: string
  name: string
  url: string
}

interface ChangesPageProps {
  initialChanges: Change[]
  initialClients: Client[]
  initialCompetitors: Competitor[]
  userEmail: string
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
  high:   { bg: "#ef444415", color: "#ef4444", label: "High" },
  medium: { bg: "#f59e0b15", color: "#f59e0b", label: "Medium" },
  low:    { bg: "#22c55e15", color: "#22c55e", label: "Low" },
}

const CHANGE_TYPES = ["copy_change", "tech_change", "new_page", "pricing_change", "initial_scan"]

const selectStyle: React.CSSProperties = {
  background: "#0f1117",
  border: "1px solid #1e2130",
  color: "#94a3b8",
  borderRadius: "8px",
  padding: "6px 10px",
  fontSize: "13px",
  outline: "none",
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ChangesPage({
  initialChanges,
  initialClients,
  initialCompetitors,
  userEmail,
}: ChangesPageProps) {
  const [changes, setChanges] = useState<Change[]>(initialChanges)
  const [filtered, setFiltered] = useState<Change[]>(initialChanges)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    client: "", competitor: "", severity: "", change_type: "", from: "", to: "",
  })

  useEffect(() => {
    let result = changes
    if (filters.client) result = result.filter((c) => c.client_name === filters.client)
    if (filters.competitor) result = result.filter((c) => c.competitor_name === filters.competitor)
    if (filters.severity) result = result.filter((c) => c.severity === filters.severity)
    if (filters.change_type) result = result.filter((c) => c.change_type === filters.change_type)
    if (filters.from) result = result.filter((c) => new Date(c.created_at) >= new Date(filters.from))
    if (filters.to) result = result.filter((c) => new Date(c.created_at) <= new Date(filters.to + "T23:59:59"))
    setFiltered(result)
  }, [changes, filters])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  async function markReviewed(id: string) {
    setMarking(id)
    try {
      await fetch("/api/changes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setChanges((prev) => prev.map((c) => c.id === id ? { ...c, is_reviewed: true } : c))
    } catch (err) {
      console.error("Failed to mark reviewed:", err)
    } finally {
      setMarking(null)
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside className="w-[220px] h-full bg-[#0f1117] border-r border-[#1e2130] flex flex-col">
        <div className="px-4 pt-5 pb-10">
          <div className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        <nav className="flex-1 px-3">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 w-full h-9 px-3 rounded-md text-[13px] transition-colors ${
                  item.href === "/dashboard/changes"
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

        <div className="px-4 py-4 border-t border-[#1e2130]">
          <p className="text-[12px] text-[#6b7280] truncate">{userEmail}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-[12px] text-[#6b7280] hover:text-white mt-2 transition-colors"
          >
            <LogOut size={14} strokeWidth={1.5} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold" style={{ color: "#f1f5f9" }}>Changes</h1>
            <p className="text-sm mt-0.5" style={{ color: "#94a3b8" }}>
              {filtered.length} change{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {/* Filter bar */}
          <div
            className="rounded-xl p-4 mb-5 flex flex-wrap gap-3"
            style={{ background: "#13151c", border: "1px solid #1e2130" }}
          >
            <select
              style={selectStyle}
              value={filters.client}
              onChange={(e) => setFilters({ ...filters, client: e.target.value })}
            >
              <option value="">All Clients</option>
              {initialClients.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              style={selectStyle}
              value={filters.competitor}
              onChange={(e) => setFilters({ ...filters, competitor: e.target.value })}
            >
              <option value="">All Competitors</option>
              {initialCompetitors.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              style={selectStyle}
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            >
              <option value="">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              style={selectStyle}
              value={filters.change_type}
              onChange={(e) => setFilters({ ...filters, change_type: e.target.value })}
            >
              <option value="">All Types</option>
              {CHANGE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
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
                onClick={() => setFilters({ client: "", competitor: "", severity: "", change_type: "", from: "", to: "" })}
                className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: "#1e2130", color: "#94a3b8" }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Changes list */}
          {filtered.length === 0 ? (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: "#13151c", border: "1px solid #1e2130" }}
            >
              <p className="text-sm" style={{ color: "#475569" }}>No changes match your filters.</p>
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
                      background: "#13151c",
                      border: `1px solid ${isExpanded ? "#6366f140" : "#1e2130"}`,
                      opacity: ch.is_reviewed ? 0.65 : 1,
                    }}
                  >
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
                        style={{ background: "#6366f115", color: "#6366f1" }}
                      >
                        {ch.change_type.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                          {ch.client_name} › {ch.competitor_name}
                          {ch.competitor_url && (
                            <a
                              href={ch.competitor_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2 underline hover:opacity-80"
                              style={{ color: "#6366f1" }}
                            >
                              ↗
                            </a>
                          )}
                        </p>
                        <p className="text-sm mt-0.5 line-clamp-2" style={{ color: "#f1f5f9" }}>
                          {ch.ai_insight ?? ch.description}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs" style={{ color: "#475569" }}>{timeAgo(ch.created_at)}</p>
                        {ch.is_reviewed && (
                          <span className="text-xs mt-1 block" style={{ color: "#22c55e" }}>✓ Reviewed</span>
                        )}
                      </div>
                      <span className="text-xs shrink-0 self-center" style={{ color: "#475569" }}>
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #1e2130" }}>
                        <div className="p-4 space-y-4">
                          {ch.ai_insight && (
                            <div
                              className="rounded-lg p-3"
                              style={{ background: "#6366f110", border: "1px solid #6366f125" }}
                            >
                              <p className="text-xs font-semibold mb-1" style={{ color: "#6366f1" }}>
                                AI Insight
                              </p>
                              <p className="text-sm" style={{ color: "#f1f5f9" }}>{ch.ai_insight}</p>
                            </div>
                          )}

                          {ch.diff_data && (
                            <div className="grid grid-cols-2 gap-3">
                              <div
                                className="rounded-lg p-3"
                                style={{ background: "#22c55e08", border: "1px solid #22c55e20" }}
                              >
                                <p className="text-xs font-semibold mb-2" style={{ color: "#22c55e" }}>
                                  + Added ({ch.diff_data.added.length} terms)
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {ch.diff_data.added.slice(0, 20).map((w, i) => (
                                    <span
                                      key={i}
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: "#22c55e15", color: "#22c55e" }}
                                    >
                                      {w}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div
                                className="rounded-lg p-3"
                                style={{ background: "#ef444408", border: "1px solid #ef444420" }}
                              >
                                <p className="text-xs font-semibold mb-2" style={{ color: "#ef4444" }}>
                                  − Removed ({ch.diff_data.removed.length} terms)
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {ch.diff_data.removed.slice(0, 20).map((w, i) => (
                                    <span
                                      key={i}
                                      className="text-xs px-1.5 py-0.5 rounded"
                                      style={{ background: "#ef444415", color: "#ef4444" }}
                                    >
                                      {w}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {!ch.is_reviewed && (
                            <div className="flex justify-end">
                              <button
                                onClick={() => markReviewed(ch.id)}
                                disabled={marking === ch.id}
                                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ background: "#22c55e" }}
                              >
                                {marking === ch.id ? "Marking…" : "✓ Mark as Reviewed"}
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
      </main>
    </div>
  )
}
