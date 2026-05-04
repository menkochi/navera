import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

const MENTHE      = "#96C7B3"
const MENTHE_DEEP = "#6aaa95"
const NECTARINE   = "#D7897F"
const PECHE       = "#F9B95C"
const INK         = "#2a2320"
const INK_SOFT    = "#5a4f4a"
const BG          = "#e8f4f0"
const BORDER      = "#e4ddd8"
const SIDEBAR     = "#1e3830"
const F           = { fontFamily: "'Poppins', sans-serif" }

export default function LoginPage() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [emailFocus, setEmailFocus]       = useState(false)
  const [passwordFocus, setPasswordFocus] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate("/app")
  }

  const inputStyle = (focused: boolean) => ({
    ...F,
    width: "100%",
    padding: "10px 14px",
    fontSize: "0.9rem",
    color: INK,
    background: "#faf7f4",
    border: `1.5px solid ${focused ? MENTHE_DEEP : BORDER}`,
    borderRadius: 8,
    outline: "none",
    boxShadow: focused ? `0 0 0 3px rgba(106,170,149,0.15)` : "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, ...F }}>

      {/* Header — matches app */}
      <header style={{ background: MENTHE, height: 52, display: "flex", alignItems: "center", padding: "0 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="font-semibold text-xl" style={{ ...F, color: "#fff", letterSpacing: "-0.02em" }}>Ask Navera</span>
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.35)" }} />
          <span style={{ ...F, fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>Speech &amp; Language</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Card */}
          <div style={{
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 10px 32px rgba(42,35,32,0.06)",
          }}>
            {/* Gradient tide line */}
            <div style={{ height: 5, background: `linear-gradient(90deg, ${MENTHE_DEEP} 0%, ${MENTHE} 55%, ${PECHE} 100%)` }} />

            <div style={{ padding: "32px 32px 28px" }}>
              {/* Icon + title */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{
                  width: 40, height: 40,
                  background: `rgba(150,199,179,0.18)`,
                  border: `2px solid rgba(150,199,179,0.35)`,
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem", flexShrink: 0,
                }}>🔑</div>
                <div>
                  <h1 className="font-semibold" style={{ ...F, fontSize: "1.15rem", color: INK, lineHeight: 1.2 }}>Welcome back</h1>
                  <p style={{ ...F, fontSize: "0.78rem", color: INK_SOFT, marginTop: 2 }}>Sign in to your Ask Navera account</p>
                </div>
              </div>

              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ ...F, display: "block", fontSize: "0.72rem", fontWeight: 600, color: INK_SOFT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@school.org"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    required
                    style={inputStyle(emailFocus)}
                  />
                </div>

                <div>
                  <label style={{ ...F, display: "block", fontSize: "0.72rem", fontWeight: 600, color: INK_SOFT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocus(true)}
                    onBlur={() => setPasswordFocus(false)}
                    required
                    style={inputStyle(passwordFocus)}
                  />
                </div>

                {error && (
                  <div style={{
                    ...F,
                    padding: "10px 14px",
                    fontSize: "0.82rem",
                    color: "#8f3e36",
                    background: "rgba(215,137,127,0.12)",
                    border: "1.5px solid rgba(215,137,127,0.35)",
                    borderRadius: 8,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...F,
                    marginTop: 4,
                    padding: "11px 0",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: loading ? MENTHE : SIDEBAR,
                    border: "none",
                    borderRadius: 8,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    transition: "background 0.15s ease, opacity 0.15s ease",
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = MENTHE_DEEP }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = SIDEBAR }}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </div>
          </div>

          {/* Footer note */}
          <p style={{ ...F, textAlign: "center", marginTop: 20, fontSize: "0.72rem", color: INK_SOFT }}>
            Private access · Ask Navera Speech &amp; Language
          </p>
        </div>
      </div>
    </div>
  )
}
