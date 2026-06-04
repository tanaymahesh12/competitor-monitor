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

const industries = [
  "E-commerce",
  "Food & Beverage",
  "Healthcare",
  "Finance",
  "Real Estate",
  "Other",
]

interface Client {
  id: string
  name: string
  industry: string | null
  website: string | null
  competitor_count: number
  created_at: string
}

interface ClientsPageProps {
  initialClients: Client[]
  initialUserEmail: string
  initialAgencyId: string
}

export function ClientsPage({ initialClients, initialUserEmail }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [userEmail] = useState<string>(initialUserEmail)
  const [loading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [newClient, setNewClient] = useState({
    name: "",
    industry: "E-commerce",
    website: "",
  })

  async function handleAddClient() {
    if (!newClient.name.trim()) {
      setFormError("Name is required.")
      return
    }
    setSaving(true)
    setFormError("")

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClient.name.trim(),
        industry: newClient.industry || null,
        website: newClient.website.trim() || null,
      }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setFormError(json.error ?? "Failed to add client")
      return
    }

    setNewClient({ name: "", industry: "E-commerce", website: "" })
    setShowAddModal(false)
    window.location.reload()
  }

  async function handleDeleteClient(id: string) {
    setDeleting(id)
    await fetch(`/api/clients?id=${id}`, { method: "DELETE" })
    setClients((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirmId(null)
    setDeleting(null)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

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
                  item.href === "/dashboard/clients"
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
              <h1 className="text-[#f1f5f9] text-xl font-semibold">Clients</h1>
              <p className="text-[#6b7280] text-[13px] mt-1">
                Manage your clients and their competitor tracking
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddModal(true)
                setFormError("")
              }}
              className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors"
            >
              Add Client
            </button>
          </div>

          {/* Clients Table */}
          {loading ? (
            <div className="bg-[#111114] border border-[#1e2130] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1d27]">
                    {["Name", "Industry", "Website", "Competitors Tracked", "Added", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1a1d27] last:border-b-0">
                      {[60, 50, 70, 30, 40, 20].map((w, j) => (
                        <td key={j} className="px-4 py-3">
                          <div
                            className="h-4 rounded animate-pulse"
                            style={{ background: "#1e2130", width: `${w}%` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-[#6b7280] text-[14px] mb-4">No clients yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors"
              >
                Add Client
              </button>
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
                      Industry
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Website
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Competitors Tracked
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Added
                    </th>
                    <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-[#1a1d27] last:border-b-0 hover:bg-[#0f1117] transition-colors"
                    >
                      <td className="px-4 py-3 text-[13px] text-[#f1f5f9] font-medium">
                        {client.name}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#94a3b8]">
                        {client.industry ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#94a3b8]">
                        {client.website ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#94a3b8]">
                        {client.competitor_count}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6b7280]">
                        {formatDate(client.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {deleteConfirmId === client.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDeleteClient(client.id)}
                                disabled={deleting === client.id}
                                className="text-[12px] text-[#f87171] hover:text-[#fca5a5] transition-colors disabled:opacity-40"
                              >
                                {deleting === client.id ? "…" : "Confirm"}
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
                              onClick={() => setDeleteConfirmId(client.id)}
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

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[420px] bg-[#111114] border border-[#1e2130] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[#f1f5f9] text-[15px] font-semibold">Add Client</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6b7280] hover:text-white transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Client Name *</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Acme Digital"
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] placeholder:text-[#444450] focus:border-[#3a3a45] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Industry</label>
                <select
                  value={newClient.industry}
                  onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] focus:border-[#3a3a45] focus:outline-none transition-colors appearance-none cursor-pointer"
                >
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Website URL</label>
                <input
                  type="text"
                  value={newClient.website}
                  onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
                  placeholder="https://acme.in"
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] placeholder:text-[#444450] focus:border-[#3a3a45] focus:outline-none transition-colors"
                />
              </div>

              {formError && (
                <p className="text-[12px] text-[#ef4444]">{formError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="h-9 px-4 text-[13px] text-[#6b7280] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClient}
                disabled={saving}
                className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors disabled:opacity-50"
              >
                {saving ? "Adding…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
