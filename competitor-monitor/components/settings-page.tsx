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
  Check,
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

interface Agency {
  id: string
  name: string
  email: string
  plan: "starter" | "agency" | "scale"
  logo_url: string | null
  brand_color: string
  created_at: string
}

interface SettingsPageProps {
  agency: Agency
  userEmail: string
}

const planFeatures = {
  starter: ["3 clients", "5 competitors each", "Weekly digest"],
  agency: ["10 clients", "10 competitors each", "White-label emails"],
  scale: ["Unlimited clients", "Daily tracking", "API access"],
}

const planLabels = {
  starter: "Starter",
  agency: "Agency",
  scale: "Scale",
}

export function SettingsPage({ agency, userEmail }: SettingsPageProps) {
  const [agencyName, setAgencyName] = useState(agency.name)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [alertNotifications, setAlertNotifications] = useState(true)
  const [changeSummary, setChangeSummary] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSuccess, setPrefsSuccess] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const handleSaveAgency = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      await fetch("/api/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agencyName, brand_color: agency.brand_color }),
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (error) {
      console.error("Failed to save agency:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSubscription = async () => {
    try {
      await fetch("/api/agency/cancel", { method: "POST" })
      window.location.reload()
    } catch (error) {
      console.error("Failed to cancel subscription:", error)
    }
  }

  const handleSavePreferences = async () => {
    setSavingPrefs(true)
    setPrefsSuccess(false)
    try {
      // Simulated API call for preferences
      await new Promise((resolve) => setTimeout(resolve, 500))
      setPrefsSuccess(true)
      setTimeout(() => setPrefsSuccess(false), 2000)
    } catch (error) {
      console.error("Failed to save preferences:", error)
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await fetch("/api/agency", { method: "DELETE" })
      window.location.href = "/"
    } catch (error) {
      console.error("Failed to delete account:", error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
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
                  item.href === "/dashboard/settings"
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
        <div className="max-w-[720px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[#f1f5f9] text-xl font-semibold">Settings</h1>
            <p className="text-[#6b7280] text-[13px] mt-1">
              Manage your account and preferences
            </p>
          </div>

          {/* Agency Profile Section */}
          <div className="bg-[#111114] border border-[#1e2130] rounded-lg p-6 mb-6">
            <h2 className="text-[#f1f5f9] text-[15px] font-semibold mb-5">
              Agency Profile
            </h2>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Agency Name</label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#f1f5f9] placeholder:text-[#444450] focus:border-[#3a3a45] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-[#6b7280]">Email</label>
                <input
                  type="email"
                  value={agency.email}
                  disabled
                  className="h-9 w-full bg-[#0a0a0f] border border-[#1e2130] rounded-md px-3 text-[13px] text-[#6b7280] cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={handleSaveAgency}
                disabled={saving}
                className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saveSuccess && <Check size={14} strokeWidth={2} />}
                {saving ? "Saving..." : saveSuccess ? "Saved" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="bg-[#111114] border border-[#1e2130] rounded-lg p-6 mb-6">
            <h2 className="text-[#f1f5f9] text-[15px] font-semibold mb-5">
              Subscription
            </h2>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-[13px] text-[#6b7280]">Current plan:</span>
              <span className="text-[12px] px-2.5 py-1 bg-[#1a1d27] text-[#f1f5f9] rounded-md font-medium">
                {planLabels[agency.plan]}
              </span>
            </div>

            <div className="mb-5">
              <p className="text-[12px] text-[#6b7280] mb-2">Plan features:</p>
              <ul className="flex flex-col gap-1.5">
                {planFeatures[agency.plan].map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-[13px] text-[#94a3b8]">
                    <Check size={14} strokeWidth={2} className="text-[#4ade80]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[12px] text-[#6b7280] mb-5">
              Member since {formatDate(agency.created_at)}
            </p>

            <div className="flex items-center gap-3">
              <button className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors">
                Upgrade Plan
              </button>
              {showCancelConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelSubscription}
                    className="h-9 px-4 bg-[#2a0a0a] text-[#ef4444] text-[13px] font-medium rounded-md hover:bg-[#3a0f0f] transition-colors"
                  >
                    Confirm Cancel
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="h-9 px-4 text-[13px] text-[#6b7280] hover:text-white transition-colors"
                  >
                    Keep Plan
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="h-9 px-4 bg-[#2a0a0a] text-[#ef4444] text-[13px] font-medium rounded-md hover:bg-[#3a0f0f] transition-colors"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>

          {/* Notifications Section */}
          <div className="bg-[#111114] border border-[#1e2130] rounded-lg p-6 mb-6">
            <h2 className="text-[#f1f5f9] text-[15px] font-semibold mb-5">
              Notifications
            </h2>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[#f1f5f9]">Weekly digest email</p>
                  <p className="text-[12px] text-[#6b7280] mt-0.5">
                    Receive a weekly summary of all competitor changes
                  </p>
                </div>
                <button
                  onClick={() => setWeeklyDigest(!weeklyDigest)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    weeklyDigest ? "bg-[#4ade80]" : "bg-[#1e2130]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      weeklyDigest ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[#f1f5f9]">Alert notifications email</p>
                  <p className="text-[12px] text-[#6b7280] mt-0.5">
                    Get notified immediately when alerts trigger
                  </p>
                </div>
                <button
                  onClick={() => setAlertNotifications(!alertNotifications)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    alertNotifications ? "bg-[#4ade80]" : "bg-[#1e2130]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      alertNotifications ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-[#f1f5f9]">Change summary email</p>
                  <p className="text-[12px] text-[#6b7280] mt-0.5">
                    Daily email with all detected changes
                  </p>
                </div>
                <button
                  onClick={() => setChangeSummary(!changeSummary)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    changeSummary ? "bg-[#4ade80]" : "bg-[#1e2130]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${
                      changeSummary ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="h-9 px-4 bg-white text-black text-[13px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {prefsSuccess && <Check size={14} strokeWidth={2} />}
                {savingPrefs ? "Saving..." : prefsSuccess ? "Saved" : "Save Preferences"}
              </button>
            </div>
          </div>

          {/* Danger Zone Section */}
          <div className="bg-[#0a0a0f] border border-[#2a0a0a] rounded-lg p-6">
            <h2 className="text-[#ef4444] text-[15px] font-semibold mb-3">
              Danger Zone
            </h2>
            <p className="text-[13px] text-[#6b7280] mb-5">
              This will permanently delete your account and all data. This cannot be
              undone.
            </p>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteAccount}
                  className="h-9 px-4 bg-[#2a0a0a] text-[#ef4444] text-[13px] font-medium rounded-md hover:bg-[#3a0f0f] transition-colors"
                >
                  Yes, Delete My Account
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="h-9 px-4 text-[13px] text-[#6b7280] hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 px-4 bg-[#2a0a0a] text-[#ef4444] text-[13px] font-medium rounded-md hover:bg-[#3a0f0f] transition-colors"
              >
                Delete Account
              </button>
            )}
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}
