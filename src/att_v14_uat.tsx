// @ts-nocheck
import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";

/*
  TIPTAP INSTALL — run in your project root before deploying:
  npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
    @tiptap/extension-underline @tiptap/extension-text-style \
    @tiptap/extension-color

  TIPTAP CSS — add to your global CSS file (e.g. index.css):
  .ProseMirror ul { list-style-type: disc; padding-left: 1.2em; }
  .ProseMirror ol { list-style-type: decimal; padding-left: 1.2em; }
  .ProseMirror p { margin: 0 0 0.25em; }
  .ProseMirror p:last-child { margin-bottom: 0; }
  .prose ul { list-style-type: disc; padding-left: 1.2em; }
  .prose ol { list-style-type: decimal; padding-left: 1.2em; }
  .prose p { margin: 0 0 0.25em; }

  FONT SETUP — add to your index.html <head>:
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  DESIGN SYSTEM: Template 02 "Tide — Menthe"
  Nectarine:  #D7897F
  Pêche:      #F9B95C
  Menthe:     #96C7B3
  MentheDeep: #6aaa95
  Ink:        #2a2320
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

async function fetchTargetsForChildren(childIds) {
  if (!childIds.length) return [];
  return supabaseFetch(`targets_uat?child_id=in.(${childIds.join(",")})&order=date_added.asc`);
}
async function insertTarget(childId, level, text) {
  const today = new Date().toISOString().slice(0, 10);
  return supabaseFetch("targets_uat", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ child_id: childId, level, target: text, status: "in_progress", date_added: today, cleared: false }),
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

function dedupeByLatestTerm(rows) {
  const ord = { "Autumn 1": 1, "Autumn 2": 2, "Spring 1": 3, "Spring 2": 4, "Summer 1": 5, "Summer 2": 6 };
  const map = {};
  rows.forEach(r => {
    const id = (r.children_uat && r.children_uat.id) || r.child_id;
    if (!id) return;
    const existing = map[id];
    if (!existing) { map[id] = r; return; }
    const rOrd = ord[r.term] || 0;
    const eOrd = ord[existing.term] || 0;
    if (rOrd > eOrd || (rOrd === eOrd && (r.created_at || "") > (existing.created_at || ""))) {
      map[id] = r;
    }
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

// ── Design tokens — Template 02 "Tide — Menthe" ─────────────────────────────
const NECTARINE = "#D7897F";
const PECHE     = "#F9B95C";
const MENTHE    = "#96C7B3";
const MENTHE_DEEP = "#6aaa95";
const LAGUNE    = MENTHE_DEEP;
const INK       = "#2a2320";
const INK_SOFT  = "#5a4f4a";
const BG        = "#e8f4f0";
const SURFACE   = "#FFFFFF";
const MID       = INK_SOFT;
const BORDER    = "#e4ddd8";
const SAND_SURFACE = "#faf7f4";
const SOFT      = "#f2ede8";
const SIDEBAR   = "#1e3830";
const CORAL     = NECTARINE;
const YELLOW    = PECHE;
const SAND      = PECHE;
const POPPINS = "'Poppins', sans-serif";
const F       = { fontFamily: POPPINS };
const FM      = F;
const FH      = F;
const FMONO   = F;

const TC = {
  universal:  { bg: "rgba(150,199,179,0.15)", text: "#276e5a", border: "rgba(150,199,179,0.5)", dot: MENTHE },
  targeted:   { bg: "rgba(106,170,149,0.12)", text: MENTHE_DEEP, border: "rgba(150,199,179,0.35)", dot: MENTHE_DEEP },
  specialist: { bg: "rgba(215,137,127,0.13)", text: INK, border: "rgba(215,137,127,0.38)", dot: NECTARINE },
};
const RAG = {
  Green: { bg: "rgba(150,199,179,0.15)", text: "#276e5a", dot: MENTHE },
  Amber: { bg: "rgba(249,185,92,0.16)", text: "#b45309", dot: PECHE },
  Red:   { bg: "rgba(215,137,127,0.16)", text: "#8f3e36", dot: NECTARINE },
};

// ── Atoms — Template 02 Tide/Menthe ───────────────────────────────────────────
function TierPill({ tier }) {
  const c = TC[tier] || TC.universal;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 border"
      style={{ ...FM, letterSpacing: "0.05em", background: c.bg, color: c.text, borderColor: c.border }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {tier.toUpperCase()}
    </span>
  );
}
function RagPill({ status }) {
  if (!status) return null;
  const c = RAG[status] || { bg: SOFT, text: MID, dot: MID };
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5"
      style={{ ...FM, letterSpacing: "0.05em", background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {status.toUpperCase()}
    </span>
  );
}
function Chip({ children, className = "" }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 ${className}`}
      style={{ ...FM, letterSpacing: "0.05em" }}>
      {children}
    </span>
  );
}

// Tide card — rounded white panel with a slim Menthe tide line
function Card({ children, accent, className = "" }) {
  return (
    <div className={`overflow-hidden ${className}`}
      style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 10px 32px rgba(42,35,32,0.06)" }}>
      {accent && (
        <div className="w-full px-4 py-2 flex items-center justify-between" style={{ background: MENTHE }}>
          <span className="text-xs uppercase" style={{ ...FMONO, color: "rgba(255,255,255,0.95)", letterSpacing: "0.2em" }}>
            {accent}
          </span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function SectionLabel({ children, color = "" }) {
  // color was previously a Tailwind class like "text-emerald-700"
  // Template 02 uses the same muted label colour across cards.
  return (
    <p className="text-xs uppercase mb-3"
      style={{ ...FMONO, color: MID, letterSpacing: "0.18em" }}>
      {children}
    </p>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b last:border-0"
      style={{ borderColor: BORDER }}>
      <span className="text-xs w-32 flex-shrink-0" style={{ ...FM, color: MID }}>{label}</span>
      <span className="text-sm font-medium flex-1" style={{ ...FM, color: INK }}>
        {value || <span style={{ color: "#c4bbb2" }}>—</span>}
      </span>
    </div>
  );
}

// Stat badge — compact Template 02 cell style
function StatBadge({ label, value, bg, text }) {
  // bg and text are Tailwind classes from old code — map to Tide styles
  const isYellow = bg.includes("amber") || bg.includes("yellow");
  const isBlack  = bg.includes("violet") || bg.includes("rose") || bg.includes("sky-6");
  return (
    <div className="flex-shrink-0 p-3 text-center"
      style={{
        minWidth: 76,
        background: isYellow ? "rgba(249,185,92,0.09)" : isBlack ? SIDEBAR : SURFACE,
        border: `1px solid ${BORDER}`,
        color: isBlack ? PECHE : INK,
        borderRadius: 10,
      }}>
      <p className="text-xl font-bold leading-none" style={FM}>{value}</p>
      <p className="text-xs mt-1 opacity-80 leading-tight" style={FM}>{label}</p>
    </div>
  );
}

function PBtn({ children, onClick, disabled = false, className = "" }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`px-4 py-2 text-sm font-semibold disabled:opacity-40 ${className}`}
      style={{
        ...FM,
        background: disabled ? SOFT : MENTHE,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        transform: hov && !disabled ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov && !disabled ? "0 8px 18px rgba(42,35,32,0.14)" : "none",
        transition: "box-shadow 0.12s ease, transform 0.12s ease",
      }}>
      {children}
    </button>
  );
}
function SBtn({ children, onClick, className = "" }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`px-4 py-2 text-sm font-semibold ${className}`}
      style={{
        ...FM,
        background: SURFACE,
        color: MENTHE_DEEP,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hov ? "0 8px 18px rgba(42,35,32,0.1)" : "none",
        transition: "box-shadow 0.12s ease, transform 0.12s ease",
      }}>
      {children}
    </button>
  );
}
function DBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="px-4 py-2 text-sm font-semibold"
      style={{
        ...FM,
        background: hov ? "#9F2E1D" : "#FFE1DC",
        color: hov ? "#fff" : "#9F2E1D",
        border: "2px solid #9F2E1D",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hov ? `2px 2px 0 #5c1a0f` : "none",
        transition: "box-shadow 0.12s ease, transform 0.12s ease, background 0.12s ease, color 0.12s ease",
      }}>
      {children}
    </button>
  );
}

function SInput({ value, onChange, placeholder, type = "text", onKeyDown, className = "", min, maxLength }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      onKeyDown={onKeyDown} min={min} maxLength={maxLength}
      className={`w-full px-3 py-2.5 text-sm outline-none transition-all ${className}`}
      style={{ ...F, background: SAND_SURFACE, border: `1px solid ${BORDER}`, color: INK, borderRadius: 8 }}
      onFocus={e => { e.target.style.borderColor = MENTHE; e.target.style.boxShadow = `0 0 0 3px rgba(150,199,179,0.18)`; }}
      onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = "none"; }}
    />
  );
}
function SSelect({ value, onChange, children, className = "" }) {
  return (
    <select value={value} onChange={onChange}
      className={`w-full px-3 py-2.5 text-sm outline-none ${className}`}
      style={{ ...F, background: SAND_SURFACE, border: `1px solid ${BORDER}`, color: INK, borderRadius: 8 }}>
      {children}
    </select>
  );
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="px-4 py-3 flex items-start gap-3"
      style={{ background: "#FFE1DC", border: `2px solid #9F2E1D` }}>
      <span className="text-red-700 flex-shrink-0 mt-0.5" style={FM}>⚠</span>
      <p className="text-sm flex-1" style={{ color: "#9F2E1D", ...F }}>{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-700 hover:text-red-900 text-xl font-bold ml-2 leading-none">×</button>
      )}
    </div>
  );
}

// ── Rich text editor (Tiptap) ─────────────────────────────────────────────────
function ToolbarBtn({ onClick, active, title, children }) {
  return (
    <button type="button" onMouseDown={e => { e.preventDefault(); onClick(); }} title={title}
      className="flex items-center justify-center transition-all flex-shrink-0 select-none"
      style={{
        width: 26, height: 24, fontSize: 12,
        ...FM,
        fontWeight: 700,
        background: active ? YELLOW : "transparent",
        color: active ? INK : "rgba(255,255,255,0.72)",
      }}>
      {children}
    </button>
  );
}

// Colour picker used in toolbar
const TEXT_COLOURS = [
  { label: "Lagune", value: LAGUNE },
  { label: "Coral",  value: "#E05C5C" },
  { label: "Blue",   value: "#1D4ED8" },
  { label: "Green",  value: "#2a2320" },
  { label: "Purple", value: "#6D28D9" },
  { label: "Nectarine", value: NECTARINE },
  { label: "Grey",   value: "#6B7280" },
];

function RichTextEditor({ content, onChange, placeholder = "Type here…", minHeight = 80 }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, orderedList: false }),
      BulletList,
      OrderedList,
      Underline,
      TextStyle,
      Color,
    ],
    content: content || "",
    onUpdate: ({ editor }) => { onChange(editor.getHTML()); },
    editorProps: {
      attributes: {
        class: "outline-none text-sm text-gray-700 leading-relaxed",
        style: `min-height:${minHeight}px; padding: 10px 12px;`,
      },
    },
  });

  const [showColours, setShowColours] = useState(false);

  // Sync external content changes (e.g. when parent resets the field)
  const prevContent = useRef(content);
  useEffect(() => {
    if (editor && content !== prevContent.current && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
    prevContent.current = content;
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden transition-all"
      style={{ border: `2px solid ${BORDER}`, background: "#faf7f4" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap"
        style={{ borderColor: INK, background: INK }}>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")} title="Bold">B</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")} title="Italic"><em>I</em></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")} title="Underline"><u>U</u></ToolbarBtn>

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "#404040" }} />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")} title="Bullet list">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="2" cy="4" r="1.5"/><rect x="5" y="3" width="10" height="2" rx="1"/>
            <circle cx="2" cy="8" r="1.5"/><rect x="5" y="7" width="10" height="2" rx="1"/>
            <circle cx="2" cy="12" r="1.5"/><rect x="5" y="11" width="10" height="2" rx="1"/>
          </svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")} title="Numbered list">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <text x="0" y="5" fontSize="5" fontFamily={POPPINS}>1.</text>
            <rect x="5" y="3" width="10" height="2" rx="1"/>
            <text x="0" y="9.5" fontSize="5" fontFamily={POPPINS}>2.</text>
            <rect x="5" y="7" width="10" height="2" rx="1"/>
            <text x="0" y="14" fontSize="5" fontFamily={POPPINS}>3.</text>
            <rect x="5" y="11" width="10" height="2" rx="1"/>
          </svg>
        </ToolbarBtn>

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "#404040" }} />

        {/* Colour picker */}
        <div className="relative flex-shrink-0">
          <ToolbarBtn onClick={() => setShowColours(v => !v)} active={showColours} title="Text colour">
            <span style={{ fontSize: 13, fontFamily: POPPINS, fontWeight: 700 }}>A▾</span>
          </ToolbarBtn>
          {showColours && (
            <div className="absolute top-8 left-0 z-20 shadow-lg p-2.5 flex gap-2 flex-wrap"
              style={{ background: "#faf7f4", border: `2px solid ${INK}`, minWidth: 148 }}>
              {TEXT_COLOURS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => { editor.chain().focus().setColor(c.value).run(); setShowColours(false); }}
                  title={c.label}
                  className="w-6 h-6 transition-transform hover:scale-110"
                  style={{ background: c.value, border: editor.isActive("textStyle", { color: c.value }) ? `2px solid ${INK}` : `1px solid #e4ddd8` }} />
              ))}
              <button type="button"
                onClick={() => { editor.chain().focus().unsetColor().run(); setShowColours(false); }}
                title="Reset colour"
                className="text-xs px-1" style={{ color: MID }}>✕</button>
            </div>
          )}
        </div>

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "#404040" }} />

        <ToolbarBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
          <span style={{ fontSize: 11, fontFamily: POPPINS, fontWeight: 700 }}>T<sub style={{ fontSize: 8 }}>✕</sub></span>
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <div onClick={() => editor.commands.focus()} className="cursor-text relative">
        {editor.isEmpty && (
          <p className="absolute top-0 left-0 px-3 py-2.5 text-sm pointer-events-none select-none"
            style={{ color: "rgba(255,255,255,0.72)", ...F }}>
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// Renders saved HTML from the editor safely
// Plain text (legacy) renders fine since it has no HTML tags
function RichContent({ html, className = "" }) {
  if (!html) return null;
  // If content has no HTML tags it's plain text — wrap in a paragraph for consistent spacing
  const isPlain = !/<[a-z][\s\S]*>/i.test(html);
  if (isPlain) {
    return <p className={`text-sm text-gray-700 whitespace-pre-wrap leading-relaxed ${className}`}>{html}</p>;
  }
  return (
    <div
      className={`prose prose-sm max-w-none text-gray-700 leading-relaxed ${className}`}
      style={{ fontSize: "0.875rem" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white shadow-2xl p-6 max-w-sm w-full mx-4" style={{ border: `3px solid ${INK}` }}>
            <p className="text-base font-medium mb-6 leading-snug" style={{ ...F, color: INK }}>{pending.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => settle(false)}
                className="px-4 py-2 text-sm font-semibold"
                style={{ ...FM, background: "#faf7f4", color: INK, border: `2px solid ${INK}` }}>
                Cancel
              </button>
              <button onClick={() => settle(true)}
                className="px-4 py-2 text-sm font-semibold"
                style={pending.danger
                  ? { ...FM, background: "#9F2E1D", color: "#fff", border: "2px solid #9F2E1D" }
                  : { ...FM, background: YELLOW, color: INK, border: `2px solid ${INK}` }}>
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
          const childIds = dedupedRows.map(r => (r.children_uat || {}).id || r.child_id).filter(Boolean);
          const targetRows = childIds.length ? await fetchTargetsForChildren(childIds) : [];

          const byChild = {};
          targetRows.forEach(t => {
            if (!byChild[t.child_id]) byChild[t.child_id] = { universal: [], targeted: [], specialist: [] };
            if (byChild[t.child_id][t.level]) byChild[t.child_id][t.level].push({
              id: t.id,
              text: t.target,
              status: t.status || "in_progress",
              date_added: t.date_added || null,
              date_updated: t.date_updated || null,
              cleared: t.cleared ?? false,
            });
          });

          setChildren(dedupedRows.map(row => {
            const childId = (row.children_uat || {}).id || row.child_id;
            return {
              ...mapRowToChild(row),
              currentTargets: byChild[childId] || { universal: [], targeted: [], specialist: [] },
            };
          }));
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
      const changed = updated.notes !== c.notes || updated.lead !== c.lead || updated.ragStatus !== c.ragStatus;
      if (updated.supabaseTermId && changed) {
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG, ...F }}>
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-5 py-3 mb-6 shadow-sm" style={{ background: MENTHE, borderRadius: 18 }}>
            <span className="font-semibold text-xl" style={{ ...FH, color: "#fff", letterSpacing: "-0.02em" }}>Ask Navera</span>
            <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.35)" }} />
            <span className="text-xs uppercase" style={{ ...FMONO, color: "rgba(255,255,255,0.72)", letterSpacing: "0.18em" }}>Speech & Language</span>
          </div>
          <p className="text-sm font-medium" style={{ color: MID, ...FMONO, letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading caseload…</p>
          <div className="mt-4 flex justify-center gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 animate-bounce"
                style={{ background: YELLOW, animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, ...F }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between"
        style={{ background: MENTHE, height: 52, boxShadow: "0 16px 56px rgba(42,35,32,0.08)" }}>

        <div className="flex items-center min-w-0 h-full">
          <div className="flex items-center gap-0 h-full flex-shrink-0">
            <div className="px-6 h-full flex items-center gap-3">
              <span className="font-medium italic text-xl" style={{ ...FH, color: "#fff", letterSpacing: "-0.02em", textShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>Ask Navera</span>
              <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.35)" }} />
              <span className="hidden md:inline text-xs uppercase" style={{ ...FMONO, color: "rgba(255,255,255,0.72)", letterSpacing: "0.18em", fontSize: "0.58rem" }}>Speech & Language</span>
            </div>
          </div>

          {/* Desktop breadcrumb — route stops */}
          <nav className="hidden sm:flex items-center h-full border-l" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
            {view !== "dashboard" && (
              <button onClick={() => { setView("dashboard"); setSelectedId(null); }}
                className="h-full px-5 text-xs font-semibold uppercase tracking-wider"
                style={{ ...FM, color: "rgba(255,255,255,0.65)", borderRight: "1px solid rgba(255,255,255,0.14)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
                Home
              </button>
            )}
            {view === "caseload" && (
              <div className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider"
                style={{ ...F, color: MENTHE_DEEP, background: "rgba(255,255,255,0.95)", borderRadius: 6, marginLeft: 8, height: 32 }}>
                Caseload
              </div>
            )}
            {view === "approvals" && (
              <div className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider"
                style={{ ...F, color: MENTHE_DEEP, background: "rgba(255,255,255,0.95)", borderRadius: 6, marginLeft: 8, height: 32 }}>
                Approvals
              </div>
            )}
            {view === "dashboard" && (
              <div className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider"
                style={{ ...F, color: MENTHE_DEEP, background: "rgba(255,255,255,0.95)", borderRadius: 6, marginLeft: 8, height: 32 }}>
                Dashboard
              </div>
            )}
            {view === "profile" && child && (
              <>
                <button onClick={() => setView("caseload")}
                  className="h-full px-5 text-xs font-semibold uppercase tracking-wider"
                  style={{ ...FM, color: "rgba(255,255,255,0.65)", borderRight: "1px solid rgba(255,255,255,0.14)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
                  Caseload
                </button>
                <div className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider"
                  style={{ ...F, color: MENTHE_DEEP, background: "rgba(255,255,255,0.95)", borderRadius: 6, marginLeft: 8, height: 32 }}>
                  <span className="max-w-[140px] truncate">{child.name}</span>
                </div>
              </>
            )}
          </nav>

          {/* Mobile title */}
          <span className="sm:hidden px-3 text-xs font-semibold uppercase tracking-widest truncate" style={{ ...FM, color: "rgba(255,255,255,0.86)" }}>
            {view === "profile" && child ? child.name.split(" ")[0]
              : view === "caseload" ? "Caseload"
              : view === "approvals" ? "Approvals" : "Dashboard"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center h-full">
          {view === "profile" && child ? (
            <>
              <button onClick={() => setSection("sessions")}
                className="hidden sm:flex h-full px-5 items-center text-xs font-semibold uppercase tracking-wider gap-1.5"
                style={{ ...FM, color: "rgba(255,255,255,0.65)", borderLeft: "1px solid rgba(255,255,255,0.14)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
                📅 Log Session
              </button>
              <button onClick={() => setSection("parent")}
                className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider gap-1.5"
                style={{ ...F, background: "rgba(255,255,255,0.95)", color: MENTHE_DEEP, border: "none", borderRadius: 6, alignSelf: "center", height: 32, marginRight: 8 }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.boxShadow = "inset 0 -2px 0 rgba(0,0,0,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.boxShadow = ""; }}>
                👪 <span className="hidden sm:inline ml-1">Parent Portal</span>
              </button>
            </>
          ) : view === "caseload" ? (
            <>
              <button onClick={() => setImportModal(true)}
                className="hidden sm:flex h-full px-5 items-center text-xs font-semibold uppercase tracking-wider gap-1.5"
                style={{ ...FM, color: "rgba(255,255,255,0.65)", borderLeft: "1px solid rgba(255,255,255,0.14)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
                ↑ Import
              </button>
              <button onClick={() => setAddModal(true)}
                className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider gap-1.5"
                style={{ ...F, background: "rgba(255,255,255,0.95)", color: MENTHE_DEEP, border: "none", borderRadius: 6, alignSelf: "center", height: 32, marginRight: 8 }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.boxShadow = "inset 0 -2px 0 rgba(0,0,0,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.boxShadow = ""; }}>
                + Add Child
              </button>
            </>
          ) : view === "approvals" ? null : (
            <button onClick={() => setImportModal(true)}
              className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider gap-1.5"
              style={{ ...F, background: "rgba(255,255,255,0.95)", color: MENTHE_DEEP, border: "none", borderRadius: 6, alignSelf: "center", height: 32, marginRight: 8 }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.boxShadow = "inset 0 -2px 0 rgba(0,0,0,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.boxShadow = ""; }}>
              ↑ Import
            </button>
          )}
          <button onClick={handleLogout}
            className="h-full px-5 flex items-center text-xs font-semibold uppercase tracking-wider"
            style={{ ...FM, color: "rgba(255,255,255,0.65)", borderLeft: "1px solid rgba(255,255,255,0.14)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
            Logout
          </button>
        </div>
      </header>

      {/* ── MOBILE PROFILE SECTION TABS ─────────────────────────────────── */}
      {view === "profile" && child && (
        <div className="sm:hidden sticky top-14 z-20 overflow-x-auto"
          style={{ background: SIDEBAR, borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
          <div className="flex min-w-max">
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
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap uppercase tracking-wider"
                style={section === item.id
                  ? { ...FM, background: NECTARINE, color: INK, letterSpacing: "0.07em" }
                  : { ...FM, color: "rgba(255,255,255,0.5)", letterSpacing: "0.07em" }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LAYOUT ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden sm:flex flex-col w-56 flex-shrink-0 overflow-y-auto"
          style={{ background: SIDEBAR }}>
          {view === "profile" && child
            ? <ProfileSidebar section={section} setSection={setSection} child={child} onBack={() => setView("caseload")} />
            : <MainSidebar view={view} setView={v => { setView(v); setSelectedId(null); }} stats={stats} pendingCount={pendingQueue.length} />}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-7 pb-24 sm:pb-7 space-y-4" style={{ background: SAND_SURFACE }}>
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
            <div className="text-center py-20" style={{ color: MID }}>
              <p className="text-4xl mb-3">👤</p>
              <p className="font-semibold" style={FM}>Child record not found.</p>
              <button onClick={() => setView("caseload")}
                className="mt-4 text-sm font-semibold underline" style={{ color: INK, ...FM }}>
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
      <nav className="sm:hidden fixed bottom-0 inset-x-0 flex z-30"
        style={{ background: SIDEBAR, borderTop: `1px solid rgba(255,255,255,0.07)` }}>
        {[
          { id: "dashboard", icon: "⊞", label: "Home"      },
          { id: "caseload",  icon: "👥", label: "Caseload",  count: stats.total  },
          { id: "approvals", icon: "✅", label: "Approvals", count: stats.pending, alert: stats.pending > 0 },
        ].map(item => {
          const active = view === item.id;
          return (
            <button key={item.id} onClick={() => { setView(item.id); setSelectedId(null); }}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative"
              style={active
                ? { background: NECTARINE, color: INK, transition: "background 0.12s ease" }
                : { color: "rgba(255,255,255,0.45)", transition: "background 0.12s ease" }}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ ...FM, letterSpacing: "0.07em", fontSize: 9 }}>{item.label}</span>
              {item.count > 0 && (
                <span className="absolute top-2 right-[18%] font-bold flex items-center justify-center"
                  style={{ background: item.alert ? "#fff" : "rgba(255,255,255,0.2)", color: item.alert ? NECTARINE : "rgba(255,255,255,0.7)", width: 14, height: 14, fontSize: 8, ...FM, borderRadius: 2 }}>
                  {item.count > 9 ? "9+" : item.count}
                </span>
              )}
            </button>
          );
        })}
        {view === "profile" && child && (
          <button onClick={() => setView("caseload")}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
            style={{ background: LAGUNE, color: PECHE }}>
            <span className="text-lg">←</span>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ ...FM, fontSize: 9, letterSpacing: "0.07em" }}>Back</span>
          </button>
        )}
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-5 right-4 sm:right-6 px-5 py-3 shadow-xl text-sm font-semibold z-50"
          style={{
            ...FM,
            background: toast.type === "success" ? YELLOW : "#9F2E1D",
            color: toast.type === "success" ? INK : "#fff",
            border: `2px solid ${INK}`,
          }}>
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

// ── Main Sidebar — Template 02 Tide/Menthe ───────────────────────────────────
function MainSidebar({ view, setView, stats, pendingCount }) {
  const [hovId, setHovId] = useState(null);
  return (
    <div className="flex flex-col h-full">
      {/* Route label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-xs uppercase" style={{ ...FMONO, color: "rgba(255,255,255,0.28)", letterSpacing: "0.24em", fontSize: "0.56rem" }}>Navigation</p>
      </div>
      <div className="flex-1">
        {[
          { id: "dashboard", label: "Dashboard",    code: "01" },
          { id: "caseload",  label: "My Caseload",  code: "02", count: stats.total  },
          { id: "approvals", label: "Approvals",    code: "03", count: pendingCount, alert: pendingCount > 0 },
        ].map(item => {
          const active = view === item.id;
          const hov = hovId === item.id && !active;
          return (
            <button key={item.id} onClick={() => setView(item.id)}
              onMouseEnter={() => setHovId(item.id)}
              onMouseLeave={() => setHovId(null)}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-left"
              style={{
                background: active ? "rgba(255,255,255,0.08)" : hov ? "rgba(255,255,255,0.05)" : "transparent",
                color: active ? "#fff" : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.42)",
                borderLeft: active ? `3px solid ${PECHE}` : "3px solid transparent",
                transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
              }}>
              <span className="flex-shrink-0" style={{ ...FMONO, color: active ? "rgba(249,185,92,0.65)" : "rgba(255,255,255,0.18)", width: 18, fontSize: "0.54rem" }}>{item.code}</span>
              <span className="text-sm flex-1" style={{ ...F, fontWeight: active ? 600 : 400 }}>{item.label}</span>
              {item.count > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 flex-shrink-0"
                  style={{
                    ...FM,
                    background: item.alert ? NECTARINE : "rgba(255,255,255,0.08)",
                    color: item.alert ? "#fff" : "rgba(255,255,255,0.62)",
                    borderRadius: 999,
                  }}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Stats breakdown */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 0" }}>
        <div className="px-5 pb-2">
          <p className="text-xs uppercase" style={{ ...FMONO, color: "rgba(255,255,255,0.28)", letterSpacing: "0.24em", fontSize: "0.56rem" }}>Breakdown</p>
        </div>
        {[
          { l: "Universal",  v: stats.universal,  dot: MENTHE },
          { l: "Targeted",   v: stats.targeted,   dot: MENTHE_DEEP },
          { l: "Specialist", v: stats.specialist, dot: NECTARINE },
          { l: "EHCP",       v: stats.ehcp,       dot: PECHE },
        ].map(s => (
          <div key={s.l} className="flex items-center justify-between px-5 py-1">
            <span className="flex items-center gap-2 text-xs" style={{ ...F, color: "rgba(255,255,255,0.32)" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
              {s.l}
            </span>
            <span style={{ ...FMONO, fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.62)" }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Sidebar — Template 02 Tide/Menthe ────────────────────────────────
function ProfileSidebar({ section, setSection, child, onBack }) {
  const [hovId, setHovId] = useState(null);
  const [backHov, setBackHov] = useState(false);
  const items = [
    { id: "core",       code: "01", label: "Core Data"         },
    { id: "slprofile",  code: "02", label: "S&L Profile"       },
    { id: "universal",  code: "03", label: "Intervention Level", show: child.tiers.includes("universal")  },
    { id: "targeted",   code: "04", label: "Intervention Level", show: child.tiers.includes("targeted")   },
    { id: "specialist", code: "05", label: "Intervention Level", show: child.tiers.includes("specialist") },
    { id: "parent",     code: "06", label: "Parent Portal"      },
    { id: "sessions",   code: "07", label: "Sessions Log"       },
    { id: "files",      code: "08", label: "Files & Videos"     },
  ].filter(i => i.show !== false);

  return (
    <div className="flex flex-col h-full">
      <button onClick={onBack}
        onMouseEnter={() => setBackHov(true)}
        onMouseLeave={() => setBackHov(false)}
        className="flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
        style={{
          ...FM, color: backHov ? "#fff" : "rgba(255,255,255,0.42)",
          background: backHov ? "rgba(255,255,255,0.08)" : "transparent",
          transition: "background 0.12s ease, color 0.12s ease",
        }}>
        ← Caseload
      </button>
      <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs uppercase mb-1" style={{ ...FMONO, color: "rgba(255,255,255,0.28)", letterSpacing: "0.24em", fontSize: "0.56rem" }}>Child Record</p>
        <p className="text-sm font-semibold truncate" style={{ ...FH, color: "#fff" }}>{child.name}</p>
      </div>
      <div className="flex-1">
        {items.map((item) => {
          const active = section === item.id;
          const hov = hovId === item.id && !active;
          return (
            <button key={item.id} onClick={() => setSection(item.id)}
              onMouseEnter={() => setHovId(item.id)}
              onMouseLeave={() => setHovId(null)}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-left"
              style={{
                background: active ? "rgba(255,255,255,0.08)" : hov ? "rgba(255,255,255,0.05)" : "transparent",
                color: active ? "#fff" : hov ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.42)",
                borderLeft: active ? `3px solid ${PECHE}` : "3px solid transparent",
                transition: "background 0.12s ease, color 0.12s ease, border-color 0.12s ease",
              }}>
              <span className="flex-shrink-0" style={{ ...FMONO, color: active ? "rgba(249,185,92,0.65)" : "rgba(255,255,255,0.18)", width: 18, fontSize: "0.54rem" }}>{item.code}</span>
              <span className="text-sm" style={{ ...F, fontWeight: active ? 600 : 400 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Child Profile ─────────────────────────────────────────────────────────────
function ChildProfile({ child, section, setSection, updateChild, showToast }) {
  const inProgress = (arr) => arr.filter(t => t.status !== "completed");
  const totalTargets = inProgress([...child.currentTargets.universal, ...child.currentTargets.targeted, ...child.currentTargets.specialist]).length;
  const totalHours = child.sessionsLogged.filter(s => s.ehcp_session).reduce((s, sess) => s + sess.duration, 0) / 60;
  const ehcpPct = child.ehcp && child.ehcpHours > 0
    ? Math.min(100, Math.round((totalHours / child.ehcpHours) * 100)) : null;

  useEffect(() => {
    if (!child.id) return;
    fetchSessions(child.id)
      .then(rows => {
        const sessions = (rows || []).map(r => ({
          id: r.id, date: r.date, duration: r.duration,
          type: r.type, notes: r.notes || "", ehcp_session: r.ehcp_session ?? false,
        }));
        updateChild(child.id, () => ({ sessionsLogged: sessions }));
      })
      .catch(err => console.error("Failed to load sessions:", err));
  }, [child.id]);

  return (
    <div className="space-y-4 mt-10 sm:mt-0">
      {/* Profile card — Template 02 */}
      <div className="overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderRadius: 14, background: SURFACE }}>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${MENTHE_DEEP} 0%, ${MENTHE} 55%, ${PECHE} 100%)` }} />
        <div className="px-5 py-4 flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "rgba(150,199,179,0.18)", border: "2px solid rgba(150,199,179,0.35)", borderRadius: "50%" }}>
              👤
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-normal truncate" style={{ ...FH, color: INK, lineHeight: 1.1 }}>{child.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {child.yearGroup && (
                  <span className="text-xs px-2 py-0.5 font-semibold" style={{ ...F, background: "rgba(150,199,179,0.1)", color: MENTHE_DEEP, border: "1px solid rgba(150,199,179,0.3)", borderRadius: 999 }}>
                    {child.yearGroup}{child.class ? ` · ${child.class}` : ""}
                  </span>
                )}
                {child.ehcp && <Chip className="bg-violet-200 text-violet-900">EHCP</Chip>}
                {child.tiers.map(t => <TierPill key={t} tier={t} />)}
                <RagPill status={child.ragStatus} />
                {child.lead && (
                  <span className="text-xs px-2 py-0.5 font-semibold" style={{ ...F, background: "rgba(150,199,179,0.1)", color: MENTHE_DEEP, border: "1px solid rgba(150,199,179,0.3)", borderRadius: 999 }}>
                    Lead: {child.lead}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats — Template 02 */}
      <div className="flex overflow-x-auto" style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          {[
            { label: "Targets",   value: totalTargets,                                       isYellow: true  },
            { label: "Sessions",  value: child.sessionsLogged.length,                        isBlack: false  },
            { label: "Hours",     value: totalHours.toFixed(1) + "h",                        isBlack: false  },
            { label: "Universal", value: inProgress(child.currentTargets.universal).length,  isBlack: false  },
            { label: "Targeted",  value: inProgress(child.currentTargets.targeted).length,   isBlack: false  },
            { label: "EHCP %",    value: ehcpPct !== null ? `${ehcpPct}%` : "—",             isBlack: true   },
          ].map((t, i) => (
            <div key={i} className="flex-shrink-0 p-3 border-r last:border-r-0"
              style={{
                borderColor: BORDER,
                minWidth: 80,
                flex: 1,
                textAlign: "center",
                background: t.isYellow ? "rgba(249,185,92,0.09)" : t.isBlack ? SIDEBAR : SURFACE,
              }}>
              <p className="leading-none"
                style={{ ...FMONO, fontSize: "1.2rem", fontWeight: 600, color: t.isYellow ? "#b45309" : t.isBlack ? PECHE : INK }}>{t.value}</p>
              <p className="mt-1 leading-tight"
                style={{ ...FMONO, color: t.isBlack ? "rgba(255,255,255,0.28)" : "#b0a89e", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>{t.label}</p>
            </div>
          ))}
      </div>

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
      <Card accent="Core Data">
        <SectionLabel color="text-amber-600">Core Data</SectionLabel>
        <div className="flex gap-4">
          <div className="w-14 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: PECHE }}>👤</div>
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
      <Card accent="Additional Data">
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
            style={{ background: PECHE, border: `1px solid ${NECTARINE}` }}>📌 {child.notes}</div>
        )}
      </Card>
    </div>
  );
}

// ── S&L Profile ───────────────────────────────────────────────────────────────
function SLProfileSection({ child }) {
  const [showAll, setShowAll] = useState(false);
  const TIERS = ["universal", "targeted", "specialist"];

  // "Current" = not hidden/cleared and not achieved
  const filterTargets = (items) =>
    showAll ? items : items.filter(t => !t.cleared && t.status !== "completed");

  const hasAny = TIERS.some(t => (child.currentTargets[t] || []).length > 0);
  const hasVisible = TIERS.some(t => filterTargets(child.currentTargets[t] || []).length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card accent="S&L Profile">
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
        <Card accent="S&L Profile">
          <SectionLabel color="text-sky-700">Progress Overview</SectionLabel>
          {child.tiers.map(t => (
            <div key={t} className="mb-4 last:mb-0">
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="capitalize text-gray-600">{t}</span>
                <span className="text-gray-400">{child.progress[t] || 0}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#e4ddd8" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${child.progress[t] || 0}%`, background: TC[t]?.dot || MENTHE }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card accent="Current Targets">
        {/* Header row: title + toggle */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel color="text-rose-600" >{showAll ? "All Targets" : "Current Targets"}</SectionLabel>
          <div className="flex items-center gap-1 rounded-xl p-1 flex-shrink-0" style={{ background: "#e4ddd8" }}>
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
            <p className="text-gray-400 text-sm italic">No current targets — all are achieved or hidden</p>
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
                          style={{ background: isCleared ? "#F9F9F9" : isCompleted ? MENTHE : "#faf7f4", border: isCleared ? "1px dashed #D1D5DB" : "none" }}>
                          <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                            style={{ background: isCleared || isCompleted ? "#c4bbb2" : TC[tier].dot }} />
                          <div className={`flex-1 min-w-0 ${isCleared ? "opacity-50" : ""}`}>
                            <RichContent html={t.text} className={isCompleted ? "line-through" : ""} />
                          </div>
                          {isCompleted && <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(150,199,179,0.2)", color: "#276e5a" }}>✓ Achieved</span>}
                          {isCleared  && <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: SOFT, color: "#b0a89e" }}>Cleared</span>}
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

function TargetList({ targets, barColor, dotColor, itemBg, placeholder, onAdd, onEdit, onRemove, onStatusToggle }) {
  const [val, setVal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => new Set(targets.filter(t => t.cleared).map(t => t.id)));

  const add = () => { if (!val || val === "<p></p>" || val.trim() === "") return; onAdd(val); setVal(""); };
  const startEdit = (t) => { setEditingId(t.id); setEditVal(t.text); };
  const cancelEdit = () => { setEditingId(null); setEditVal(""); };
  const hideTarget = (id) => setHiddenIds(prev => new Set([...prev, id]));
  const hideAll    = () => setHiddenIds(new Set(targets.filter(t => t.status === "completed").map(t => t.id)));
  const showAll    = () => setHiddenIds(new Set());

  const saveEdit = async () => {
    if (!editVal || editVal === "<p></p>" || editVal.trim() === "") return;
    setSaving(true);
    try {
      await onEdit(editingId, editVal);
      cancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const visibleTargets = targets.filter(t => !hiddenIds.has(t.id));

  return (
    <div>
      {targets.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={hideAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            Hide achieved
          </button>
          <button onClick={showAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            Show all targets
          </button>
        </div>
      )}
      {visibleTargets.length > 0
        ? <ul className="mb-4" style={{ borderTop: `1px solid ${SOFT}` }}>
            {visibleTargets.map(t => {
              const isCompleted = t.status === "completed";
              return (
                <li key={t.id}>
                  {editingId === t.id ? (
                    <div className="flex flex-col gap-2 px-3 py-2" style={{ background: itemBg, border: `1px solid ${MENTHE}`, borderRadius: 12 }}>
                      <RichTextEditor
                        content={editVal}
                        onChange={setEditVal}
                        placeholder="Edit target…"
                        minHeight={60}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={saving}
                          className="text-xs font-semibold px-3 py-1.5 text-white disabled:opacity-40 transition-all"
                          style={{ background: saving ? "#ccc" : MENTHE, borderRadius: 8 }}>{saving ? "Saving…" : "Save"}</button>
                        <button onClick={cancelEdit}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-500 bg-gray-100">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm overflow-hidden" style={{ background: SURFACE, borderBottom: `1px solid ${SOFT}` }}>
                      <div className="flex items-start gap-3 px-0 py-3">
                        <span className="flex-shrink-0 pt-0.5" style={{ ...FM, color: "#c4bbb2", width: 36, fontSize: "0.56rem" }}>T—{String(targets.indexOf(t) + 1).padStart(2, "0")}</span>
                        <div className={`flex-1 ${isCompleted ? "opacity-60" : ""}`}>
                          <RichContent html={t.text} className={isCompleted ? "line-through" : ""} />
                        </div>
                        {isCompleted
                          ? <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(150,199,179,0.2)", color: "#276e5a" }}>✓ Achieved</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(150,199,179,0.15)", color: MENTHE_DEEP }}>In Progress</span>}
                      </div>
                      <div className="flex items-center gap-4 pl-12 pb-2 pt-0.5">
                        {t.date_added && (
                          <span style={{ ...FMONO, fontSize: "0.53rem", color: "#c4bbb2" }}>Added {fmtDate(t.date_added)}</span>
                        )}
                        {t.date_updated && (
                          <span style={{ ...FMONO, fontSize: "0.53rem", color: "#c4bbb2" }}>· Updated {fmtDate(t.date_updated)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 pl-12 pb-3">
                        <button onClick={() => onStatusToggle(t.id, t.status)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 flex-shrink-0 ${isCompleted ? "bg-blue-50 text-blue-900 hover:bg-amber-100 hover:text-amber-700" : "bg-green-50 text-green-900 hover:bg-green-100"}`}
                          title={isCompleted ? "Mark as in progress" : "Mark as achieved"}>
                          {isCompleted ? "↩ In Progress" : "✓ Achieve"}
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
      <div className="mt-2">
        <RichTextEditor
          content={val}
          onChange={setVal}
          placeholder="Add a new target…"
          minHeight={72}
        />
        <button onClick={add}
          className="mt-2 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          style={{ ...F, background: MENTHE, borderRadius: 8 }}>
          Add Target
        </button>
      </div>
    </div>
  );
}

// ── Shared target card (reusable per tier) ────────────────────────────────────
const TARGET_CFG = {
  universal:  { accent: MENTHE,      bar: MENTHE,      dot: MENTHE,      bg: "rgba(150,199,179,0.06)", label: "Universal Targets",  labelColor: "text-emerald-700" },
  targeted:   { accent: MENTHE_DEEP, bar: MENTHE_DEEP, dot: MENTHE_DEEP, bg: "rgba(150,199,179,0.08)", label: "Targeted Targets",   labelColor: "text-sky-700"     },
  specialist: { accent: NECTARINE,   bar: NECTARINE,   dot: NECTARINE,   bg: "rgba(215,137,127,0.06)", label: "Specialist Targets", labelColor: "text-violet-700"  },
};
function TargetCard({ level, child, updateChild, showToast }) {
  const cfg = TARGET_CFG[level];
  const confirm = useConfirm();

  const handleAdd = async (text) => {
    const ok = await confirm(`Add this ${level} target for ${child.name}?`, { label: "Add target" });
    if (!ok) return;
    try {
      const rows = await insertTarget(child.id, level, text);
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
    <Card accent={cfg.label}>
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
    <Card accent="History">
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
              className="flex-1 py-2 px-3 text-sm font-semibold capitalize transition-colors disabled:opacity-50"
              style={{
                ...F,
                borderRadius: 8,
                background: level === current ? (TC[level]?.dot || MENTHE) : SAND_SURFACE,
                color: level === current ? "#fff" : INK_SOFT,
                border: level === current ? "none" : `1px solid ${BORDER}`,
              }}>
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
    <Card accent="EHCP Tracker">
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
      <div className="h-3 rounded-full overflow-hidden" style={{ background: "#e4ddd8" }}>
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
  const [loggingSession, setLoggingSession] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const confirm = useConfirm();

  const logSession = async () => {
    if (!newSession.date) { showToast("Please select a date", "error"); return; }
    // Bug 3 — validate duration before confirm
    const dur = +newSession.duration;
    if (!dur || dur <= 0 || !Number.isFinite(dur)) {
      showToast("Duration must be a positive number of minutes", "error"); return;
    }
    const ok = await confirm(`Log this session for ${child.name}?`, { label: "Log session" });
    if (!ok) return;
    setLoggingSession(true);
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
    finally { setLoggingSession(false); }
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
      <Card accent="Log Session">
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
        <RichTextEditor
          content={newSession.notes}
          onChange={v => setNewSession(s => ({ ...s, notes: v }))}
          placeholder="Session notes…"
          minHeight={80}
        />
        <div className="mb-3" />
        {child.ehcp && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-3">
            <input type="checkbox" checked={newSession.ehcp_session}
              onChange={e => setNewSession(s => ({ ...s, ehcp_session: e.target.checked }))}
              className="rounded accent-violet-600" />
            Counts towards EHCP allocation
          </label>
        )}
        <PBtn onClick={logSession} disabled={loggingSession}>{loggingSession ? "Saving…" : "Log Session"}</PBtn>
      </Card>

      <Card accent="History">
        <SectionLabel>Session History ({child.sessionsLogged.length})</SectionLabel>
        {child.sessionsLogged.length > 0 ? (
          <div className="space-y-2">
            {[...child.sessionsLogged].reverse().map(s => (
              <div key={s.id}>
                {editingId === s.id ? (
                  <div className="p-3 rounded-xl border-2 space-y-2" style={{ borderColor: CORAL, background: "#faf7f4" }}>
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
                    <RichTextEditor
                      content={editForm.notes}
                      onChange={v => setEditForm(f => ({ ...f, notes: v }))}
                      placeholder="Session notes…"
                      minHeight={72}
                    />
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
                  <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "#f2ede8" }}>
                    <div className="rounded-lg px-2.5 py-1 text-xs font-bold text-white flex-shrink-0"
                      style={{ background: CORAL }}>{s.date}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-600">{s.duration}min</span>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s.type}</span>
                        {s.ehcp_session && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">EHCP</span>}
                      </div>
                      {s.notes && <div className="mt-1"><RichContent html={s.notes} /></div>}
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
    <Card accent="Core Data">
      <SectionLabel color="text-amber-700">Approved Resources</SectionLabel>
      {(child.approvedResources || []).length > 0
        ? child.approvedResources.map((r, i) => (
            <div key={i} className="rounded-xl p-4 mb-3" style={{ background: PECHE, border: `1px solid ${NECTARINE}` }}>
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
    <Card accent="Files">
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
            <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#f2ede8" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "#FFE1DC" }}>🎬</div>
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
    <div className="space-y-4">
      {/* Hero — Template 02 profile-style card */}
      <div className="overflow-hidden" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${MENTHE_DEEP} 0%, ${MENTHE} 55%, ${PECHE} 100%)` }} />
        <div className="flex items-start gap-4 p-5">
          <div className="w-12 h-12 flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "rgba(150,199,179,0.18)", border: "2px solid rgba(150,199,179,0.35)", borderRadius: "50%" }}>
            {season.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase mb-1" style={{ ...FM, color: "#b0a89e", letterSpacing: "0.18em", fontSize: "0.58rem" }}>
              {season.name} Term · {season.emoji}
            </p>
            <h2 className="text-2xl font-normal mb-1" style={{ ...FH, color: INK }}>{getGreeting()}</h2>
            <p className="text-sm" style={{ color: INK_SOFT, ...F }}>
              {stats.total} {stats.total === 1 ? "child" : "children"} on your caseload
            </p>
            {stats.total === 0 && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <button onClick={onImport}
                  className="px-4 py-2 text-sm font-semibold"
                  style={{ ...F, background: MENTHE, color: "#fff", border: "none", borderRadius: 8 }}>
                  ↑ Import caseload
                </button>
                <button onClick={onAdd}
                  className="px-4 py-2 text-sm font-semibold"
                  style={{ ...F, background: SAND_SURFACE, color: MENTHE_DEEP, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                  + Add child
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderRadius: 10 }}>
        {[
          { l: "Total",      v: stats.total,      bg: "rgba(249,185,92,0.09)", textColor: "#b45309" },
          { l: "Universal",  v: stats.universal,  bg: SURFACE, textColor: INK },
          { l: "Targeted",   v: stats.targeted,   bg: SURFACE, textColor: INK },
          { l: "Specialist", v: stats.specialist, bg: SURFACE, textColor: INK },
          { l: "EHCP",       v: stats.ehcp,       bg: SIDEBAR, textColor: PECHE },
        ].map((s, i) => (
          <div key={s.l} className="p-4 border-r border-b sm:border-b-0 last:border-r-0"
            style={{ background: s.bg, borderColor: BORDER }}>
            <p className="text-2xl font-bold" style={{ ...FM, color: s.textColor }}>{s.v}</p>
            <p className="text-xs font-semibold mt-0.5 uppercase tracking-wider" style={{ ...FM, color: s.bg === SIDEBAR ? "rgba(255,255,255,0.28)" : "#b0a89e", fontSize: "0.5rem", letterSpacing: "0.12em" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Recent children */}
      <div>
        <div className="flex items-center gap-4 mb-3 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold uppercase tracking-widest flex-1" style={{ ...FM, color: "#b0a89e" }}>Recent Children</p>
          <span className="text-xs font-semibold" style={{ ...FM, color: MID }}>{children.length} total</span>
        </div>
        {children.length === 0 ? (
          <div className="p-8 text-center" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE }}>
            <p className="text-sm font-semibold mb-1" style={{ ...FM, color: INK }}>No children on your caseload yet</p>
            <p className="text-xs" style={{ color: MID, ...FM }}>Use the buttons above to import or add your first child</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0"
            style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            {children.slice(0, 6).map((c, idx) => (
              <button key={c.id} onClick={() => onOpen(c.id)}
                className="p-4 text-left transition-all group border-r border-b"
                style={{ borderColor: BORDER, background: SURFACE }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(150,199,179,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = SURFACE; }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate text-sm" style={{ ...FM, color: INK }}>{c.name}</p>
                    <p className="text-xs mt-0.5" style={{ ...FM, color: MID }}>{c.yearGroup}{c.class ? ` · ${c.class}` : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                    {c.ehcp && <Chip className="bg-violet-100 text-violet-900">EHCP</Chip>}
                    <RagPill status={c.ragStatus} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div>
                <div className="space-y-1">
                  {c.tiers.map(t => (
                    <div key={t}>
                      <div className="flex justify-between text-xs mb-0.5" style={{ ...FM, color: MID }}>
                        <span className="uppercase tracking-wider">{t}</span>
                        <span>{c.progress[t] || 0}%</span>
                      </div>
                      <div className="h-1" style={{ background: BORDER }}>
                        <div className="h-full"
                          style={{ width: `${c.progress[t] || 0}%`, background: TC[t]?.dot || MENTHE }} />
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

      {/* Desktop table — Template 02 surface */}
      <div className="hidden sm:block overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE }}>
        <table className="w-full text-sm">
          <thead style={{ background: SIDEBAR }}>
            <tr>
              {["Name","Year","Class","Tiers","Lead","Term","RAG","EHCP",""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-widest"
                  style={{ ...FM, color: "rgba(255,255,255,0.62)", fontSize: "0.56rem", letterSpacing: "0.2em" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, idx) => (
              <tr key={c.id} className="cursor-pointer transition-colors"
                style={{ borderTop: `1px solid ${BORDER}` }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(150,199,179,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                <td className="px-4 py-3 font-semibold" style={{ ...F, color: INK }} onClick={() => onOpen(c.id)}>{c.name}</td>
                <td className="px-4 py-3 text-sm" style={{ ...FM, color: MID }} onClick={() => onOpen(c.id)}>{c.yearGroup}</td>
                <td className="px-4 py-3 text-xs" style={{ ...FM, color: MID }} onClick={() => onOpen(c.id)}>{c.class || "—"}</td>
                <td className="px-4 py-3" onClick={() => onOpen(c.id)}><div className="flex flex-wrap gap-1">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div></td>
                <td className="px-4 py-3 text-xs" style={{ ...FM, color: MID }} onClick={() => onOpen(c.id)}>{c.lead || "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ ...FM, color: MID }} onClick={() => onOpen(c.id)}>{c.term || "—"}</td>
                <td className="px-4 py-3" onClick={() => onOpen(c.id)}><RagPill status={c.ragStatus} /></td>
                <td className="px-4 py-3" onClick={() => onOpen(c.id)}>{c.ehcp && <Chip className="bg-violet-100 text-violet-900">EHCP</Chip>}</td>
                <td className="px-4 py-3">
                  <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                    className="text-sm px-2 py-1 transition-colors"
                    style={{ color: "#c4bbb2" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#9F2E1D"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#c4bbb2"; }}
                    title="Remove">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center py-10 text-sm" style={{ ...FM, color: MID }}>
            {children.length === 0 ? "No children on caseload yet." : "No children match your search."}
          </p>
        )}
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 && (
          <p className="text-center py-10 text-sm" style={{ ...FM, color: MID }}>
            {children.length === 0 ? "No children on caseload yet." : "No children match your search."}
          </p>
        )}
        {filtered.map(c => (
          <div key={c.id} className="overflow-hidden" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: SURFACE }}>
            <div className="h-1" style={{ background: TC[c.tiers[0]]?.dot || MENTHE }} />
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold" style={{ ...FM, color: INK }}>{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ ...FM, color: MID }}>{c.yearGroup}{c.class ? ` · ${c.class}` : ""}{c.lead ? ` · ${c.lead}` : ""}</p>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {c.ehcp && <Chip className="bg-violet-100 text-violet-900">EHCP</Chip>}
                  <RagPill status={c.ragStatus} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div>
              <div className="flex gap-2">
                <button onClick={() => onOpen(c.id)} className="flex-1 py-2 text-xs font-semibold"
                  style={{ ...F, background: MENTHE, color: "#fff", border: "none", borderRadius: 8 }}>
                  View Profile →
                </button>
                <button onClick={() => onDelete(c.id)} className="px-3 py-2 text-sm font-bold"
                  style={{ background: "#FFE1DC", color: "#9F2E1D", border: "2px solid #9F2E1D" }}>🗑</button>
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
      <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 12 }}>
        <h2 className="text-xl font-bold mb-0.5" style={{ ...FM, color: INK }}>Approvals Queue</h2>
        <p className="text-sm" style={{ color: MID, ...FM }}>Review AI-generated parent resources before they go live.</p>
      </div>
      {queue.length === 0 ? (
        <div className="py-12 text-center" style={{ border: `2px solid ${BORDER}` }}>
          <p className="text-xl mb-2">✅</p>
          <p className="font-semibold text-sm" style={{ ...FM, color: INK }}>Nothing awaiting approval</p>
        </div>
      ) : queue.map(res => (
        <Card key={res.id} accent="Pending Approval">
          <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
            <div>
              <p className="font-bold" style={{ ...FM, color: INK }}>{res.childName}</p>
              <p className="text-xs mt-0.5" style={{ ...FM, color: MID }}>{res.season} · {res.yearGroup} · {res.generatedDate}</p>
            </div>
            <div className="flex gap-2">
              <PBtn onClick={() => approve(res)}>✓ Approve</PBtn>
              <DBtn onClick={() => reject(res.id)}>✕ Discard</DBtn>
            </div>
          </div>
          <div className="p-4 text-sm whitespace-pre-wrap leading-relaxed"
            style={{ background: PECHE, border: `1px solid ${NECTARINE}`, color: INK, ...F }}>{res.content}</div>
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
    universal:  { activeBg: MENTHE, activeText: INK, activeBorder: LAGUNE },
    targeted:   { activeBg: "rgba(255,255,255,0.72)", activeText: "#1E3A8A", activeBorder: "#78B9C7" },
    specialist: { activeBg: "#E6DDF7", activeText: "#4C1D95", activeBorder: "#DDD6FE" },
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" style={F}>
      <div className="bg-white w-full sm:max-w-md shadow-2xl max-h-[92vh] overflow-y-auto sm:mx-4"
        style={{ border: `3px solid ${INK}` }}>
        {/* Black header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ background: INK }}>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: YELLOW, color: INK, ...FM }}>+</div>
            <h3 className="font-bold text-sm uppercase tracking-widest" style={{ ...FM, color: YELLOW }}>Add New Child</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-lg font-bold transition-colors"
            style={{ color: "#647981" }}
            onMouseEnter={e => { e.currentTarget.style.color = YELLOW; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#647981"; }}>×</button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 px-4 py-3 text-sm font-semibold" style={{ background: "#FFE1DC", border: "2px solid #9F2E1D", color: "#9F2E1D", ...FM }}>
              {error}
            </div>
          )}
          <div className="space-y-4">
            <SInput placeholder="Full name *" value={form.name} onChange={e => f("name", e.target.value)} maxLength={100} />
            <div className="grid grid-cols-2 gap-3">
              <SSelect value={form.yearGroup} onChange={e => f("yearGroup", e.target.value)}>
                {["Reception","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6"].map(y => <option key={y}>{y}</option>)}
              </SSelect>
              <SInput type="date" value={form.dob} onChange={e => f("dob", e.target.value)} placeholder="" />
              <SInput placeholder="Class" value={form.class} onChange={e => f("class", e.target.value)} />
              <SInput placeholder="SLT Lead" value={form.lead} onChange={e => f("lead", e.target.value)} maxLength={100} />
              <SInput placeholder="Term (e.g. Spring 2)" value={form.term} onChange={e => f("term", e.target.value)} />
              <SSelect value={form.ragStatus} onChange={e => f("ragStatus", e.target.value)}>
                <option value="">RAG Status</option><option>Green</option><option>Amber</option><option>Red</option>
              </SSelect>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ ...FM, color: MID }}>Support Tiers *</p>
              <div className="flex gap-2">
                {["universal","targeted","specialist"].map(t => {
                  const active = form.tiers.includes(t);
                  return (
                    <button key={t} onClick={() => toggleArr("tiers", t)}
                      className="flex-1 py-2.5 text-xs font-semibold transition-all uppercase tracking-wider"
                      style={active
                        ? { ...FM, background: YELLOW, color: INK, border: `2px solid ${INK}` }
                        : { ...FM, background: "#faf7f4", color: MID, border: `2px solid ${BORDER}` }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ ...FM, color: MID }}>Difficulties</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(SLT_HIERARCHIES).map(d => {
                  const active = form.difficulties.includes(d);
                  return (
                    <button key={d} onClick={() => toggleArr("difficulties", d)}
                      className="text-xs px-3 py-1.5 font-medium transition-all"
                      style={active
                        ? { ...FM, background: YELLOW, color: INK, border: `2px solid ${INK}` }
                        : { ...FM, background: "#faf7f4", color: MID, border: `2px solid ${BORDER}` }}>
                      {SLT_HIERARCHIES[d].label.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer font-medium" style={{ ...FM, color: INK }}>
                <input type="checkbox" checked={form.ehcp} onChange={e => f("ehcp", e.target.checked)} className="rounded" />
                Has EHCP
              </label>
              {form.ehcp && (
                <SInput type="number" value={form.ehcpHours} onChange={e => f("ehcpHours", +e.target.value)}
                  placeholder="Annual hours" className="flex-1" min="1" />
              )}
            </div>

            <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => f("notes", e.target.value)}
              maxLength={2000}
              className="w-full px-3 py-2.5 text-sm h-16 resize-none outline-none"
              style={{ ...F, border: `2px solid ${BORDER}`, background: "#faf7f4", color: INK }} />
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
        await insertCaseloadTerm(childRow.id, child);
        for (const level of ["universal", "targeted", "specialist"]) {
          for (const item of (child.currentTargets[level] || [])) {
            const text = typeof item === "string" ? item : item.text;
            if (text) await insertTarget(childRow.id, level, text);
          }
        }
        ok++;
      } catch (err) { console.error(`Failed for ${child.name}:`, err); failed++; }
    }
    try {
      const rows = await fetchCaseload();
      if (rows && rows.length > 0) {
        const dedupedRows = dedupeByLatestTerm(rows);
        const childIds = dedupedRows.map(r => (r.children_uat || {}).id || r.child_id).filter(Boolean);
        const targetRows = childIds.length ? await fetchTargetsForChildren(childIds) : [];
        const byChild = {};
        targetRows.forEach(t => {
          if (!byChild[t.child_id]) byChild[t.child_id] = { universal: [], targeted: [], specialist: [] };
          if (byChild[t.child_id][t.level]) byChild[t.child_id][t.level].push({
            id: t.id,
            text: t.target,
            status: t.status || "in_progress",
            date_added: t.date_added || null,
            date_updated: t.date_updated || null,
            cleared: t.cleared ?? false,
          });
        });
        setChildren(dedupedRows.map(row => {
          const childId = (row.children_uat || {}).id || row.child_id;
          return { ...mapRowToChild(row), currentTargets: byChild[childId] || { universal: [], targeted: [], specialist: [] } };
        }));
      }
    } catch {}
    setSaving(false);
    showToast(`✓ Imported ${ok} children${failed ? ` (${failed} failed — check console)` : ""}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" style={F}>
      <div className="bg-white w-full sm:max-w-2xl shadow-2xl max-h-[92vh] flex flex-col sm:mx-4"
        style={{ border: `3px solid ${INK}` }}>
        {/* Black header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ background: INK }}>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: YELLOW, color: INK, ...FM }}>↑</div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-widest" style={{ ...FM, color: YELLOW }}>Import Caseload</h3>
              <p className="text-xs" style={{ ...FM, color: "#647981" }}>Upload Excel or CSV — saves directly to Supabase</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-lg font-bold"
            style={{ color: "#647981" }}
            onMouseEnter={e => { e.currentTarget.style.color = YELLOW; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#647981"; }}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" && (
            <div>
              <label className="flex flex-col items-center p-10 text-center cursor-pointer transition-all"
                style={{ border: `2px dashed ${BORDER}`, background: "#faf7f4" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.background = YELLOW; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = "#faf7f4"; }}>
                <p className="text-4xl mb-3">📊</p>
                <p className="font-semibold mb-1" style={{ ...FM, color: INK }}>Choose your caseload file</p>
                <p className="text-xs mb-4" style={{ ...FM, color: MID }}>Supports .xlsx, .xls, .csv</p>
                <span className="px-6 py-2.5 text-sm font-semibold"
                  style={{ ...FM, background: INK, color: YELLOW, border: `2px solid ${INK}` }}>
                  Choose File
                </span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </label>
              {status && (
                <div className="mt-4 p-4" style={{ background: "rgba(255,255,255,0.72)", border: "2px solid #78B9C7" }}>
                  <p className="text-sm font-medium" style={{ ...FM, color: "#1D4ED8" }}>{status}</p>
                </div>
              )}
            </div>
          )}
          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="p-4" style={{ background: MENTHE, border: `2px solid ${LAGUNE}` }}>
                <p className="font-semibold text-sm" style={{ ...FM, color: "#2a2320" }}>✓ {preview.length} children ready to import</p>
                {status && <p className="text-xs mt-1" style={{ ...FM, color: NECTARINE }}>{status}</p>}
              </div>
              <div className="overflow-hidden" style={{ border: `2px solid ${INK}` }}>
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-widest" style={{ background: INK, color: YELLOW, ...FM }}>
                  Preview — first 5
                </div>
                <table className="w-full text-xs">
                  <thead style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <tr>
                      {["Name","Year","Tiers","Lead","EHCP"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold uppercase tracking-wider"
                          style={{ ...FM, color: MID }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((c, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                        <td className="px-4 py-2.5 font-bold" style={{ ...FM, color: INK }}>{c.name}</td>
                        <td className="px-4 py-2.5" style={{ ...FM, color: MID }}>{c.yearGroup}</td>
                        <td className="px-4 py-2.5"><div className="flex gap-1">{c.tiers.map(t => <TierPill key={t} tier={t} />)}</div></td>
                        <td className="px-4 py-2.5" style={{ ...FM, color: MID }}>{c.lead || "—"}</td>
                        <td className="px-4 py-2.5">{c.ehcp ? <Chip className="bg-violet-100 text-violet-900">EHCP</Chip> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 flex gap-3 flex-shrink-0" style={{ borderTop: `2px solid ${BORDER}` }}>
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
