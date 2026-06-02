"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type AuthMode = "login" | "signup"

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data.user) {
          await fetch("/api/create-agency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "My Agency", email: data.user.email }),
          })
          router.push("/dashboard")
          router.refresh()
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        router.push("/dashboard")
        router.refresh()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 animate-fade-in">
      {/* Auth Card */}
      <div className="w-full max-w-[480px] bg-[#111114] border border-[#222228] rounded-lg p-[40px]">
        {/* Logo */}
        <div className="pt-4 pb-8">
          <div className="flex items-center gap-3">
            <svg
              width="40"
              height="40"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer square frame */}
              <rect x="2" y="2" width="28" height="28" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              {/* Grid lines - horizontal */}
              <line x1="2" y1="11" x2="30" y2="11" stroke="#ffffff" strokeWidth="1" />
              <line x1="2" y1="21" x2="30" y2="21" stroke="#ffffff" strokeWidth="1" />
              {/* Grid lines - vertical */}
              <line x1="11" y1="2" x2="11" y2="30" stroke="#ffffff" strokeWidth="1" />
              <line x1="21" y1="2" x2="21" y2="30" stroke="#ffffff" strokeWidth="1" />
              {/* Crosshair */}
              <line x1="16" y1="6" x2="16" y2="12" stroke="#8b1a1a" strokeWidth="2" />
              <line x1="16" y1="20" x2="16" y2="26" stroke="#8b1a1a" strokeWidth="2" />
              <line x1="6" y1="16" x2="12" y2="16" stroke="#8b1a1a" strokeWidth="2" />
              <line x1="20" y1="16" x2="26" y2="16" stroke="#8b1a1a" strokeWidth="2" />
              {/* Center focal point */}
              <rect x="14" y="14" width="4" height="4" fill="#8b1a1a" />
            </svg>
            <span className="text-white text-[26px] font-semibold tracking-[-0.5px]">SpyGrid</span>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex gap-6 mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError("") }}
            className={`text-[14px] pb-2 border-b-2 transition-colors ${
              mode === "login"
                ? "text-white font-medium border-white"
                : "text-[#555560] border-transparent hover:text-[#888892]"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError("") }}
            className={`text-[14px] pb-2 border-b-2 transition-colors ${
              mode === "signup"
                ? "text-white font-medium border-white"
                : "text-[#555560] border-transparent hover:text-[#888892]"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[14px] text-[#888892]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="h-[38px] w-full bg-[#0a0a0f] border border-[#222228] rounded-md px-3 text-[14px] text-[#e2e2e8] placeholder:text-[#444450] focus:border-[#444450] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-[14px] text-[#888892]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="h-[38px] w-full bg-[#0a0a0f] border border-[#222228] rounded-md px-3 text-[14px] text-[#e2e2e8] placeholder:text-[#444450] focus:border-[#444450] focus:outline-none transition-colors"
            />
          </div>

          {mode === "login" && (
            <div className="flex justify-end -mt-4">
              <button
                type="button"
                className="text-[13px] text-[#555560] hover:text-[#888892] transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p className="text-[13px] text-red-400 -mt-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-9 w-full bg-white text-black text-[14px] font-medium rounded-md hover:bg-[#e2e2e8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>

          <div className="text-center">
            {mode === "login" ? (
              <p className="text-[13px] text-[#555560]">
                {"Don't have an account? "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError("") }}
                  className="hover:text-[#888892] transition-colors"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-[13px] text-[#555560]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError("") }}
                  className="hover:text-[#888892] transition-colors"
                >
                  Log in
                </button>
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-[13px] text-[#333338]">
        SpyGrid © 2026
      </footer>
    </div>
  )
}
