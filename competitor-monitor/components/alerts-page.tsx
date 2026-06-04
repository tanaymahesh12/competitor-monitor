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
  Check,
  Minus,
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

const alertTypeLabels: Record<string, string> = {
  pricing_change: "Pricing Change",
  copy_change: "Copy Change",
  seo_change: "SEO Change",
  tech_change: "Tech Change",
  new_page: "New Page",
}

export interface Alert {
  id: string
  alert_type: string
  condition_value: string
  notify_email: boolean
  notify_whatsapp: boolean
  is_active: boolean
  created_at: string
  competitor_name: string
}

export interface Trigger {
  id: string
  alert_id: string
  triggered_at: string
  message: string
  competitor_name: string
  alert_type: string
}

export interface Competitor {
  id: string
  name: string
}

interface AlertsPageProps {
  initialAlerts: Alert[]
  initialTriggers: Trigger[]
  initialCompetitors: Competitor[]
  userEmail: string
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "1d ago"
  return `${diffDays}d ago`
}

export function AlertsPage({
  initialAlerts,
  initialTriggers,
  initialCompetitors,
  userEmail,
}: AlertsPageProps) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [triggers] = useState<Trigger[]>(initialTriggers)
  const [competitors] = useState<Competitor[]>(initialCompetitors)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAlert, setNewAlert] = useState({
    competitor_id: "",
    alert_type: "pricing_change",
    notify_email: true,
    notify_whatsapp: false,
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  const handleToggleActive = async (alertId: string, currentState: boolean) => {
    setAlerts(alerts.map((a) => a.id === alertId ? { ...a, is_active: !currentState } : a))
    try {
      await fetch(`/api/alerts?id=${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentState }),
      })
    } catch (error) {
      console.error("Failed to toggle alert:", error)
      setAlerts(alerts.map((a) => a.id === alertId ? { ...a, is_active: currentState } : a))
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    const previousAlerts = [...alerts]
    setAlerts(alerts.filter((a) => a.id !== alertId))
    try {
      const response = await fetch(`/api/alerts?id=${alertId}`, { method: "DELETE" })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to delete alert:", error)
      setAlerts(previousAlerts)
    }
  }

  const handleCreateAlert = async () => {
    if (!newAlert.competitor_id) return
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAlert),
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to create alert:", error)
    }
    setShowAddModal(false)
    setNewAlert({ competitor_id: "", alert_type: "pricing_change", notify_email: true, notify_whatsapp: false })
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
                  item.href === "/dashboard/alerts"
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
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-[#f1f5f9] text-xl font-semibold">Alerts</h1>
              <p className="text-[#6b7280] text-[13px] mt-1">
                Get notified when competitors make important changes
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors"
            >
              Create Alert
            </button>
          </div>

          {/* Active Alerts */}
          <div className="mb-10">
            <h2 className="text-[13px] text-[#6b7280] uppercase tracking-wide font-medium mb-4">
              Active Alerts
            </h2>

            {alerts.length === 0 ? (
              <div className="bg-[#111114] border border-[#1e2130] rounded-lg p-8">
                <p className="text-[#6b7280] text-[14px] text-center">
                  No alerts set up yet.
                </p>
              </div>
            ) : (
              <div className="bg-[#111114] border border-[#1e2130] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1a1d27]">
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Competitor</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Alert Type</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Email Notify</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Active</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className="border-b border-[#1a1d27] last:border-b-0 hover:bg-[#0f1117] transition-colors"
                      >
                        <td className="px-4 py-3 text-[13px] text-[#f1f5f9] font-medium">
                          {alert.competitor_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-[#1a1d27] text-[#94a3b8]">
                            {alertTypeLabels[alert.alert_type] || alert.alert_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {alert.notify_email ? (
                            <Check size={16} className="text-[#4ade80]" strokeWidth={2} />
                          ) : (
                            <Minus size={16} className="text-[#6b7280]" strokeWidth={2} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(alert.id, alert.is_active)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              alert.is_active ? "bg-[#4ade80]" : "bg-[#2a2a32]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                alert.is_active ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="text-[#6b7280] hover:text-[#f87171] transition-colors"
                          >
                            <Trash2 size={14} strokeWidth={1.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Triggers */}
          <div>
            <h2 className="text-[13px] text-[#6b7280] uppercase tracking-wide font-medium mb-4">
              Recent Triggers
            </h2>

            {triggers.length === 0 ? (
              <div className="bg-[#111114] border border-[#1e2130] rounded-lg p-8">
                <p className="text-[#6b7280] text-[14px] text-center">
                  No alerts have fired yet.
                </p>
              </div>
            ) : (
              <div className="bg-[#111114] border border-[#1e2130] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1a1d27]">
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Competitor</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Alert Type</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Message</th>
                      <th className="text-left text-[12px] text-[#6b7280] font-medium px-4 py-3">Triggered At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {triggers.map((trigger) => (
                      <tr
                        key={trigger.id}
                        className="border-b border-[#1a1d27] last:border-b-0 hover:bg-[#0f1117] transition-colors"
                      >
                        <td className="px-4 py-3 text-[13px] text-[#f1f5f9] font-medium">
                          {trigger.competitor_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-[11px] px-2 py-0.5 rounded bg-[#1a1d27] text-[#94a3b8]">
                            {alertTypeLabels[trigger.alert_type] || trigger.alert_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#94a3b8] max-w-[400px] truncate">
                          {trigger.message}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#6b7280]">
                          {formatRelativeTime(trigger.triggered_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Alert Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-[420px] bg-[#111114] border border-[#1e2130] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[#f1f5f9] text-[15px] font-semibold">Create Alert</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#6b7280] hover:text-white transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Select Competitor</label>
                <select
                  value={newAlert.competitor_id}
                  onChange={(e) => setNewAlert({ ...newAlert, competitor_id: e.target.value })}
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] focus:border-[#3a3a45] focus:outline-none transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Choose a competitor</option>
                  {competitors.map((competitor) => (
                    <option key={competitor.id} value={competitor.id}>
                      {competitor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Alert Type</label>
                <select
                  value={newAlert.alert_type}
                  onChange={(e) => setNewAlert({ ...newAlert, alert_type: e.target.value })}
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] focus:border-[#3a3a45] focus:outline-none transition-colors appearance-none cursor-pointer"
                >
                  <option value="pricing_change">Pricing Change</option>
                  <option value="copy_change">Copy Change</option>
                  <option value="seo_change">SEO Change</option>
                  <option value="tech_change">Tech Change</option>
                  <option value="new_page">New Page</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <label className="text-[13px] text-[#f1f5f9]">Email notifications</label>
                <button
                  onClick={() => setNewAlert({ ...newAlert, notify_email: !newAlert.notify_email })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    newAlert.notify_email ? "bg-[#4ade80]" : "bg-[#2a2a32]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      newAlert.notify_email ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2 opacity-50">
                <div>
                  <label className="text-[13px] text-[#f1f5f9]">WhatsApp notifications</label>
                  <p className="text-[11px] text-[#6b7280] mt-0.5">Coming soon</p>
                </div>
                <button
                  disabled
                  className="relative w-9 h-5 rounded-full bg-[#2a2a32] cursor-not-allowed"
                >
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white" />
                </button>
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
                onClick={handleCreateAlert}
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
