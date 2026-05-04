import { useState } from "react"
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom"
import SLTApp from "./att_v15_uat"
import LoginPage from "./pages/LoginPage"
import ProtectedRoute from "./components/ProtectedRoute"

const MENTHE      = "#96C7B3"
const MENTHE_DEEP = "#6aaa95"
const INK         = "#2a2320"
const INK_SOFT    = "#5a4f4a"
const BG          = "#e8f4f0"
const SIDEBAR     = "#1e3830"
const F           = { fontFamily: "'Poppins', sans-serif" }

function LandingPage() {
  const [hov, setHov] = useState(false)
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, ...F }}>

      {/* Header — matches app */}
      <header style={{ background: MENTHE, height: 52, display: "flex", alignItems: "center", padding: "0 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...F, fontWeight: 600, fontSize: "1.15rem", color: "#fff", letterSpacing: "-0.02em" }}>Ask Navera</span>
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.35)" }} />
          <span style={{ ...F, fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.72)" }}>Speech &amp; Language</span>
        </div>
      </header>

      {/* Hero */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>

<h1 style={{ ...F, fontSize: "2.4rem", fontWeight: 700, color: INK, lineHeight: 1.15, marginBottom: 14, letterSpacing: "-0.02em" }}>
            Ask Navera
          </h1>
          <p style={{ ...F, fontSize: "1rem", color: INK_SOFT, marginBottom: 36, lineHeight: 1.6 }}>
            Speech and language support,<br />organised beautifully.
          </p>

          <Link
            to="/login"
            style={{
              ...F,
              display: "inline-block",
              padding: "13px 40px",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#fff",
              background: hov ? MENTHE_DEEP : SIDEBAR,
              borderRadius: 8,
              textDecoration: "none",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
          >
            Sign in
          </Link>

        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding: "16px 24px", textAlign: "center" }}>
        <p style={{ ...F, fontSize: "0.7rem", color: INK_SOFT }}>Private access · Ask Navera Speech &amp; Language</p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <SLTApp />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
