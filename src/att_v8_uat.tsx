// @ts-nocheck
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

/*
  FONT SETUP — add these two lines to your index.html <head>:
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">

  DESIGN SYSTEM: "Warm Clinic"
  Background:  warm sand  #FDF8F3
  Primary:     deep coral #E05C5C
  Forest:      #2D7A5F  (universal / success)
  Sky:         #0369A1  (targeted)
  Plum:        #6D28D9  (specialist)
  Amber:       #D97706  (EHCP / warnings)
*/

// ── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function supabaseFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Supabase error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchCaseload() {
  return supabaseFetch("caseload_terms_uat?select=*,children_uat!child_id(id,full_name,dob)&order=name");
}
async function upsertChild(childData) {
  return supabaseFetch("children_uat", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ full_name: childData.name, dob: childData.dob || null }),
  });
}
async function insertCaseloadTerm(childId, termData) {
  return supabaseFetch("caseload_terms_uat", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      child_id: childId,
      term: termData.term || null,
      year: termData.yearGroup || null,
      class: termData.class || null,
      name: termData.name,
      ehcp: termData.ehcp,
      ehcp_hours: termData.ehcpHours || null,
      primary_area_of_need: termData.difficulties.join(", ") || null,
      lead: termData.lead || null,
      intervention_level: termData.tiers.join(", "),
      frequency: termData.frequency || null,
      rag_status: termData.ragStatus || null,
      notes_for_teacher_universal_level_strategies: termData.notes || null,
    }),
  });
}
async function patchCaseloadTerm(termId, patch) {
  return supabaseFetch(`caseload_terms_uat?id=eq.${termId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
}
async function removeChildFromDB(supabaseChildId) {
  await supabaseFetch(`sessions_uat?child_id=eq.${supabaseChildId}`, { method: "DELETE" });
  await supabaseFetch(`caseload_terms_uat?child_id=eq.${supabaseChildId}`, { method: "DELETE" });
  await supabaseFetch(`children_uat?id=eq.${supabaseChildId}`, { method: "DELETE" });
}
async function fetchSessions(childId) {
  return supabaseFetch(`sessions_uat?child_id=eq.${childId}&order=date.asc,created_at.asc`);
}
async function insertSession(childId, session) {
  return supabaseFetch("sessions_uat", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      child_id: childId,
      date: session.date,
      duration: session.duration,
      type: session.type,
      notes: session.notes || null,
      ehcp_session: session.ehcp_session ?? false,
    }),
  });
}
async function patchSession(sessionId, patch) {
  return supabaseFetch(`sessions_uat?id=eq.${sessionId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
}
async function deleteSession(sessionId) {
  return supabaseFetch(`sessions_uat?id=eq.${sessionId}`, { method: "DELETE" });
}

async function fetchTargetsForTerms(termIds) {
  if (!termIds.length) return [];
  return supabaseFetch(`targets_uat?term_id=in.(${termIds.join(",")})&order=created_at.asc`);
}
async function insertTarget(termId, level, text) {
  const today = new Date().toISOString().slice(0, 10);
  return supabaseFetch("targets_uat", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ term_id: termId, level, target: text, status: "in_progress", date_added: today, cleared: false }),
  });
}
async function patchTarget(targetId, text) {
  const today = new Date().toISOString().slice(0, 10);
  return supabaseFetch(`targets_uat?id=eq.${targetId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ target: text, date_updated: today }),
  });
}
async function deleteTarget(targetId) {
  return supabaseFetch(`targets_uat?id=eq.${targetId}`, { method: "DELETE" });
}
async function patchTargetStatus(targetId, status) {
  const today = new Date().toISOString().slice(0, 10);
  return supabaseFetch(`targets_uat?id=eq.${targetId}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status, date_updated: today }),
  });
}

// ── localStorage ──────────────────────────────────────────────────────────────
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, val); } catch {} }

// ── Error helper (Bug 13) ─────────────────────────────────────────────────────
function friendlyError(err) {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("jwt") || m.includes("401") || m.includes("403")) return "Your session has expired — please log in again.";
  if (m.includes("not-null") || m.includes("violates") || m.includes("constraint")) return "Missing required information — please check all fields.";
  if (m.includes("duplicate") || m.includes("unique")) return "This record already exists.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Connection error — check your internet and try again.";
  if (m.includes("404")) return "Record not found — it may have been deleted.";
  return "Something went wrong — please try again.";
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function mapRowToChild(row) {
  const ch = row.children_uat || {};
  const difficulties = (row.primary_area_of_need || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const tiers = (row.intervention_level || "universal").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return {
    id: ch.id || row.child_id,
    supabaseTermId: row.id,
    name: ch.full_name || row.name || "Unknown",
    dob: ch.dob || "",
    term: row.term || "",
    yearGroup: row.year || "",
    class: row.class || "",
    ehcp: !!row.ehcp,
    ehcpHours: row.ehcp_hours || 0,
    lead: row.lead || "",
    difficulties,
    tiers: tiers.length ? tiers : ["universal"],
    ragStatus: row.rag_status || "",
    lastReviewed: row.last_reviewed || "",
    frequency: row.frequency || "",
    notes: row.notes_for_teacher_universal_level_strategies || "",
    senStatus: row.ehcp ? "EHCP" : "SEN Support",
    currentTargets: { universal: [], targeted: [], specialist: [] },
    nextTargets: { targeted: [] },
    sessionsLogged: [],
    progress: { universal: 0, targeted: 0, specialist: 0 },
    approvedResources: [], pendingResources: [], videos: [],
    gender: "", ethnicity: "", language: "", reviewDate: "", additionalNeeds: "", extraFields: {},
  };
}

// Bug 11 — extended ord map to all 6 terms
function dedupeByLatestTerm(rows) {
  const ord = { "Autumn 1": 1, "Autumn 2": 2, "Spring 1": 3, "Spring 2": 4, "Summer 1": 5, "Summer 2": 6 };
  const map = {};
  rows.forEach(r => {
    const id = (r.children && r.children.id) || r.child_id;
    if (!id) return;
    if (!map[id] || (ord[r.term] || 0) > (ord[map[id].term] || 0)) map[id] = r;
  });
  return Object.values(map);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SLT_HIERARCHIES = {
  concepts:             { label: "Concepts & Spatial Language" },
  phonology:            { label: "Phonology & Speech Sounds" },
  phonologicalProcesses:{ label: "Phonological Processes" },
  vocabulary:           { label: "Vocabulary & Word Knowledge" },
  grammar:              { label: "Grammar & Sentence Structure" },
  listening:            { label: "Listening & Comprehension" },
  social:               { label: "Social Communication & Pragmatics" },
  narrativeLanguage:    { label: "Narrative Language" },
  earlyLanguage:        { label: "Early Language & Communication" },
  readingComprehension: { label: "Reading & Literacy Comprehension" },
};
const SEASONS = [
  { name: "Autumn", months: [9,10],    emoji: "🍂" },
  { name: "Winter", months: [11,12,1], emoji: "❄️" },
  { name: "Spring", months: [2,3,4],   emoji: "🌸" },
  { name: "Summer", months: [5,6,7,8], emoji: "☀️" },
];
const getCurrentSeason = () => SEASONS.find(s => s.months.includes(new Date().getMonth() + 1)) || SEASONS[2];
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning!";
  if (h < 18) return "Good afternoon!";
  return "Good evening!";
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const CORAL = "#E05C5C";
const SAND  = "#FDF8F3";
const F     = { fontFamily: "'DM Sans', sans-serif" };
const FH    = { fontFamily: "'Fraunces', serif" };

const TC = {
  universal:  { pill: "bg-emerald-100 text-emerald-800 border-emerald-200", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  targeted:   { pill: "bg-sky-100 text-sky-800 border-sky-200",             bar: "bg-sky-500",     dot: "bg-sky-500"     },
  specialist: { pill: "bg-violet-100 text-violet-800 border-violet-200",    bar: "bg-violet-500",  dot: "bg-violet-500"  },
};
const RAG = {
  Green: { pill: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  Amber: { pill: "bg-amber-100 text-amber-800",     dot: "bg-amber-500"   },
  Red:   { pill: "bg-red-100 text-red-800",         dot: "bg-red-500"     },
};

// ── Atoms ─────────────────────────────────────────────────────────────────────
function TierPill({ tier }) {
  const c = TC[tier] || TC.universal;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${c.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}
function RagPill({ status }) {
  if (!status) return null;
  const c = RAG[status] || { pill: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${c.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </span>
  );
}
function Chip({ children, className = "" }) {
  return <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}>{children}</span>;
}
function Card({ children, accent, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${className}`}
      style={{ border: "1px solid #F0EBE3" }}>
      {accent && <div className={`w-full h-1 ${accent}`} />}
      <div className="p-5">{children}</div>
    </div>
  );
}
function SectionLabel({ children, color = "text-gray-400" }) {
  return <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${color}`}>{children}</p>;
}
function Field({ label, value }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b last:border-0" style={{ borderColor: "#F5EFE8" }}>
      <span className="text-xs text-gray-400 w-32 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 flex-1">
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}
function StatBadge({ label, value, bg, text }) {
  return (
    <div className={`${bg} ${text} rounded-xl p-3 flex-shrink-0`} style={{ minWidth: 76 }}>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-1 opacity-80 leading-tight">{label}</p>
    </div>
  );
}
function PBtn({ children, onClick, disabled = false, className = "" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 ${className}`}
      style={{ background: disabled ? "#ccc" : CORAL }}>
      {children}
    </button>
  );
}
function SBtn({ children, onClick, className = "" }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all ${className}`}>
      {children}
    </button>
  );
}
function DBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all">
      {children}
    </button>
  );
}
// Bug 14 — added min and maxLength props
function SInput({ value, onChange, placeholder, type = "text", onKeyDown, className = "", min, maxLength }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown}
      min={min} maxLength={maxLength}
      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${className}`}
      style={{ borderColor: "#E8DDD5", background: "#FDFAF7" }}
      onFocus={e => { e.target.style.borderColor = CORAL; e.target.style.boxShadow = `0 0 0 3px rgba(224,92,92,0.1)`; }}
      onBlur={e => { e.target.style.borderColor = "#E8DDD5"; e.target.style.boxShadow = "none"; }}
    />
  );
}
function SSelect({ value, onChange, children, className = "" }) {
  return (
    <select value={value} onChange={onChange}
      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white ${className}`}
      style={{ borderColor: "#E8DDD5" }}>
      {children}
    </select>
  );
}
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
      <p className="text-sm text-red-700 flex-1">{message}</p>
      {onDismiss && <button onClick={onDismiss} className="text-red-400 hover:text-red-600 text-xl font-bold ml-2 leading-none">×</button>}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
const ConfirmCtx = createContext(null);
function useConfirm() { return useContext(ConfirmCtx); }
function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null);
  const confirm = useCallback((message, { label = "Confirm", danger = false } = {}) =>
    new Promise(resolve => setPending({ message, label, danger, resolve }))
  , []);
  const settle = (result) => { pending?.resolve(result); setPending(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <p className="text-gray-800 font-medium text-base mb-6 leading-snug">{pending.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => settle(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={() => settle(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium text-white ${pending.danger ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                {pending.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

// ── Main App — Bug 1: outer shell so useConfirm() works inside ────────────────
export default function SLTApp() {
  return (
    <ConfirmProvider>
      <SLTAppInner />
    </ConfirmProvider>
  );
}

function SLTAppInner() {
  const [children, setChildren] = useState([]);
  const [view, setView]         = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [section, setSection]   = useState("core");
  const [pendingQueue, setPendingQueue] = useState([]);
  const [toast, setToast]       = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError]   = useState(null);
  const [importModal, setImportModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const navigate = useNavigate();
  const confirm = useConfirm();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  useEffect(() => {
    (async () => {
      setDbLoading(true); setDbError(null);
      try {
        const rows = await fetchCaseload();
        if (rows && rows.length > 0) {
          const dedupedRows = dedupeByLatestTerm(rows);
          const termIds = dedupedRows.map(r => r.id).filter(Boolean);
          const targetRows = termIds.length ? await fetchTargetsForTerms(termIds) : [];

          const byTerm = {};
          targetRows.forEach(t => {
            if (!byTerm[t.term_id]) byTerm[t.term_id] = { universal: [], targeted: [], specialist: [] };
            if (byTerm[t.term_id][t.level]) byTerm[t.term_id][t.level].push({
              id: t.id,
              text: t.target,
              status: t.status || "in_progress",
              date_added: t.date_added || null,
              date_updated: t.date_updated || null,
              cleared: t.cleared ?? false,
            });
          });

          setChildren(dedupedRows.map(row => ({
            ...mapRowToChild(row),
            currentTargets: byTerm[row.id] || { universal: [], targeted: [], specialist: [] },
          })));
        }
      } catch (err) {
        setDbError(`Could not load from Supabase: ${err.message}. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`);
      } finally { setDbLoading(false); }
      const saved = lsGet("slt_pending");
      if (saved) try { setPendingQueue(JSON.parse(saved)); } catch {}
    })();
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Bug 6 — showToast in catch so auto-save failures are visible
  const updateChild = useCallback((id, updater) => {
    setChildren(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...updater(c) };
      if (updated.supabaseTermId) {
        patchCaseloadTerm(updated.supabaseTermId, {
          notes_for_teacher_universal_level_strategies: updated.notes || null,
          lead: updated.lead || null,
          rag_status: updated.ragStatus || null,
        }).catch(err => {
          console.error("Patch failed:", err);
          showToast("Auto-save failed — changes may not persist", "error");
        });
      }
      return updated;
    }));
  }, [showToast]);

  const savePending = useCallback((q) => { lsSet("slt_pending", JSON.stringify(q)); }, []);
  const openProfile = (id) => { setSelectedId(id); setSection("core"); setView("profile"); };
  const child = children.find(c => c.id === selectedId) || null;

  const stats = {
    total:      children.length,
    specialist: children.filter(c => c.tiers.includes("specialist")).length,
    targeted:   children.filter(c => c.tiers.includes("targeted") && !c.tiers.includes("specialist")).length,
    universal:  children.filter(c => c.tiers.length === 1 && c.tiers[0] === "universal").length,
    ehcp:       children.filter(c => c.ehcp).length,
    pending:    pendingQueue.length,
  };

  const handleDelete = async (id) => {
    const c = children.find(x => x.id === id);
    if (!c) return;
    const ok = await confirm(`Remove ${c.name} from the caseload? This cannot be undone.`, { label: "Remove", danger: true });
    if (!ok) return;
    try {
      await removeChildFromDB(c.id);
      setChildren(prev => prev.filter(x => x.id !== id));
      showToast("Child removed ✓");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (dbLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: SAND, ...F }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-sm font-bold mx-auto mb-5 shadow-lg"
            style={{ background: CORAL }}>SLT</div>
          <p className="text-gray-500 text-sm font-medium">Loading your caseload…</p>
          <div className="mt-4 flex justify-center gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: CORAL, animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: SAND, ...F }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between"
        style={{ borderColor: "#EDE6DD", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>

        <div className="flex items-center gap-3 min-w-0">
          {/* Logo */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
            style={{ background: CORAL }}>SLT</div>

          {/* Desktop breadcrumb */}
          <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
            {view !== "dashboard" && (
              <>
                <button onClick={() => { setView("dashboard"); setSelectedId(null); }}
                  className="font-medium hover:underline" style={{ color: CORAL }}>Home</button>
                <span className="text-gray-300">›</span>
              </>
            )}
            {view === "caseload" && <span className="font-semibold text-gray-700">Caseload</span>}
            {view === "approvals" && <span className="font-semibold text-gray-700">Approvals</span>}
            {view === "dashboard" && <span className="font-semibold text-gray-700" style={FH}>Dashboard</span>}
            {view === "profile" && child && (
              <>
                <button onClick={() => setView("caseload")} className="font-medium hover:underline" style={{ color: CORAL }}>Caseload</button>
                <span className="text-gray-300">›</span>
                <span className="font-semibold text-gray-700 truncate max-w-[140px]">{child.name}</span>
              </>
            )}
          </nav>

          {/* Mobile title */}
          <span className="sm:hidden text-base font-semibold text-gray-800 truncate" style={FH}>
            {view === "profile" && child ? child.name.split(" ")[0]
              : view === "caseload" ? "Caseload"
              : view === "approvals" ? "Approvals" : "Dashboard"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {view === "profile" && child ? (
            <>
              <SBtn onClick={() => setSection("sessions")} className="hidden sm:block text-xs py-1.5 px-3">📅 Log Session</SBtn>
              <PBtn onClick={() => setSection("parent")} className="text-xs py-1.5 px-3">👪 <span className="hidden sm:inline">Parent Portal</span></PBtn>
            </>
          ) : view === "caseload" ? (
            <>
              <SBtn onClick={() => setImportModal(true)} className="text-xs py-1.5 px-3">↑ Import</SBtn>
              <PBtn onClick={() => setAddModal(true)} className="text-xs py-1.5 px-3">+ Add Child</PBtn>
            </>
          ) : view === "approvals" ? null : (
            <PBtn onClick={() => setImportModal(true)} className="text-xs py-1.5 px-3">↑ Import</PBtn>
          )}
          <SBtn onClick={handleLogout} className="text-xs py-1.5 px-3">Logout</SBtn>
        </div>
      </header>

      {/* ── MOBILE PROFILE SECTION TABS ─────────────────────────────────── */}
      {view === "profile" && child && (
        <div className="sm:hidden sticky top-14 z-20 bg-white border-b overflow-x-auto"
          style={{ borderColor: "#EDE6DD" }}>
          <div className="flex px-3 py-2 gap-1.5 min-w-max">
            {[
              { id: "core",       label: "Info"       },
              { id: "slprofile",  label: "SL Profile" },
              ...(child.tiers.includes("universal")  ? [{ id: "universal",  label: "Universal"  }] : []),
              ...(child.tiers.includes("targeted")   ? [{ id: "targeted",   label: "Targeted"   }] : []),
              ...(child.tiers.includes("specialist") ? [{ id: "specialist", label: "Specialist" }] : []),
              { id: "sessions", label: "Sessions" },
              { id: "parent",   label: "Parent"   },
              { id: "files",    label: "Files"    },
            ].map(item => (
              <button key={item.id} onClick={() => setSection(item.id)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
                style={section === item.id ? { background: CORAL, color: "#fff" } : { color: "#9CA3AF" }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LAYOUT ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden sm:flex flex-col w-56 bg-white border-r flex-shrink-0 overflow-y-auto"
          style={{ borderColor: "#EDE6DD" }}>
          {view === "profile" && child
            ? <ProfileSidebar section={section} setSection={setSection} child={child} onBack={() => setView("caseload")} />
            : <MainSidebar view={view} setView={v => { setView(v); setSelectedId(null); }} stats={stats} pendingCount={pendingQueue.length} />}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 space-y-4">
          {dbError && <ErrorBanner message={dbError} onDismiss={() => setDbError(null)} />}

          {view === "dashboard" && (
            <Dashboard children={children} stats={stats} onOpen={openProfile}
              onImport={() => setImportModal(true)} onAdd={() => setAddModal(true)} />
          )}

          {view === "caseload" && (
            <Caseload children={children} onOpen={openProfile} onDelete={handleDelete} />
          )}

          {view === "profile" && child && (
            <ChildProfile child={child} section={section} setSection={setSection}
              updateChild={updateChild} showToast={showToast} />
          )}

          {view === "profile" && !child && !dbLoading && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">👤</p>
              <p className="font-semibold">Child record not found.</p>
              <button onClick={() => setView("caseload")}
                className="mt-4 text-sm font-semibold hover:underline" style={{ color: CORAL }}>
                ← Back to Caseload
              </button>
            </div>
          )}

          {view === "approvals" && (
            <Approvals queue={pendingQueue}
              setQueue={q => { setPendingQueue(q); savePending(q); }}
              setChildren={setChildren} showToast={showToast} />
          )}
        </main>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t flex z-30"
        style={{ borderColor: "#EDE6DD", boxShadow: "0 -2px 10px rgba(0,0,0,0.06)" }}>
        {[
          { id: "dashboard", icon: "⊞", label: "Home"      },
          { id: "caseload",  icon: "👥", label: "Caseload",  count: stats.total  },
          { id: "approvals", icon: "✅", label: "Approvals", count: stats.pending, alert: stats.pending > 0 },
        ].map(item => (
          <button key={item.id} onClick={() => { setView(item.id); setSelectedId(null); }}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 relative transition-colors"
            style={{ color: view === item.id ? CORAL : "#9CA3AF" }}>
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-xs font-semibold">{item.label}</span>
            {item.count > 0 && (
              <span className="absolute top-2 right-[18%] text-white font-bold rounded-full flex items-center justify-center"
                style={{ background: item.alert ? "#D97706" : CORAL, width: 16, height: 16, fontSize: 9 }}>
                {item.count > 9 ? "9+" : item.count}
              </span>
            )}
            {view === item.id && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: CORAL }} />}
          </button>
        ))}
        {view === "profile" && child && (
          <button onClick={() => setView("caseload")}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5"
            style={{ color: CORAL }}>
            <span className="text-xl">←</span>
            <span className="text-xs font-semibold">Back</span>
          </button>
        )}
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-5 right-4 sm:right-6 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold z-50"
          style={{ background: toast.type === "success" ? "#2D7A5F" : "#DC2626" }}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {importModal && <ImportModal onClose={() => setImportModal(false)} setChildren={setChildren} showToast={showToast} />}
      {addModal && (
        <AddChildModal
          onAdd={async (formData) => {
            try {
              // Bug 2 — bounds-checked array result
              const childRows = await upsertChild(formData);
              if (!childRows?.length) throw new Error("Could not save — please try again.");
              const childRow = childRows[0];
              await insertCaseloadTerm(childRow.id, formData);
              const rows = await fetchCaseload();
              setChildren(dedupeByLatestTerm(rows).map(mapRowToChild));
              showToast("Child added ✓");
              setAddModal(false);
            } catch (err) { showToast(friendlyError(err), "error"); }
          }}
          onClose={() => setAddModal(false)}
        />
      )}
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
function MainSidebar({ view, setView, stats, pendingCount }) {
  return (
    <div className="flex flex-col h-full py-5">
      <div className="px-5 mb-3"><SectionLabel>Menu</SectionLabel></div>
      <div className="flex-1">
        {[
          { id: "dashboard", icon: "⊞", label: "Dashboard"  },
          { id: "caseload",  icon: "👥", label: "My Caseload", count: stats.total  },
          { id: "approvals", icon: "✅", label: "Approvals",   count: pendingCount, alert: pendingCount > 0 },
        ].map(item => {
          const active = view === item.id;
          return (
            <button key={item.id} onClick={() => setView(item.id)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold transition-all text-left"
              style={active ? { color: CORAL, background: "#FFF1F1", borderRight: `3px solid ${CORAL}` } : { color: "#6B7280" }}>
              <span className="flex items-center gap-2.5"><span>{item.icon}</span>{item.label}</span>
              {item.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${item.alert ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mx-5 pt-4 border-t" style={{ borderColor: "#EDE6DD" }}>
        <SectionLabel>Breakdown</SectionLabel>
        {[
          { l: "Universal",  v: stats.universal,  dot: "bg-emerald-500" },
          { l: "Targeted",   v: stats.targeted,   dot: "bg-sky-500"     },
          { l: "Specialist", v: stats.specialist, dot: "bg-violet-500"  },
          { l: "EHCP",       v: stats.ehcp,       dot: "bg-amber-500"   },
        ].map(s => (
          <div key={s.l} className="flex items-center justify-between text-xs text-gray-500 mb-2.5">
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.l}
            </span>
            <span className="font-bold text-gray-700">{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Sidebar ───────────────────────────────────────────────────────────
function ProfileSidebar({ section, setSection, child, onBack }) {
  const items = [
    { id: "core",       icon: "📋", label: "Core Data"         },
    { id: "slprofile",  icon: "🗣",  label: "S&L Profile"       },
    { id: "universal",  icon: "🟢", label: "Universal",  show: child.tiers.includes("universal")  },
    { id: "targeted",   icon: "🔵", label: "Targeted",   show: child.tiers.includes("targeted")   },
    { id: "specialist", icon: "🟣", label: "Specialist", show: child.tiers.includes("specialist") },
    { id: "parent",     icon: "👪", label: "Parent Portal"      },
    { id: "sessions",   icon: "📅", label: "Sessions Log"       },
    { id: "files",      icon: "📁", label: "Files & Videos"     },
  ].filter(i => i.show !== false);

  return (
    <div className="py-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold px-5 mb-4 transition-colors"
        style={{ color: CORAL }}>← Back to Caseload</button>
      <div className="px-5 mb-2">
        <SectionLabel>Child Record</SectionLabel>
        <p className="text-sm font-semibold text-gray-800 truncate" style={FH}>{child.name}</p>
      </div>
      <div className="mt-2">
        {items.map(item => {
          const active = section === item.id;
          return (
            <button key={item.id} onClick={() => setSection(item.id)}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold transition-all text-left"
              style={active ? { color: CORAL, background: "#FFF1F1", borderRight: `3px solid ${CORAL}` } : { color: "#6B7280" }}>
              <span className="flex-shrink-0">{item.icon}</span>{item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Child Profile ─────────────────────────────────────────────────────────────
function ChildProfile({ child, section, setSection, updateChild, showToast }) {
  const totalTargets = [...child.currentTargets.universal, ...child.currentTargets.targeted, ...child.currentTargets.specialist].length;
  const totalHours = child.sessionsLogged.filter(s => s.ehcp_session).reduce((s, sess) => s + sess.duration, 0) / 60;
  const ehcpPct = child.ehcp && child.ehcpHours > 0
    ? Math.min(100, Math.round((totalHours / child.ehcpHours) * 100)) : null;

  return (
    <div className="space-y-4 mt-8 sm:mt-0">
      {/* Profile header card */}
      <Card accent="bg-rose-300">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: "#FFF1F1" }}>👤</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 mb-1" style={FH}>{child.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              {child.yearGroup && <span className="text-xs text-gray-400">{child.yearGroup}{child.class ? ` · ${child.class}` : ""}</span>}
              {child.ehcp && <Chip className="bg-violet-100 text-violet-800">EHCP</Chip>}
              {child.tiers.map(t => <TierPill key={t} tier={t} />)}
              <RagPill status={child.ragStatus} />
              {child.lead && <Chip className="bg-gray-100 text-gray-600">Lead: {child.lead}</Chip>}
            </div>
          </div>
        </div>

        {/* Stat tiles — horizontal scroll on mobile */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { label: "Targets",   value: totalTargets,                          bg: "bg-rose-500",    text: "text-white" },
            { label: "Sessions",  value: child.sessionsLogged.length,            bg: "bg-sky-500",     text: "text-white" },
            { label: "Hours",     value: totalHours.toFixed(1) + "h",            bg: "bg-amber-500",   text: "text-white" },
            { label: "Universal", value: child.currentTargets.universal.length,  bg: "bg-emerald-600", text: "text-white" },
            { label: "Targeted",  value: child.currentTargets.targeted.length,   bg: "bg-sky-600",     text: "text-white" },
            { label: "EHCP %",    value: ehcpPct !== null ? `${ehcpPct}%` : "—", bg: "bg-violet-600",  text: "text-white" },
          ].map((t, i) => <StatBadge key={i} {...t} />)}
        </div>
      </Card>

      {/* Section content */}
      {section === "core"       && <CoreDataSection child={child} />}
      {section === "slprofile"  && <SLProfileSection child={child} />}
      {section === "universal"  && <UniversalSection child={child} updateChild={updateChild} showToast={showToast} setSection={setSection} />}
      {section === "targeted"   && <TargetedSection child={child} updateChild={updateChild} showToast={showToast} setSection={setSection} />}
      {section === "specialist" && <SpecialistSection child={child} updateChild={updateChild} showToast={showToast} setSection={setSection} />}
      {section === "parent"     && <ParentSection child={child} />}
      {section === "sessions"   && <SessionsSection child={child} updateChild={updateChild} showToast={showToast} />}
      {section === "files"      && <FilesSection child={child} updateChild={updateChild} showToast={showToast} />}
    </div>
  );
}

// ── Core Data ─────────────────────────────────────────────────────────────────
function CoreDataSection({ child }) {
  const parts = (child.name || "").split(" ");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card accent="bg-amber-400">
        <SectionLabel color="text-amber-600">Core Data</SectionLabel>
        <div className="flex gap-4">
          <div className="w-14 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: "#FFFBEB" }}>👤</div>
          <div className="flex-1 min-w-0">
            <Field label="First name"    value={parts[0]} />
            <Field label="Last name"     value={parts.slice(1).join(" ")} />
            <Field label="Date of birth" value={child.dob} />
            <Field label="Year group"    value={child.yearGroup} />
            <Field label="Class"         value={child.class} />
            <Field label="Gender"        value={child.gender} />
            <Field label="SEN stage"     value={child.senStatus} />
          </div>
        </div>
      </Card>
      <Card accent="bg-emerald-500">
        <SectionLabel color="text-emerald-700">Additional Data</SectionLabel>
        <Field label="Home language"    value={child.language} />
        <Field label="Ethnicity"        value={child.ethnicity} />
        <Field label="SLT lead"         value={child.lead} />
        <Field label="RAG status"       value={child.ragStatus} />
        <Field label="Term"             value={child.term} />
        <Field label="Review date"      value={child.reviewDate} />
        <Field label="Additional needs" value={child.additionalNeeds} />
        <Field label="EHCP"             value={child.ehcp ? `Yes — ${child.ehcpHours} hrs/year` : "No"} />
        {child.notes && (
          <div className="mt-3 p-3 rounded-xl text-xs text-amber-800"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>📌 {child.notes}</div>
        )}
      </Card>
    </div>
  );
}

// ── S&L Profile ───────────────────────────────────────────────────────────────
function SLProfileSection({ child }) {
  const [showAll, setShowAll] = useState(false);
  const TIERS = ["universal", "targeted", "specialist"];

  // "Current" = not cleared and not completed
  const filterTargets = (items) =>
    showAll ? items : items.filter(t => !t.cleared && t.status !== "completed");

  const hasAny = TIERS.some(t => (child.currentTargets[t] || []).length > 0);
  const hasVisible = TIERS.some(t => filterTargets(child.currentTargets[t] || []).length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card accent="bg-sky-500">
          <SectionLabel color="text-sky-700">Areas of Difficulty</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {child.difficulties.length > 0
              ? child.difficulties.map(d => (
                  <span key={d} className="bg-sky-50 text-sky-800 border border-sky-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
                    {SLT_HIERARCHIES[d]?.label || d}
                  </span>
                ))
              : <p className="text-gray-400 text-sm italic">No difficulties recorded</p>}
          </div>
        </Card>
        <Card accent="bg-sky-500">
          <SectionLabel color="text-sky-700">Progress Overview</SectionLabel>
          {child.tiers.map(t => (
            <div key={t} className="mb-4 last:mb-0">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="capitalize text-gray-600">{t}</span>
                <span className="text-gray-400">{child.progress[t] || 0}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#F5EFE8" }}>
                <div className={`h-full rounded-full transition-all ${TC[t]?.bar || "bg-gray-300"}`}
                  style={{ width: `${child.progress[t] || 0}%` }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card accent="bg-rose-300">
        {/* Header row: title + toggle */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel color="text-rose-600" >{showAll ? "All Targets" : "Current Targets"}</SectionLabel>
          <div className="flex items-center gap-1 rounded-xl p-1 flex-shrink-0" style={{ background: "#F5EFE8" }}>
            <button
              onClick={() => setShowAll(false)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={!showAll ? { background: CORAL, color: "#fff" } : { color: "#9CA3AF" }}>
              Current
            </button>
            <button
              onClick={() => setShowAll(true)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={showAll ? { background: CORAL, color: "#fff" } : { color: "#9CA3AF" }}>
              Show all
            </button>
          </div>
        </div>

        {!hasAny ? (
          <p className="text-gray-400 text-sm italic">No targets set yet</p>
        ) : !hasVisible ? (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm italic">No current targets — all are completed or cleared</p>
            <button onClick={() => setShowAll(true)}
              className="mt-2 text-xs font-semibold underline" style={{ color: CORAL }}>
              Show all targets
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {TIERS.map(tier => {
              const items = filterTargets(child.currentTargets[tier] || []);
              if (!items.length) return null;
              return (
                <div key={tier}>
                  <div className="mb-2"><TierPill tier={tier} /></div>
                  <ul className="space-y-1.5">
                    {items.map(t => {
                      const isCompleted = t.status === "completed";
                      const isCleared   = t.cleared === true;
                      return (
                        <li key={t.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl text-sm"
                          style={{ background: isCleared ? "#F9F9F9" : isCompleted ? "#F0FDF4" : "#FDFAF7", border: isCleared ? "1px dashed #D1D5DB" : "none" }}>
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isCleared || isCompleted ? "bg-gray-300" : TC[tier].dot}`} />
                          <span className={`flex-1 font-medium leading-snug whitespace-pre-wrap ${isCleared ? "text-gray-400 italic" : isCompleted ? "text-gray-500 line-through" : "text-gray-700"}`}>
                            {t.text}
                          </span>
                          {isCompleted && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">✓ Done</span>}
                          {isCleared  && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">Cleared</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Target list helper ────────────────────────────────────────────────────────
function TargetList({ targets, barColor, dotColor, itemBg, placeholder, onAdd, onEdit, onRemove, onStatusToggle }) {
  const [val, setVal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [hiddenIds, setHiddenIds] = useState(() => new Set(targets.filter(t => t.cleared).map(t => t.id)));

  const add = () => { if (!val.trim()) return; onAdd(val); setVal(""); };
  const startEdit = (t) => { setEditingId(t.id); setEditVal(t.text); };
  const cancelEdit = () => { setEditingId(null); setEditVal(""); };
  const hideTarget   = (id) => setHiddenIds(prev => new Set([...prev, id]));
  const unhideTarget = (id) => setHiddenIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  const hideAll      = () => setHiddenIds(new Set(targets.map(t => t.id)));
  const showAll      = () => setHiddenIds(new Set());

  const saveEdit = async () => {
    if (!editVal.trim()) return;
    await onEdit(editingId, editVal);
    cancelEdit();
  };

  const fmtDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const visibleTargets = targets.filter(t => !hiddenIds.has(t.id));
  const hiddenTargets  = targets.filter(t =>  hiddenIds.has(t.id));

  return (
    <div>
      {targets.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={hideAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            Hide all
          </button>
          <button onClick={showAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            Show all
          </button>
        </div>
      )}
      {visibleTargets.length > 0
        ? <ul className="space-y-3 mb-4">
            {visibleTargets.map(t => {
              const isCompleted = t.status === "completed";
              return (
                <li key={t.id}>
                  {editingId === t.id ? (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl border-2" style={{ background: itemBg, borderColor: CORAL }}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${dotColor}`} />
                      <textarea
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Escape") cancelEdit(); }}
                        className="flex-1 text-sm font-medium text-gray-700 bg-transparent outline-none resize-y min-h-[2rem]"
                        autoFocus
                      />
                      <button onClick={saveEdit}
                        className="text-xs font-semibold px-2 py-1 rounded-lg text-white flex-shrink-0"
                        style={{ background: CORAL }}>Save</button>
                      <button onClick={cancelEdit}
                        className="text-xs font-semibold px-2 py-1 rounded-lg text-gray-500 bg-gray-100 flex-shrink-0">✕</button>
                    </div>
                  ) : (
                    <div className="rounded-xl text-sm overflow-hidden" style={{ background: isCompleted ? "#F0FDF4" : itemBg }}>
                      <div className="flex items-start gap-3 px-3 pt-3 pb-1">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isCompleted ? "bg-gray-300" : dotColor}`} />
                        <span className={`flex-1 font-medium leading-snug whitespace-pre-wrap ${isCompleted ? "text-gray-500 line-through" : "text-gray-700"}`}>
                          {t.text}
                        </span>
                        {isCompleted
                          ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">✓ Completed</span>
                          : <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full flex-shrink-0">In Progress</span>}
                      </div>
                      <div className="flex items-center gap-4 px-3 pb-2 pt-0.5">
                        {t.date_added && (
                          <span className="text-xs text-gray-400">Added: <span className="font-medium text-gray-500">{fmtDate(t.date_added)}</span></span>
                        )}
                        {t.date_updated && (
                          <span className="text-xs text-gray-400">Updated: <span className="font-medium text-gray-500">{fmtDate(t.date_updated)}</span></span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 px-3 pb-2">
                        <button onClick={() => onStatusToggle(t.id, t.status)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
                          style={isCompleted ? { background: "#EFF6FF", color: "#1E3A8A" } : { background: "#F0FDF4", color: "#065F46" }}
                          title={isCompleted ? "Mark as in progress" : "Mark as completed"}>
                          {isCompleted ? "↩ In Progress" : "✓ Complete"}
                        </button>
                        <button onClick={() => hideTarget(t.id)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
                          title="Hide from this view (visual only)">
                          ○ Hide
                        </button>
                        <div className="flex-1" />
                        <button onClick={() => startEdit(t)}
                          className="text-gray-300 hover:text-indigo-400 text-sm leading-none transition-colors flex-shrink-0 px-1.5 py-1"
                          title="Edit">✎</button>
                        <button onClick={() => onRemove(t.id)}
                          className="text-gray-300 hover:text-red-400 text-sm font-bold leading-none transition-colors flex-shrink-0 px-1.5 py-1"
                          title="Delete permanently">✕</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        : targets.length > 0 ? null : <p className="text-gray-400 text-sm italic mb-4">{placeholder}</p>}
      {hiddenTargets.length > 0 && (
        <ul className="space-y-2 mb-4">
          {hiddenTargets.map(t => (
            <li key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm"
              style={{ background: "#F9F9F9", border: "1px dashed #D1D5DB" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
              <span className="flex-1 font-medium text-gray-400 italic leading-snug whitespace-pre-wrap">{t.text}</span>
              <button onClick={() => unhideTarget(t.id)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0">
                Unhide
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 items-end">
        <textarea value={val} onChange={e => setVal(e.target.value)}
          placeholder="Add a new target…" maxLength={500} rows={2}
          className="flex-1 w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-y"
          style={{ borderColor: "#E8DDD5", background: "#FDFAF7" }}
          onFocus={e => { e.target.style.borderColor = CORAL; e.target.style.boxShadow = `0 0 0 3px rgba(224,92,92,0.1)`; }}
          onBlur={e => { e.target.style.borderColor = "#E8DDD5"; e.target.style.boxShadow = "none"; }} />
        <button onClick={add}
          className={`px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 ${barColor} hover:opacity-90`}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Shared target card (reusable per tier) ────────────────────────────────────
const TARGET_CFG = {
  universal:  { accent: "bg-emerald-500", bar: "bg-emerald-600", dot: "bg-emerald-500", bg: "#F0FDF4", label: "Universal Targets",  labelColor: "text-emerald-700" },
  targeted:   { accent: "bg-sky-500",     bar: "bg-sky-600",     dot: "bg-sky-500",     bg: "#F0F9FF", label: "Targeted Targets",   labelColor: "text-sky-700"     },
  specialist: { accent: "bg-violet-500",  bar: "bg-violet-600",  dot: "bg-violet-500",  bg: "#F5F3FF", label: "Specialist Targets", labelColor: "text-violet-700"  },
};
function TargetCard({ level, child, updateChild, showToast }) {
  const cfg = TARGET_CFG[level];
  const confirm = useConfirm();

  const handleAdd = async (text) => {
    const ok = await confirm(`Add this ${level} target for ${child.name}?`, { label: "Add target" });
    if (!ok) return;
    try {
      const rows = await insertTarget(child.supabaseTermId, level, text);
      if (!rows?.length) throw new Error("Could not save — please try again.");
      const row = rows[0];
      updateChild(child.id, c => ({
        currentTargets: {
          ...c.currentTargets,
          [level]: [...c.currentTargets[level], {
            id: row.id,
            text: row.target,
            status: row.status || "in_progress",
            date_added: row.date_added || null,
            date_updated: row.date_updated || null,
            cleared: row.cleared ?? false,
          }],
        },
      }));
      showToast("Target added ✓");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  const handleEdit = async (targetId, newText) => {
    const ok = await confirm("Save changes to this target?", { label: "Save" });
    if (!ok) return;
    try {
      const rows = await patchTarget(targetId, newText);
      const updated = rows?.[0];
      updateChild(child.id, c => ({
        currentTargets: {
          ...c.currentTargets,
          [level]: c.currentTargets[level].map(t =>
            t.id === targetId ? { ...t, text: newText, date_updated: updated?.date_updated || new Date().toISOString().slice(0, 10) } : t
          ),
        },
      }));
      showToast("Target updated ✓");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  const handleRemove = async (targetId) => {
    const ok = await confirm("Delete this target permanently? This cannot be undone.", { label: "Delete", danger: true });
    if (!ok) return;
    try {
      await deleteTarget(targetId);
      updateChild(child.id, c => ({
        currentTargets: { ...c.currentTargets, [level]: c.currentTargets[level].filter(t => t.id !== targetId) },
      }));
      showToast("Target deleted");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  const handleStatusToggle = async (targetId, currentStatus) => {
    const newStatus = currentStatus === "completed" ? "in_progress" : "completed";
    try {
      await patchTargetStatus(targetId, newStatus);
      updateChild(child.id, c => ({
        currentTargets: {
          ...c.currentTargets,
          [level]: c.currentTargets[level].map(t =>
            t.id === targetId ? { ...t, status: newStatus, date_updated: new Date().toISOString().slice(0, 10) } : t
          ),
        },
      }));
      showToast(newStatus === "completed" ? "Target marked as completed ✓" : "Target marked as in progress");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  return (
    <Card accent={cfg.accent}>
      <SectionLabel color={cfg.labelColor}>{cfg.label}</SectionLabel>
      <TargetList
        targets={child.currentTargets[level]}
        barColor={cfg.bar} dotColor={cfg.dot} itemBg={cfg.bg}
        placeholder={`No ${level} targets set yet`}
        onAdd={handleAdd} onEdit={handleEdit} onRemove={handleRemove}
        onStatusToggle={handleStatusToggle}
      />
    </Card>
  );
}

// ── Change intervention level card ────────────────────────────────────────────
function ChangeTierCard({ child, updateChild, showToast, setSection }) {
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();
  const LEVELS = ["universal", "targeted", "specialist"];
  const current = child.tiers.includes("specialist") ? "specialist"
                : child.tiers.includes("targeted")   ? "targeted"
                : "universal";
  const handleChange = async (newLevel) => {
    if (newLevel === current) { setChanging(false); return; }
    const ok = await confirm(`Change ${child.name}'s intervention level to ${newLevel}?`, { label: "Change level" });
    if (!ok) return;
    setSaving(true);
    try {
      await patchCaseloadTerm(child.supabaseTermId, { intervention_level: newLevel });
      updateChild(child.id, () => ({ tiers: [newLevel] }));
      setSection(newLevel);
      showToast(`Intervention level changed to ${newLevel} ✓`);
      setChanging(false);
    } catch (err) { showToast(friendlyError(err), "error"); }
    finally { setSaving(false); }
  };
  return (
    <Card accent="bg-gray-300">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel color="text-gray-600">Intervention Level</SectionLabel>
        <button onClick={() => setChanging(v => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          {changing ? "Cancel" : "Change level"}
        </button>
      </div>
      {changing ? (
        <div className="flex gap-2">
          {LEVELS.map(level => (
            <button key={level} onClick={() => handleChange(level)} disabled={saving}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold capitalize transition-colors disabled:opacity-50
                ${level === current ? `${TC[level].bar} text-white` : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {level}
            </button>
          ))}
        </div>
      ) : (
        <TierPill tier={current} />
      )}
    </Card>
  );
}

function UniversalSection({ child, updateChild, showToast, setSection }) {
  return (
    <div className="space-y-4">
      <ChangeTierCard child={child} updateChild={updateChild} showToast={showToast} setSection={setSection} />
      <TargetCard level="universal" child={child} updateChild={updateChild} showToast={showToast} />
    </div>
  );
}

function TargetedSection({ child, updateChild, showToast, setSection }) {
  return (
    <div className="space-y-4">
      <ChangeTierCard child={child} updateChild={updateChild} showToast={showToast} setSection={setSection} />
      <TargetCard level="targeted" child={child} updateChild={updateChild} showToast={showToast} />
      <TargetCard level="universal" child={child} updateChild={updateChild} showToast={showToast} />
    </div>
  );
}

// ── EHCP Tracker Card ─────────────────────────────────────────────────────────
function EhcpTrackerCard({ child, updateChild, showToast }) {
  const totalHours = child.sessionsLogged.filter(s => s.ehcp_session).reduce((s, sess) => s + sess.duration, 0) / 60;
  const pct = child.ehcpHours > 0 ? Math.min(100, (totalHours / child.ehcpHours) * 100) : 0;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setVal(child.ehcpHours || ""); setEditing(true); };
  const cancel = () => { setEditing(false); setSaving(false); };

  const save = async () => {
    const hrs = +val;
    if (!hrs || hrs <= 0 || !Number.isFinite(hrs)) {
      showToast("Please enter a valid number of hours", "error"); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("caseload_terms_uat")
        .update({ ehcp_hours: hrs })
        .eq("id", child.supabaseTermId);
      if (error) throw new Error(error.message);
      updateChild(child.id, () => ({ ehcpHours: hrs }));
      setEditing(false);
      showToast("EHCP hours updated ✓");
    } catch (err) { showToast(err.message || "Something went wrong", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Card accent="bg-violet-500">
      <SectionLabel color="text-violet-700">EHCP Hours Tracker</SectionLabel>
      <div className="flex gap-8 mb-4 items-end">
        <div>
          <p className="text-2xl font-bold text-gray-800" style={FH}>{totalHours.toFixed(1)}h</p>
          <p className="text-xs text-gray-400 mt-0.5">Delivered</p>
        </div>
        <div>
          {editing ? (
            <div className="flex items-center gap-1">
              <input type="number" value={val} min="1" autoFocus
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
                className="w-20 border-b-2 border-violet-400 text-2xl font-bold text-gray-800 bg-transparent outline-none text-center"
                style={FH} />
              <span className="text-2xl font-bold text-gray-800" style={FH}>h</span>
              <button onClick={save} disabled={saving} className="text-xs font-semibold px-2 py-1 rounded-lg text-white ml-1 disabled:opacity-50" style={{ background: "#6D28D9" }}>{saving ? "…" : "✓"}</button>
              <button onClick={cancel} disabled={saving} className="text-xs font-semibold px-2 py-1 rounded-lg text-gray-500 bg-gray-100 disabled:opacity-50">✕</button>
            </div>
          ) : (
            <button onClick={startEdit} className="group text-left">
              <p className="text-2xl font-bold text-gray-800 group-hover:text-violet-600 transition-colors" style={FH}>
                {child.ehcpHours.toFixed(0)}h <span className="text-sm font-normal text-gray-300 group-hover:text-violet-400">✎</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Allocated</p>
            </button>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800" style={FH}>{(child.ehcpHours - totalHours).toFixed(1)}h</p>
          <p className="text-xs text-gray-400 mt-0.5">Remaining</p>
        </div>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: "#F5EFE8" }}>
        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{pct.toFixed(0)}% of annual allocation used</p>
    </Card>
  );
}

// ── Specialist ────────────────────────────────────────────────────────────────
function SpecialistSection({ child, updateChild, showToast, setSection }) {
  return (
    <div className="space-y-4">
      <ChangeTierCard child={child} updateChild={updateChild} showToast={showToast} setSection={setSection} />
      {child.ehcp && (
        <EhcpTrackerCard child={child} updateChild={updateChild} showToast={showToast} />
      )}
      <TargetCard level="specialist" child={child} updateChild={updateChild} showToast={showToast} />
      <TargetCard level="targeted" child={child} updateChild={updateChild} showToast={showToast} />
      <TargetCard level="universal" child={child} updateChild={updateChild} showToast={showToast} />
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────
function SessionsSection({ child, updateChild, showToast }) {
  const [newSession, setNewSession] = useState({ date: "", duration: 45, type: "Individual", notes: "", ehcp_session: false });
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const confirm = useConfirm();

  useEffect(() => {
    if (!child.id) return;
    setSessionsLoading(true);
    fetchSessions(child.id)
      .then(rows => {
        const sessions = (rows || []).map(r => ({ id: r.id, date: r.date, duration: r.duration, type: r.type, notes: r.notes || "", ehcp_session: r.ehcp_session ?? false }));
        updateChild(child.id, c => ({ sessionsLogged: sessions }));
      })
      .catch(err => console.error("Failed to load sessions:", err))
      .finally(() => setSessionsLoading(false));
  }, [child.id]);

  const logSession = async () => {
    if (!newSession.date) { showToast("Please select a date", "error"); return; }
    // Bug 3 — validate duration before confirm
    const dur = +newSession.duration;
    if (!dur || dur <= 0 || !Number.isFinite(dur)) {
      showToast("Duration must be a positive number of minutes", "error"); return;
    }
    const ok = await confirm(`Log this session for ${child.name}?`, { label: "Log session" });
    if (!ok) return;
    try {
      // Bug 2 — bounds-checked
      const savedRows = await insertSession(child.id, newSession);
      if (!savedRows?.length) throw new Error("Could not save — please try again.");
      const saved = savedRows[0];
      const session = { id: saved.id, date: saved.date, duration: saved.duration, type: saved.type, notes: saved.notes || "", ehcp_session: saved.ehcp_session ?? false };
      updateChild(child.id, c => ({ sessionsLogged: [...c.sessionsLogged, session] }));
      setNewSession({ date: "", duration: 45, type: "Individual", notes: "", ehcp_session: false });
      showToast("Session logged ✓");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  const startEdit = (s) => { setEditingId(s.id); setEditForm({ date: s.date, duration: s.duration, type: s.type, notes: s.notes, ehcp_session: s.ehcp_session ?? false }); };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    // Bug 3 — validate duration on edit too
    const dur = +editForm.duration;
    if (!dur || dur <= 0 || !Number.isFinite(dur)) {
      showToast("Duration must be a positive number of minutes", "error"); return;
    }
    const ok = await confirm("Save changes to this session?", { label: "Save" });
    if (!ok) return;
    try {
      await patchSession(editingId, { date: editForm.date, duration: +editForm.duration, type: editForm.type, notes: editForm.notes || null, ehcp_session: editForm.ehcp_session ?? false });
      updateChild(child.id, c => ({
        sessionsLogged: c.sessionsLogged.map(s => s.id === editingId ? { ...s, ...editForm, duration: +editForm.duration } : s),
      }));
      cancelEdit();
      showToast("Session updated ✓");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  const removeSession = async (sessionId) => {
    const ok = await confirm("Delete this session? This cannot be undone.", { label: "Delete", danger: true });
    if (!ok) return;
    try {
      await deleteSession(sessionId);
      updateChild(child.id, c => ({ sessionsLogged: c.sessionsLogged.filter(s => s.id !== sessionId) }));
      showToast("Session deleted");
    } catch (err) { showToast(friendlyError(err), "error"); }
  };

  return (
    <div className="space-y-4">
      <Card accent="bg-sky-400">
        <SectionLabel color="text-sky-700">Log a Session</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <SInput type="date" value={newSession.date}
            onChange={e => setNewSession(s => ({ ...s, date: e.target.value }))} placeholder="" />
          {/* Bug 3 — min="1" prevents ≤0 duration */}
          <SInput type="number" value={newSession.duration} placeholder="Duration (mins)" min="1"
            onChange={e => setNewSession(s => ({ ...s, duration: +e.target.value }))} />
          <SSelect value={newSession.type} onChange={e => setNewSession(s => ({ ...s, type: e.target.value }))}>
            <option>Individual</option><option>Group</option><option>Observation</option><option>Consultation</option><option>Review Assessment</option><option>Initial Assessment</option>
          </SSelect>
        </div>
        <textarea value={newSession.notes} onChange={e => setNewSession(s => ({ ...s, notes: e.target.value }))}
          placeholder="Session notes…" maxLength={1000} rows={3}
          className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-y mb-3"
          style={{ borderColor: "#E8DDD5", background: "#FDFAF7" }}
          onFocus={e => { e.target.style.borderColor = CORAL; e.target.style.boxShadow = `0 0 0 3px rgba(224,92,92,0.1)`; }}
          onBlur={e => { e.target.style.borderColor = "#E8DDD5"; e.target.style.boxShadow = "none"; }} />
        {child.ehcp && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-3">
            <input type="checkbox" checked={newSession.ehcp_session}
              onChange={e => setNewSession(s => ({ ...s, ehcp_session: e.target.checked }))}
              className="rounded accent-violet-600" />
            Counts towards EHCP allocation
          </label>
        )}
        <PBtn onClick={logSession}>Log Session</PBtn>
      </Card>

      <Card accent="bg-gray-300">
        <SectionLabel>Session History ({child.sessionsLogged.length})</SectionLabel>
        {sessionsLoading ? (
          <p className="text-gray-400 text-sm italic">Loading sessions…</p>
        ) : child.sessionsLogged.length > 0 ? (
          <div className="space-y-2">
            {[...child.sessionsLogged].reverse().map(s => (
              <div key={s.id}>
                {editingId === s.id ? (
                  <div className="p-3 rounded-xl border-2 space-y-2" style={{ borderColor: CORAL, background: "#FFF8F8" }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <SInput type="date" value={editForm.date}
                        onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} placeholder="" />
                      {/* Bug 3 — min="1" on edit form too */}
                      <SInput type="number" value={editForm.duration} placeholder="Duration (mins)" min="1"
                        onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} />
                      <SSelect value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                        <option>Individual</option><option>Group</option><option>Observation</option><option>Consultation</option><option>Review Assessment</option><option>Initial Assessment</option>
                      </SSelect>
                    </div>
                    <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Session notes…" maxLength={1000} rows={3}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-y"
                      style={{ borderColor: "#E8DDD5", background: "#FDFAF7" }}
                      onFocus={e => { e.target.style.borderColor = CORAL; e.target.style.boxShadow = `0 0 0 3px rgba(224,92,92,0.1)`; }}
                      onBlur={e => { e.target.style.borderColor = "#E8DDD5"; e.target.style.boxShadow = "none"; }} />
                    {child.ehcp && (
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={editForm.ehcp_session ?? false}
                          onChange={e => setEditForm(f => ({ ...f, ehcp_session: e.target.checked }))}
                          className="rounded accent-violet-600" />
                        Counts towards EHCP allocation
                      </label>
                    )}
                    <div className="flex gap-2 pt-1">
                      <PBtn onClick={saveEdit} className="text-xs py-1.5 px-3">Save</PBtn>
                      <SBtn onClick={cancelEdit} className="text-xs py-1.5 px-3">Cancel</SBtn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "#F9F5F2" }}>
                    <div className="rounded-lg px-2.5 py-1 text-xs font-bold text-white flex-shrink-0"
                      style={{ background: CORAL }}>{s.date}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-600">{s.duration}min</span>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s.type}</span>
                        {s.ehcp_session && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">EHCP</span>}
                      </div>
                      {s.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{s.notes}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(s)}
                        className="text-gray-400 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-indigo-50 transition-colors text-sm"
                        title="Edit">✎</button>
                      <button onClick={() => removeSession(s.id)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors text-sm"
                        title="Delete">🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400 text-sm italic">No sessions logged yet</p>}
      </Card>
    </div>
  );
}

// ── Parent ────────────────────────────────────────────────────────────────────
function ParentSection({ child }) {
  return (
    <Card accent="bg-amber-400">
      <SectionLabel color="text-amber-700">Approved Resources</SectionLabel>
      {(child.approvedResources || []).length > 0
        ? child.approvedResources.map((r, i) => (
            <div key={i} className="rounded-xl p-4 mb-3" style={{ background: "#FFFBF0", border: "1px solid #FDE68A" }}>
              <div className="flex justify-between text-xs font-semibold text-gray-400 mb-2">
                <span className="text-amber-700">{r.season} Resource</span>
                <span>{r.generatedDate}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{r.content.substring(0, 200)}…</p>
            </div>
          ))
        : <p className="text-gray-400 text-sm italic">No approved resources yet</p>}
    </Card>
  );
}

// ── Files ─────────────────────────────────────────────────────────────────────
function FilesSection({ child, updateChild, showToast }) {
  const [url, setUrl] = useState(""); const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const add = () => {
    if (!url.trim()) { showToast("Please enter a URL", "error"); return; }
    updateChild(child.id, c => ({
      videos: [...(c.videos || []), { url, title: title || "Strategy video", desc, date: new Date().toLocaleDateString() }]
    }));
    setUrl(""); setTitle(""); setDesc("");
    showToast("Video added ✓");
  };
  return (
    <Card accent="bg-rose-400">
      <SectionLabel color="text-rose-700">Strategy Video Library</SectionLabel>
      <p className="text-sm text-gray-500 mb-4">Add video links for parents and carers to watch at home.</p>
      {/* Bug 7 — warn that videos are session-only */}
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
        Video links are saved for this session only and will not persist after a page refresh.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <SInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title" />
        <SInput value={url}   onChange={e => setUrl(e.target.value)}   placeholder="YouTube/Vimeo URL" />
        <SInput value={desc}  onChange={e => setDesc(e.target.value)}  placeholder="Description" />
      </div>
      <PBtn onClick={add} className="mb-4">Add Video</PBtn>
      {(child.videos || []).length > 0 && (
        <div className="space-y-2">
          {child.videos.map((v, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#F9F5F2" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "#FFF1F1" }}>🎬</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-700 truncate">{v.title}</p>
                {v.desc && <p className="text-xs text-gray-400">{v.desc}</p>}
              </div>
              <a href={v.url} target="_blank" rel="noreferrer"
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0"
                style={{ background: CORAL }}>Watch →</a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ children, stats, onOpen, onImport, onAdd }) {
  const season = getCurrentSeason();
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${CORAL} 0%, #C94040 100%)` }}>
        <div className="relative z-10">
          <p className="text-3xl mb-2">{season.emoji}</p>
          <h2 className="text-3xl font-bold mb-1" style={FH}>{getGreeting()}</h2>
          <p className="opacity-80 text-sm font-medium">{season.name} term · {stats.total} {stats.total === 1 ? "child" : "children"} on your caseload</p>
          {stats.total === 0 && (
            <div className="mt-5 flex gap-2 flex-wrap">
              <button onClick={onImport} className="bg-white text-rose-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-50 transition-colors">
                ↑ Import caseload
              </button>
              <button onClick={onAdd} className="bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition-colors">
                + Add child
              </button>
            </div>
          )}
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-white opacity-10 pointer-events-none" />
        <div className="absolute -bottom-10 -right-2 w-52 h-52 rounded-full bg-white opacity-10 pointer-events-none" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { l: "Total",      v: stats.total,      bg: "#FFF1F1", text: CORAL,     border: "#FECACA" },
          { l: "Universal",  v: stats.universal,  bg: "#F0FDF4", text: "#065F46", border: "#A7F3D0" },
          { l: "Targeted",   v: stats.targeted,   bg: "#EFF6FF", text: "#1E3A8A", border: "#BFDBFE" },
          { l: "Specialist", v: stats.specialist, bg: "#F5F3FF", text: "#4C1D95", border: "#DDD6FE" },
          { l: "EHCP",       v: stats.ehcp,       bg: "#FFFBEB", text: "#78350F", border: "#FDE68A" },
        ].map(s => (
          <div key={s.l} className="rounded-2xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <p className="text-2xl font-bold" style={{ color: s.text, ...FH }}>{s.v}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: s.text, opacity: 0.7 }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Recent children */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Recent Children</p>
        {children.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-4xl mb-3">🧒</p>
              <p className="text-gray-500 font-semibold">No children on your caseload yet</p>
              <p className="text-gray-400 text-xs mt-1">Use the buttons above to import or add your first child</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {children.slice(0, 6).map(c => (
              <button key={c.id} onClick={() => onOpen(c.id)}
                className="bg-white rounded-2xl p-4 text-left transition-all hover:shadow-md group"
                style={{ border: "1px solid #F0EBE3" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#FECACA"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#F0EBE3"; }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate group-hover:text-rose-600 transition-colors" style={FH}>{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.yearGroup}{c.class ? ` · ${c.class}` : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                    {c.ehcp && <Chip className="bg-violet-100 text-violet-800">EHCP</Chip>}
                    <RagPill status={c.ragStatus} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div>
                <div className="space-y-1.5">
                  {c.tiers.map(t => (
                    <div key={t}>
                      <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span className="capitalize font-medium">{t}</span>
                        <span>{c.progress[t] || 0}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F5EFE8" }}>
                        <div className={`h-full rounded-full ${TC[t]?.bar || "bg-gray-300"}`}
                          style={{ width: `${c.progress[t] || 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Caseload ──────────────────────────────────────────────────────────────────
function Caseload({ children, onOpen, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const filtered = children.filter(c =>
    (filterTier === "all" || c.tiers.includes(filterTier)) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.class || "").toLowerCase().includes(search.toLowerCase()))
  );
  const empty = <p className="text-center text-gray-400 py-10 text-sm font-medium">{children.length === 0 ? "No children on caseload yet." : "No children match your search."}</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <SInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or class…" className="flex-1" />
        <SSelect value={filterTier} onChange={e => setFilterTier(e.target.value)} className="w-36">
          <option value="all">All tiers</option>
          <option value="universal">Universal</option>
          <option value="targeted">Targeted</option>
          <option value="specialist">Specialist</option>
        </SSelect>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #F0EBE3" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "#FDF8F3", borderBottom: "1px solid #EDE6DD" }}>
            <tr>
              {["Name","Year","Class","Tiers","Lead","Term","RAG","EHCP",""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, idx) => (
              <tr key={c.id} className="cursor-pointer transition-colors"
                style={{ borderTop: idx > 0 ? "1px solid #F5EFE8" : "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FFF8F7"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                <td className="px-4 py-3 font-semibold text-gray-800" onClick={() => onOpen(c.id)}>{c.name}</td>
                <td className="px-4 py-3 text-gray-500 text-sm" onClick={() => onOpen(c.id)}>{c.yearGroup}</td>
                <td className="px-4 py-3 text-gray-400 text-xs" onClick={() => onOpen(c.id)}>{c.class || "—"}</td>
                <td className="px-4 py-3" onClick={() => onOpen(c.id)}><div className="flex flex-wrap gap-1">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div></td>
                <td className="px-4 py-3 text-xs text-gray-500" onClick={() => onOpen(c.id)}>{c.lead || "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-500" onClick={() => onOpen(c.id)}>{c.term || "—"}</td>
                <td className="px-4 py-3" onClick={() => onOpen(c.id)}><RagPill status={c.ragStatus} /></td>
                <td className="px-4 py-3" onClick={() => onOpen(c.id)}>{c.ehcp && <Chip className="bg-violet-100 text-violet-800">EHCP</Chip>}</td>
                <td className="px-4 py-3">
                  <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                    className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Remove">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && empty}
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && empty}
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #F0EBE3" }}>
            <div className={`h-1 ${TC[c.tiers[0]]?.bar || "bg-gray-300"}`} />
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-800" style={FH}>{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.yearGroup}{c.class ? ` · ${c.class}` : ""}{c.lead ? ` · ${c.lead}` : ""}</p>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {c.ehcp && <Chip className="bg-violet-100 text-violet-800">EHCP</Chip>}
                  <RagPill status={c.ragStatus} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div>
              <div className="flex gap-2">
                <PBtn onClick={() => onOpen(c.id)} className="flex-1 text-xs py-2">View Profile</PBtn>
                <button onClick={() => onDelete(c.id)}
                  className="text-red-400 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors font-bold">🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Approvals ─────────────────────────────────────────────────────────────────
function Approvals({ queue, setQueue, setChildren, showToast }) {
  const approve = (res) => {
    setChildren(prev => prev.map(c => c.id === res.childId
      ? { ...c, approvedResources: [...(c.approvedResources || []), { ...res, status: "approved" }] } : c));
    setQueue(queue.filter(r => r.id !== res.id));
    showToast("Resource approved ✓");
  };
  const reject = (id) => { setQueue(queue.filter(r => r.id !== id)); showToast("Resource removed"); };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1" style={FH}>Approvals Queue</h2>
        <p className="text-sm text-gray-500">Review AI-generated parent resources before they go live.</p>
      </div>
      {queue.length === 0 ? (
        <Card><div className="text-center py-12"><p className="text-4xl mb-3">✅</p><p className="text-gray-500 font-semibold">Nothing awaiting approval</p></div></Card>
      ) : queue.map(res => (
        <Card key={res.id} accent="bg-amber-400">
          <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
            <div>
              <p className="font-semibold text-gray-800" style={FH}>{res.childName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{res.season} · {res.yearGroup} · {res.generatedDate}</p>
            </div>
            <div className="flex gap-2">
              <PBtn onClick={() => approve(res)}>✓ Approve</PBtn>
              <DBtn onClick={() => reject(res.id)}>✕ Discard</DBtn>
            </div>
          </div>
          <div className="rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
            style={{ background: "#FFFBF0", border: "1px solid #FDE68A" }}>{res.content}</div>
        </Card>
      ))}
    </div>
  );
}

// ── Add Child Modal ───────────────────────────────────────────────────────────
function AddChildModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    name: "", yearGroup: "Year 1", dob: "", tiers: [], difficulties: [],
    ehcp: false, ehcpHours: 0, notes: "", class: "", lead: "",
    senStatus: "", term: "", ragStatus: "", frequency: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleArr = (k, v) => setForm(p => ({ ...p, [k]: p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v] }));

  const submit = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (form.tiers.length === 0) { setError("Please select at least one support tier"); return; }
    // Bug 4 — validate EHCP hours before confirm
    if (form.ehcp && (!form.ehcpHours || form.ehcpHours <= 0)) {
      setError("EHCP annual hours must be greater than 0"); return;
    }
    const ok = await confirm(`Add ${form.name.trim()} to your caseload?`, { label: "Add child" });
    if (!ok) return;
    setError(""); setSaving(true);
    await onAdd({ ...form,
      currentTargets: { universal: [], targeted: [], specialist: [] }, nextTargets: { targeted: [] },
      sessionsLogged: [], progress: { universal: 0, targeted: 0, specialist: 0 },
      approvedResources: [], pendingResources: [], videos: [],
      gender: "", ethnicity: "", language: "", reviewDate: "", additionalNeeds: "", extraFields: {} });
    setSaving(false);
  };

  const TIER_CFG = {
    universal:  { activeBg: "#F0FDF4", activeText: "#065F46", activeBorder: "#A7F3D0" },
    targeted:   { activeBg: "#EFF6FF", activeText: "#1E3A8A", activeBorder: "#BFDBFE" },
    specialist: { activeBg: "#F5F3FF", activeText: "#4C1D95", activeBorder: "#DDD6FE" },
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" style={F}>
      <div className="bg-white w-full sm:max-w-md shadow-2xl max-h-[92vh] overflow-y-auto sm:mx-4"
        style={{ borderRadius: "24px" }}>
        <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800" style={FH}>Add New Child</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-lg">×</button>
          </div>
          {error && <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</div>}

          <div className="space-y-4">
            {/* Bug 14 — max 100 chars on name */}
            <SInput placeholder="Full name *" value={form.name} onChange={e => f("name", e.target.value)} maxLength={100} />
            <div className="grid grid-cols-2 gap-3">
              <SSelect value={form.yearGroup} onChange={e => f("yearGroup", e.target.value)}>
                {["Reception","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6"].map(y => <option key={y}>{y}</option>)}
              </SSelect>
              <SInput type="date" value={form.dob} onChange={e => f("dob", e.target.value)} placeholder="" />
              <SInput placeholder="Class" value={form.class} onChange={e => f("class", e.target.value)} />
              {/* Bug 14 — max 100 chars on lead */}
              <SInput placeholder="SLT Lead" value={form.lead} onChange={e => f("lead", e.target.value)} maxLength={100} />
              <SInput placeholder="Term (e.g. Spring 2)" value={form.term} onChange={e => f("term", e.target.value)} />
              <SSelect value={form.ragStatus} onChange={e => f("ragStatus", e.target.value)}>
                <option value="">RAG Status</option><option>Green</option><option>Amber</option><option>Red</option>
              </SSelect>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Support Tiers *</p>
              <div className="flex gap-2">
                {["universal","targeted","specialist"].map(t => {
                  const active = form.tiers.includes(t);
                  const cfg = TIER_CFG[t];
                  return (
                    <button key={t} onClick={() => toggleArr("tiers", t)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={active
                        ? { background: cfg.activeBg, color: cfg.activeText, border: `2px solid ${cfg.activeBorder}` }
                        : { background: "white", color: "#9CA3AF", border: "2px solid #E5E7EB" }}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Difficulties</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(SLT_HIERARCHIES).map(d => {
                  const active = form.difficulties.includes(d);
                  return (
                    <button key={d} onClick={() => toggleArr("difficulties", d)}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium transition-all"
                      style={active
                        ? { background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #BFDBFE" }
                        : { background: "white", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                      {SLT_HIERARCHIES[d].label.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer font-medium">
                <input type="checkbox" checked={form.ehcp} onChange={e => f("ehcp", e.target.checked)} className="rounded" />
                Has EHCP
              </label>
              {form.ehcp && (
                // Bug 4 — min="1" on EHCP hours
                <SInput type="number" value={form.ehcpHours} onChange={e => f("ehcpHours", +e.target.value)}
                  placeholder="Annual hours" className="flex-1" min="1" />
              )}
            </div>

            {/* Bug 14 — max 2000 chars on notes */}
            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => f("notes", e.target.value)}
              maxLength={2000}
              className="w-full rounded-xl px-3 py-2.5 text-sm h-16 resize-none outline-none"
              style={{ border: "1px solid #E8DDD5", background: "#FDFAF7" }} />
          </div>

          <div className="flex gap-3 mt-6">
            <PBtn onClick={submit} disabled={saving} className="flex-1 py-3">{saving ? "Saving…" : "Add Child"}</PBtn>
            <SBtn onClick={onClose} className="flex-1 py-3">Cancel</SBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, setChildren, showToast }) {
  const [status, setStatus] = useState("");
  const [step, setStep] = useState("upload");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const loadXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("Failed to load XLSX library"));
    document.head.appendChild(s);
  });

  // Bug 9 — valid tier whitelist
  const VALID_TIERS = ["universal", "targeted", "specialist"];

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setStatus("Reading file…"); setStep("upload");
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) { setStatus("No data found in file."); return; }
      const find = (...keys) => Object.keys(rows[0]).find(h => keys.some(k => h.toLowerCase().includes(k))) || "";
      const nameCol = find("name","full_name"); const yearCol = find("year");
      const classCol = find("class"); const dobCol = find("dob","birth");
      const ehcpCol = find("ehcp"); const leadCol = find("lead");
      const tierCol = find("tier","intervention","level"); const diffCol = find("area","need","difficulty","primary");
      const notesCol = find("notes"); const termCol = find("term");
      const ragCol = find("rag"); const freqCol = find("freq");
      const mapped = rows.map(r => {
        const name = String(r[nameCol] || "").trim();
        if (!name || /^child\s*\d+$/i.test(name)) return null;

        // Bug 10 — validate DOB is a real date
        const dobRaw = r[dobCol] ? String(r[dobCol]).trim() : "";
        const dobDate = dobRaw ? new Date(dobRaw) : null;
        const dob = (dobDate && !isNaN(dobDate.getTime())) ? dobRaw : "";

        // Bug 9 — clamp tiers to whitelist
        const parsedTiers = String(r[tierCol] || "universal").toLowerCase().split(/[,/]/).map(s => s.trim()).filter(Boolean);
        const tiers = parsedTiers.filter(t => VALID_TIERS.includes(t));

        return {
          name, dob,
          yearGroup: String(r[yearCol] || "").trim(), class: String(r[classCol] || "").trim(),
          ehcp: ["yes","true","1","y"].includes(String(r[ehcpCol] || "").toLowerCase().trim()),
          lead: String(r[leadCol] || "").trim(),
          tiers: tiers.length ? tiers : ["universal"],
          difficulties: String(r[diffCol] || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
          notes: String(r[notesCol] || "").trim(), term: String(r[termCol] || "").trim(),
          ragStatus: String(r[ragCol] || "").trim(), frequency: String(r[freqCol] || "").trim(),
          currentTargets: { universal: [], targeted: [], specialist: [] }, nextTargets: { targeted: [] },
          sessionsLogged: [], progress: { universal: 0, targeted: 0, specialist: 0 },
          approvedResources: [], pendingResources: [], videos: [],
          gender: "", ethnicity: "", language: "", reviewDate: "", additionalNeeds: "", extraFields: {},
        };
      }).filter(Boolean);

      // Bug 8 — explicit post-parse name validation
      const valid = mapped.filter(c => c.name && c.name !== "undefined" && c.name.trim().length >= 2);
      const skipped = mapped.length - valid.length;
      if (skipped > 0) setStatus(`${skipped} row(s) skipped — name not recognised. Check headers include "Name" or "Full Name".`);
      if (!valid.length) { setStatus("No valid children found. Check column headers."); return; }
      setPreview(valid); setStep("preview"); if (!skipped) setStatus("");
    } catch (err) { console.error(err); setStatus(`Error: ${err.message}`); }
  };

  const confirmImport = async () => {
    if (!preview) return;
    const confirmed = await confirm(`Import ${preview.length} ${preview.length === 1 ? "child" : "children"} into your caseload?`, { label: "Import" });
    if (!confirmed) return;
    setSaving(true); let ok = 0; let failed = 0;
    for (const child of preview) {
      try {
        // Bug 2 — bounds-checked
        const childRows = await upsertChild(child);
        if (!childRows?.length) throw new Error("Could not save — please try again.");
        const childRow = childRows[0];
        const termRows = await insertCaseloadTerm(childRow.id, child);
        const termId = termRows?.[0]?.id;
        if (termId) {
          for (const level of ["universal", "targeted", "specialist"]) {
            for (const item of (child.currentTargets[level] || [])) {
              const text = typeof item === "string" ? item : item.text;
              if (text) await insertTarget(termId, level, text);
            }
          }
        }
        ok++;
      } catch (err) { console.error(`Failed for ${child.name}:`, err); failed++; }
    }
    try {
      const rows = await fetchCaseload();
      if (rows && rows.length > 0) {
        const dedupedRows = dedupeByLatestTerm(rows);
        const termIds = dedupedRows.map(r => r.id).filter(Boolean);
        const targetRows = termIds.length ? await fetchTargetsForTerms(termIds) : [];
        const byTerm = {};
        targetRows.forEach(t => {
          if (!byTerm[t.term_id]) byTerm[t.term_id] = { universal: [], targeted: [], specialist: [] };
          if (byTerm[t.term_id][t.level]) byTerm[t.term_id][t.level].push({
            id: t.id,
            text: t.target,
            status: t.status || "in_progress",
            date_added: t.date_added || null,
            date_updated: t.date_updated || null,
            cleared: t.cleared ?? false,
          });
        });
        setChildren(dedupedRows.map(row => ({ ...mapRowToChild(row), currentTargets: byTerm[row.id] || { universal: [], targeted: [], specialist: [] } })));
      }
    } catch {}
    setSaving(false);
    showToast(`✓ Imported ${ok} children${failed ? ` (${failed} failed — check console)` : ""}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" style={F}>
      <div className="bg-white w-full sm:max-w-2xl shadow-2xl max-h-[92vh] flex flex-col sm:mx-4"
        style={{ borderRadius: "24px 24px 0 0" }}>
        <div className="sm:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="p-5 flex justify-between items-start border-b" style={{ borderColor: "#F0EBE3" }}>
          <div>
            <h3 className="text-xl font-bold text-gray-800" style={FH}>Import Caseload</h3>
            <p className="text-xs text-gray-400 mt-0.5">Upload Excel or CSV — saves directly to Supabase</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-lg">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div>
              <label className="flex flex-col items-center p-10 rounded-2xl text-center cursor-pointer transition-all"
                style={{ border: `2px dashed #FECACA`, background: "#FFF8F7" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = CORAL; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#FECACA"; }}>
                <p className="text-4xl mb-3">📊</p>
                <p className="text-gray-700 font-semibold mb-1">Choose your caseload file</p>
                <p className="text-xs text-gray-400 mb-4">Supports .xlsx, .xls, .csv</p>
                <span className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: CORAL }}>Choose File</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </label>
              {status && (
                <div className="mt-4 rounded-xl p-4" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <p className="text-sm text-blue-700 font-medium">{status}</p>
                </div>
              )}
            </div>
          )}
          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: "#F0FDF4", border: "1px solid #A7F3D0" }}>
                <p className="text-emerald-800 font-semibold text-sm">✓ {preview.length} children ready to import</p>
                {status && <p className="text-amber-700 text-xs mt-1">{status}</p>}
              </div>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #F0EBE3" }}>
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-widest" style={{ background: "#FDF8F3" }}>
                  Preview — first 5
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F0EBE3" }}>
                      {["Name","Year","Tiers","Lead","EHCP"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((c, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? "1px solid #F5EFE8" : "none" }}>
                        <td className="px-4 py-2.5 font-semibold text-gray-800">{c.name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{c.yearGroup}</td>
                        <td className="px-4 py-2.5"><div className="flex gap-1">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div></td>
                        <td className="px-4 py-2.5 text-gray-500">{c.lead || "—"}</td>
                        <td className="px-4 py-2.5">{c.ehcp ? <Chip className="bg-violet-100 text-violet-800">EHCP</Chip> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 flex gap-3 border-t" style={{ borderColor: "#F0EBE3" }}>
          {step === "preview" && (
            <PBtn onClick={confirmImport} disabled={saving} className="flex-1 py-3">
              {saving ? "Saving to Supabase…" : `✓ Import ${preview?.length} Children`}
            </PBtn>
          )}
          {step === "preview" && (
            <SBtn onClick={() => { setStep("upload"); setPreview(null); setStatus(""); }} className="py-3">← Re-upload</SBtn>
          )}
          <SBtn onClick={onClose} className={`${step === "preview" ? "" : "flex-1"} py-3`}>Cancel</SBtn>
        </div>
      </div>
    </div>
  );
}
