"use client"

import { useState } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Target,
  RefreshCw,
  Bell,
  Settings,
  LogOut,
  Trash2,
  X,
  ChevronDown,
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

interface Competitor {
  id: string
  name: string
  url: string
  is_active: boolean
  scan_frequency: string
  created_at: string
  client_name: string
  last_scraped: string | null
  last_change: string | null
}

interface Client {
  id: string
  name: string
}

interface CompetitorsPageProps {
  initialCompetitors: Competitor[]
  initialClients: Client[]
  userEmail: string
}

export function CompetitorsPage({
  initialCompetitors,
  initialClients,
  userEmail,
}: CompetitorsPageProps) {
  const [competitors] = useState<Competitor[]>(initialCompetitors)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [scrapingId, setScrapingId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState<string>("all")
  const [newCompetitor, setNewCompetitor] = useState({
    name: "",
    url: "",
    client_id: initialClients[0]?.id || "",
    scan_frequency: "weekly",
  })

  const filteredCompetitors =
    clientFilter === "all"
      ? competitors
      : competitors.filter((c) => c.client_name === clientFilter)

  const handleAddCompetitor = async () => {
    if (!newCompetitor.name || !newCompetitor.url || !newCompetitor.client_id) return

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCompetitor),
      })

      if (res.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to add competitor:", error)
    }
  }

  const handleDeleteCompetitor = async (id: string) => {
    try {
      const res = await fetch(`/api/competitors?id=${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to delete competitor:", error)
    }
  }

  const handleScrapeNow = async (competitorId: string) => {
    setScrapingId(competitorId)
    try {
      await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId }),
      })
    } catch (error) {
      console.error("Failed to trigger scrape:", error)
    } finally {
      setScrapingId(null)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const uniqueClientNames = Array.from(new Set(competitors.map((c) => c.client_name)))

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
              <rect
                x="2"
                y="2"
                width="28"
                height="28"
                stroke="#ffffff"
                strokeWidth="1.5"
                fill="none"
              />
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
                  item.href === "/dashboard/competitors"
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
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-[#f1f5f9] text-xl font-semibold">Competitors</h1>
              <p className="text-[#6b7280] text-[13px] mt-1">
                Track competitor websites across all your clients
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors"
            >
              Add Competitor
            </button>
          </div>

          {/* Filter */}
          <div className="mb-6">
            <div className="relative inline-block">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="h-9 pl-3 pr-8 bg-[#111114] border border-[#1e2130] rounded-md text-[13px] text-[#f1f5f9] focus:border-[#3a3a45] focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All Clients</option>
                {uniqueClientNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none"
              />
            </div>
          </div>

          {/* Competitors Table */}
          {filteredCompetitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-[#6b7280] text-[14px]">No competitors yet.</p>
            </div>
          ) : (
            <div className="bg-[#111114] border border-[#1e2130] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1d27]">
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Name
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      URL
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Client
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Last Scraped
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Last Change
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Scan Frequency
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetitors.map((competitor) => (
                    <tr
                      key={competitor.id}
                      className="border-b border-[#1a1d27] last:border-b-0 hover:bg-[#0f1117] transition-colors"
                    >
                      <td className="px-4 py-3 text-[13px] text-[#f1f5f9] font-medium">
                        {competitor.name}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#94a3b8]">
                        {competitor.url}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#94a3b8]">
                        {competitor.client_name}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6b7280]">
                        {formatDate(competitor.last_scraped)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6b7280]">
                        {formatDate(competitor.last_change)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-[#1a1d27] text-[#94a3b8]">
                          {competitor.scan_frequency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[11px] px-2 py-0.5 rounded ${
                            competitor.is_active
                              ? "bg-[#1a3b2a] text-[#4ade80]"
                              : "bg-[#1a1d27] text-[#6b7280]"
                          }`}
                        >
                          {competitor.is_active ? "active" : "paused"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleScrapeNow(competitor.id)}
                            disabled={scrapingId === competitor.id}
                            className="text-[12px] text-[#94a3b8] hover:text-white transition-colors disabled:opacity-50"
                          >
                            {scrapingId === competitor.id ? "Scraping..." : "Scrape Now"}
                          </button>
                          {deleteConfirmId === competitor.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteCompetitor(competitor.id)}
                                className="text-[12px] text-[#f87171] hover:text-[#fca5a5] transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-[12px] text-[#6b7280] hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(competitor.id)}
                              className="text-[#6b7280] hover:text-[#f87171] transition-colors"
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[420px] bg-[#111114] border border-[#1e2130] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[#f1f5f9] text-[15px] font-semibold">
                Add Competitor
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6b7280] hover:text-white transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Name</label>
                <input
                  type="text"
                  value={newCompetitor.name}
                  onChange={(e) =>
                    setNewCompetitor({ ...newCompetitor, name: e.target.value })
                  }
                  placeholder="Competitor name"
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] placeholder:text-[#444450] focus:border-[#3a3a45] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">URL</label>
                <input
                  type="text"
                  value={newCompetitor.url}
                  onChange={(e) =>
                    setNewCompetitor({ ...newCompetitor, url: e.target.value })
                  }
                  placeholder="https://"
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] placeholder:text-[#444450] focus:border-[#3a3a45] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Client</label>
                <div className="relative">
                  <select
                    value={newCompetitor.client_id}
                    onChange={(e) =>
                      setNewCompetitor({ ...newCompetitor, client_id: e.target.value })
                    }
                    className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 pr-8 text-[13px] text-[#f1f5f9] focus:border-[#3a3a45] focus:outline-none transition-colors appearance-none cursor-pointer"
                  >
                    {initialClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] pointer-events-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Scan Frequency</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setNewCompetitor({ ...newCompetitor, scan_frequency: "daily" })
                    }
                    className={`h-9 px-4 text-[13px] rounded-md transition-colors ${
                      newCompetitor.scan_frequency === "daily"
                        ? "bg-white text-black"
                        : "bg-[#0a0a0f] border border-[#1e2130] text-[#6b7280] hover:text-white"
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() =>
                      setNewCompetitor({ ...newCompetitor, scan_frequency: "weekly" })
                    }
                    className={`h-9 px-4 text-[13px] rounded-md transition-colors ${
                      newCompetitor.scan_frequency === "weekly"
                        ? "bg-white text-black"
                        : "bg-[#0a0a0f] border border-[#1e2130] text-[#6b7280] hover:text-white"
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="h-9 px-4 text-[13px] text-[#6b7280] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCompetitor}
                className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
