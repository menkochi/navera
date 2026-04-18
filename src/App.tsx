// @ts-nocheck
import { useState, useEffect, useCallback } from "react";


// ── Constants ─────────────────────────────────────────────────────────────────
const SLT_HIERARCHIES = {
  concepts: { label: "Concepts & Spatial Language", levels: [["in","on","under","next to"],["in front","behind","beside","between"],["all but one","either/or","first/last","before/after"],["neither/nor","unless","although","when you do this, I do that"],["despite","however","therefore","consequently"]] },
  phonology: { label: "Phonology & Speech Sounds", levels: [["environmental sounds","animal sounds","syllable clapping"],["initial sounds awareness","rhyming","alliteration"],["phoneme blending CVC words","phoneme segmentation","initial phoneme deletion"],["consonant clusters /s/ blends","consonant clusters without /s/","final consonant deletion"],["medial phoneme manipulation","complex word structures","multisyllabic words"]] },
  phonologicalProcesses: { label: "Phonological Processes", levels: [["stopping /f/ /s/","fronting velars car→tar","final consonant deletion bus→bu"],["stopping /z/ /v/","weak syllable deletion banana→nana","velar assimilation take→cake"],["stopping sh/ch/j/th","cluster reduction /s/ blends","deaffrication cheer→sheer"],["gliding /r/ /l/","complex cluster reduction","assimilation patterns resolved"]] },
  vocabulary: { label: "Vocabulary & Word Knowledge", levels: [["basic nouns (objects)","basic verbs (actions)","body parts","food/animals"],["categories and sorting","basic describing words (big/small/hot/cold)","colours"],["synonyms","antonyms","function words","position words"],["multiple meanings","figurative language","compound words","word families"],["idioms","inference from context","subject-specific vocabulary","abstract concepts"]] },
  grammar: { label: "Grammar & Sentence Structure", levels: [["single words","2-word combinations (more juice, big dog)","agent+action (daddy go)"],["3-word phrases","simple sentences SVO","negation (no, not)","personal pronouns I/you/he/she"],["past tense regular (-ed)","plurals (-s)","present progressive (-ing)","possessives"],["past tense irregular","questions (wh-)","auxiliary verbs (is/are/was)","conjunctions (and/but/because)"],["complex sentences with clauses","passive voice","embedded clauses","conditional sentences if/when"],["relative clauses","advanced connectives","grammatical metalanguage"]] },
  listening: { label: "Listening & Comprehension", levels: [["attention stage 1 (fleeting)","responds to name","1 key word instruction with cues"],["attention stage 2 (rigid)","1-step instruction without cues","literal 'what' questions"],["attention stage 3 (single channelled with support)","2-step instructions","where/who questions"],["attention stage 4 (focusing)","3-step instructions","why/how questions","story retell key points"],["attention stage 5 (two-channelled)","inferential questions","predicting outcomes","critical listening"],["attention stage 6 (integrated)","complex multi-step","evaluating narrative","listening in background noise"]] },
  social: { label: "Social Communication & Pragmatics", levels: [["eye contact/gaze","joint attention","turn-taking in play","simple greetings"],["requesting (pointing/reaching)","protesting","commenting","asking for help"],["topic initiation","topic maintenance (2-3 turns)","repair strategies","non-verbal cues awareness"],["perspective taking (ToM level 1)","adjusting language for audience","understanding jokes/sarcasm basics"],["perspective taking (ToM level 2)","complex social inference","peer negotiation","conflict resolution"]] },
  narrativeLanguage: { label: "Narrative Language", levels: [["labels pictures","describes single actions","names characters"],["2-event sequences","simple story retell with prompts","basic story elements (who/what)"],["3-4 event sequences","beginning/middle/end","character feelings","problem identification"],["story grammar (setting/character/problem/solution/ending)","inferencing from narrative","story generation"],["complex narratives with multiple episodes","cohesive devices","perspective shifts in stories"]] },
  earlyLanguage: { label: "Early Language & Communication", levels: [["joint attention (stage 1)","turn-taking in interactions","responding to name"],["joint attention (stage 2)","imitation of actions","pointing/showing gestures"],["joint attention (stage 3)","proto-declarative pointing","intentional vocalisations"],["joint attention (stage 4)","symbolic gestures","first words emerging (10-50 words)"],["50+ words","2-word combinations","word learning strategies","fast mapping"]] },
  readingComprehension: { label: "Reading & Literacy Comprehension", levels: [["print awareness","book handling","environmental print","rhyme appreciation"],["phonological awareness (rhyme/alliteration)","letter-sound knowledge","sight words"],["decoding simple CVC words","reading simple sentences","literal comprehension"],["reading fluency","inferential comprehension","main idea identification"],["critical reading","evaluating text","reading for different purposes"]] }
};

const APPROACHES = ["Visual supports and timetables","Colourful Semantics","Barrier Games","Dialogic Reading (PEER/CROWD)","Talk Boost","Word Aware","Intensive Interaction","Attention Autism","PECS","Makaton/Signalong","Narrative Therapy / Story Grammar Marker","ELKLAN Strategies","Social Stories","Zones of Regulation","Cued Articulation","SCERTS Framework","Core Vocabulary / LAMP","Hanen It Takes Two to Talk","TMCR Parent Coaching","Routine-Based Intervention","Play-Based Language Facilitation","Gestalt Language Processing support","Child-led play / Floor Time","JAML"];

const EBP_KNOWLEDGE = {
  languageStrategies24: ["At their level/face-to-face","Be animated","Baby signs/Makaton","Choices (offer 2 options)","Self talk and parallel talk","Toy talk","Communicative temptations","Copy actions and sounds","Copy and add words (recast and expand)","Creative stupidity","Cue with a sound or syllable","Emphasise/exaggerate target words","Follow their lead","Gestures","Linguistic mapping","Modelling sounds","Modelling words/naming","Pausing","Reduce questions","Repeat target words","Slow down","Verbal routines","Watch and wait","Withholding playfully"],
  playTypes: ["Exploratory","Cause and Effect","Toy Play","Constructive","Physical","People Play","Pretend Play"],
  communicationFunctions: ["Gain attention","Greet","Request item/action","Direct action","Protest/reject","Ask for help","Comment","Express feelings","Ask/answer questions"],
  attentionLevels: { "Stage 1 (0-1yr)": "Fleeting - use motivators, follow child's lead", "Stage 2 (1-2yr)": "Rigid - give time, highly motivating tasks", "Stage 3 (2-3yr)": "Single channelled with support - call name, short familiar activities", "Stage 4 (3-4yr)": "Focusing - tell when to listen, call name first", "Stage 5 (4-5yr)": "Two-channelled - praise good listening, visual supports", "Stage 6 (5-6yr)": "Integrated - normal mature attention" },
  glpStages: { 1: "Delayed echolalia - model from child's perspective, acknowledge all communication", 2: "Mitigation - breaking gestalts into chunks, expand and mix language models", 3: "Isolation - single words emerging, label + comment, no demands", 4: "Self-generation - novel language forming, expand naturally" },
  routineBasedStrategies: ["Embed targets in daily routines (mealtimes, bath, dressing, transitions)","Use verbal routines (predictable phrases said the same way each time)","People play games (tickle, peek-a-boo, chase)","Sing action songs and rhymes (pause for child to fill in)","Turn daily care routines into language opportunities"]
};

const SEASONS = [
  { name: "Autumn", months: [9,10], emoji: "🍂", themes: ["harvest","leaves","Halloween","Bonfire Night"] },
  { name: "Winter", months: [11,12,1], emoji: "❄️", themes: ["Christmas","winter animals","New Year","snow"] },
  { name: "Spring", months: [2,3,4], emoji: "🌸", themes: ["Easter","new life","flowers","Mother's Day"] },
  { name: "Summer", months: [5,6,7,8], emoji: "☀️", themes: ["beach","sports day","end of year","garden"] }
];

const TIER_COLOURS = {
  universal: { badge: "bg-emerald-100 text-emerald-800" },
  targeted: { badge: "bg-blue-100 text-blue-800" },
  specialist: { badge: "bg-purple-100 text-purple-800" }
};

const SEED_CHILDREN = [
  { id:"c1", name:"Amara Osei", yearGroup:"Year 1", dob:"2018-09-12", tiers:["universal","targeted"], difficulties:["concepts","vocabulary","listening"], currentTargets:{ universal:["Follow 1-step classroom instructions","Identify key vocabulary in topic work"], targeted:["in/on/under concepts","basic category sorting"], specialist:[] }, nextTargets:{targeted:[]}, ehcp:false, ehcpHours:0, sessionsLogged:[], notes:"Responds well to visual supports. Makaton signs helpful.", progress:{universal:40,targeted:55,specialist:0}, approvedResources:[], pendingResources:[], videos:[], lead:"", class:"1A", gender:"", ethnicity:"", language:"", senStatus:"SEN Support", reviewDate:"", additionalNeeds:"" },
  { id:"c2", name:"Ethan Blackwell", yearGroup:"Year 3", dob:"2016-04-22", tiers:["targeted","specialist"], difficulties:["grammar","social","phonology"], currentTargets:{ universal:[], targeted:["past tense verbs","turn-taking in pairs"], specialist:["phoneme blending CVC words","social greetings routine"] }, nextTargets:{targeted:[]}, ehcp:true, ehcpHours:180, sessionsLogged:[{ date:"2025-01-08", duration:45, type:"Individual", notes:"Good engagement with phonics games" },{ date:"2025-01-15", duration:45, type:"Individual", notes:"Progressing on greetings" }], notes:"EHCP - annual review due March 2025.", progress:{universal:0,targeted:60,specialist:35}, approvedResources:[], pendingResources:[], videos:[], lead:"Priya", class:"3B", gender:"Male", ethnicity:"", language:"", senStatus:"EHCP", reviewDate:"March 2025", additionalNeeds:"" },
  { id:"c3", name:"Sofia Patel", yearGroup:"Year 2", dob:"2017-11-03", tiers:["universal"], difficulties:["vocabulary","listening","social"], currentTargets:{ universal:["Expand topic vocabulary","Listen and respond to 2-step instructions"], targeted:[], specialist:[] }, nextTargets:{targeted:[]}, ehcp:false, ehcpHours:0, sessionsLogged:[], notes:"EAL - Punjabi is home language.", progress:{universal:65,targeted:0,specialist:0}, approvedResources:[], pendingResources:[], videos:[], lead:"", class:"2C", gender:"Female", ethnicity:"", language:"Punjabi", senStatus:"SEN Support", reviewDate:"", additionalNeeds:"" }
];

const getCurrentSeason = () => { const m = new Date().getMonth()+1; return SEASONS.find(s=>s.months.includes(m))||SEASONS[2]; };

async function callClaude(prompt, systemPrompt="") {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
      system: systemPrompt||"You are an expert Speech and Language Therapist assistant. Be concise, practical and age-appropriate.",
      messages:[{role:"user",content:prompt}] })
  });
  const data = await res.json();
  return data.content?.map(b=>b.text||"").join("\n")||"";
}

// ── UI Primitives ──────────────────────────────────────────────────────────────
function SectionBanner({ title, color="bg-amber-400" }) {
  return <div className={`${color} px-5 py-3`}><h2 className="text-white font-semibold text-sm">{title}</h2></div>;
}
function Card({ children, banner, className="" }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm overflow-hidden ${className}`}>
      {banner}
      <div className="p-5">{children}</div>
    </div>
  );
}
function Field({ label, value }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-gray-50 last:border-0 items-start">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}:</span>
      <span className="text-sm text-gray-800 font-medium">{value||"—"}</span>
    </div>
  );
}
function StatTile({ label, value, color }) {
  return (
    <div className={`${color} rounded-lg p-3 text-white flex-1 min-w-0`}>
      <p className="text-xl font-bold leading-none truncate">{value}</p>
      <p className="text-xs mt-1 opacity-90 leading-tight">{label}</p>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function SLTApp() {
  const [children, setChildren] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [section, setSection] = useState("core");
  const [pendingQueue, setPendingQueue] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [addModal, setAddModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("slt_children");
        if (r?.value) {
          const loaded = JSON.parse(r.value);
          const cleaned = loaded.filter(c => !/^child\s*\d+$/i.test(String(c.name||"").trim()));
          setChildren(cleaned);
          await window.storage.set("slt_children", JSON.stringify(cleaned));
        } else setChildren(SEED_CHILDREN);
      } catch { setChildren(SEED_CHILDREN); }
      try { const r = await window.storage.get("slt_pending"); if (r?.value) setPendingQueue(JSON.parse(r.value)); } catch {}
    })();
  }, []);

  const save = useCallback(async (updated, pending) => {
    const c = updated??children; const p = pending??pendingQueue;
    try { await window.storage.set("slt_children", JSON.stringify(c)); } catch {}
    try { await window.storage.set("slt_pending", JSON.stringify(p)); } catch {}
  }, [children, pendingQueue]);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const updateChild = (id, updater) => {
    setChildren(prev => { const next = prev.map(c => c.id===id ? {...c,...updater(c)} : c); save(next,null); return next; });
  };

  const openProfile = (id) => { setSelectedId(id); setSection("core"); setView("profile"); };
  const child = children.find(c=>c.id===selectedId);

  const stats = {
    total: children.length,
    specialist: children.filter(c=>c.tiers.includes("specialist")).length,
    targeted: children.filter(c=>c.tiers.includes("targeted")&&!c.tiers.includes("specialist")).length,
    universal: children.filter(c=>c.tiers.length===1&&c.tiers[0]==="universal").length,
    ehcp: children.filter(c=>c.ehcp).length,
    pending: pendingQueue.length,
  };

  // Breadcrumbs
  const crumbs = view==="profile"&&child
    ? [{l:"Home",a:()=>setView("dashboard")},{l:"Caseload",a:()=>setView("caseload")},{l:child.name}]
    : view==="caseload" ? [{l:"Home",a:()=>setView("dashboard")},{l:"Caseload"}]
    : view==="approvals" ? [{l:"Home",a:()=>setView("dashboard")},{l:"Approvals"}]
    : [{l:"Home"}];

  // Action buttons per view
  const actions = view==="profile"&&child ? [
    {l:"Log Session", onClick:()=>setSection("sessions")},
    {l:"Parent Portal", onClick:()=>setSection("parent")},
  ] : view==="caseload" ? [
    {l:"↑ Import Excel", onClick:()=>setImportModal(true), primary:true},
    {l:"+ Add Child", onClick:()=>setAddModal(true)},
  ] : view==="approvals" ? [] : [
    {l:"↑ Import Excel", onClick:()=>setImportModal(true), primary:true},
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-1.5 text-sm">
          <div className="w-7 h-7 bg-indigo-600 rounded text-white flex items-center justify-center text-xs font-bold mr-2">SLT</div>
          {crumbs.map((b,i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i>0 && <span className="text-gray-300 text-xs">›</span>}
              {b.a ? <button onClick={b.a} className="text-indigo-600 hover:underline text-sm">{b.l}</button>
                   : <span className="text-gray-700 font-medium text-sm">{b.l}</span>}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {actions.map((a,i) => (
            <button key={i} onClick={a.onClick}
              className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                a.primary ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                           : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
              {a.l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          {view==="profile"&&child
            ? <ProfileNav section={section} setSection={setSection} child={child} />
            : <MainNav view={view} setView={v=>{setView(v);setSelectedId(null);}} stats={stats} pendingCount={pendingQueue.length} />}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {view==="dashboard" && <Dashboard children={children} stats={stats} onOpen={openProfile} />}
          {view==="caseload" && <Caseload children={children} setChildren={setChildren} save={save} onOpen={openProfile} showToast={showToast} />}
          {view==="profile"&&child && (
            <ChildProfile child={child} section={section} setSection={setSection}
              updateChild={updateChild} pendingQueue={pendingQueue} setPendingQueue={setPendingQueue}
              save={save} showToast={showToast} loading={loading} setLoading={setLoading} children={children} />
          )}
          {view==="approvals" && (
            <Approvals queue={pendingQueue} setQueue={setPendingQueue} children={children}
              setChildren={setChildren} save={save} showToast={showToast} loading={loading} setLoading={setLoading} />
          )}
        </main>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium z-50 ${toast.type==="success"?"bg-emerald-600":"bg-red-500"}`}>
          {toast.msg}
        </div>
      )}
      {importModal && <ImportModal onClose={()=>setImportModal(false)} setChildren={setChildren} save={save} showToast={showToast} />}
      {addModal && <AddChildModal onAdd={c=>{const next=[...children,c];setChildren(next);save(next,null);setAddModal(false);}} onClose={()=>setAddModal(false)} />}
    </div>
  );
}

// ── Main Nav ──────────────────────────────────────────────────────────────────
function MainNav({ view, setView, stats, pendingCount }) {
  const items = [
    {id:"dashboard", icon:"⊞", label:"Dashboard"},
    {id:"caseload", icon:"👥", label:"My Caseload", count:stats.total},
    {id:"approvals", icon:"✅", label:"Approvals", count:pendingCount, alert:pendingCount>0},
  ];
  return (
    <div className="py-3">
      <div className="px-4 pb-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Navigation</p>
      </div>
      <div className="py-1">
        {items.map(item => (
          <button key={item.id} onClick={()=>setView(item.id)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
              view===item.id ? "border-l-4 border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold"
                            : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50"}`}>
            <span className="flex items-center gap-2"><span>{item.icon}</span>{item.label}</span>
            {item.count>0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${item.alert?"bg-amber-100 text-amber-700":"bg-gray-100 text-gray-500"}`}>{item.count}</span>}
          </button>
        ))}
      </div>
      <div className="mx-4 mt-3 pt-3 border-t border-gray-100 space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Breakdown</p>
        {[{l:"🟢 Universal",v:stats.universal},{l:"🔵 Targeted",v:stats.targeted},{l:"🟣 Specialist",v:stats.specialist},{l:"📋 EHCP",v:stats.ehcp}].map(s=>(
          <div key={s.l} className="flex justify-between text-xs text-gray-500"><span>{s.l}</span><span className="font-semibold text-gray-700">{s.v}</span></div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Nav ───────────────────────────────────────────────────────────────
function ProfileNav({ section, setSection, child }) {
  const items = [
    {id:"core", icon:"📋", label:"Core Data"},
    {id:"slprofile", icon:"🗣", label:"S&L Profile"},
    {id:"universal", icon:"🟢", label:"Universal Support", show:child.tiers.includes("universal")},
    {id:"targeted", icon:"🔵", label:"Targeted Support", show:child.tiers.includes("targeted")},
    {id:"specialist", icon:"🟣", label:"Specialist Support", show:child.tiers.includes("specialist")},
    {id:"parent", icon:"👪", label:"Parent Portal"},
    {id:"sessions", icon:"📅", label:"Sessions Log"},
    {id:"files", icon:"📁", label:"Files & Videos"},
  ].filter(i=>i.show!==false);
  return (
    <div className="py-3">
      <div className="px-4 pb-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Child Record</p>
      </div>
      <div className="py-1">
        {items.map(item => (
          <button key={item.id} onClick={()=>setSection(item.id)}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
              section===item.id ? "border-l-4 border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold"
                               : "border-l-4 border-transparent text-gray-600 hover:bg-gray-50"}`}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Child Profile ─────────────────────────────────────────────────────────────
function ChildProfile({ child, section, setSection, updateChild, pendingQueue, setPendingQueue, save, showToast, loading, setLoading, children }) {
  const totalTargets = [...child.currentTargets.universal, ...child.currentTargets.targeted, ...child.currentTargets.specialist].length;
  const totalHours = child.sessionsLogged.reduce((s,sess)=>s+sess.duration,0)/60;
  const ehcpPct = child.ehcp&&child.ehcpHours>0 ? Math.min(100,Math.round((totalHours/(child.ehcpHours/60))*100)) : null;
  const avgProgress = child.tiers.reduce((s,t)=>s+child.progress[t],0)/(child.tiers.length||1);

  const tiles = [
    {label:"Active targets", value:totalTargets, color:"bg-emerald-500"},
    {label:"Sessions logged", value:child.sessionsLogged.length, color:"bg-red-400"},
    {label:"Hours delivered", value:totalHours.toFixed(1)+"h", color:"bg-amber-400"},
    {label:"Universal targets", value:child.currentTargets.universal.length, color:"bg-blue-800"},
    {label:"Targeted targets", value:child.currentTargets.targeted.length, color:"bg-blue-400"},
    {label:"Specialist targets", value:child.currentTargets.specialist.length, color:"bg-teal-500"},
    {label:"EHCP hours used", value:ehcpPct!==null?ehcpPct+"%":"N/A", color:"bg-purple-500"},
    {label:"Avg progress", value:Math.round(avgProgress)+"%", color:"bg-orange-400"},
  ];

  return (
    <div className="space-y-4">
      {/* Name + badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-800">{child.name}</h1>
        {child.ehcp && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded">EHCP</span>}
        {child.tiers.map(t=>(
          <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOURS[t].badge}`}>{t}</span>
        ))}
        {child.lead && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Lead: {child.lead}</span>}
      </div>

      {/* Stat tiles */}
      <div className="flex gap-2">
        {tiles.map((t,i)=><StatTile key={i} {...t} />)}
      </div>

      {/* Section content */}
      <div>
        {section==="core" && <CoreDataSection child={child} updateChild={updateChild} />}
        {section==="slprofile" && <SLProfileSection child={child} />}
        {section==="universal" && <UniversalSection child={child} updateChild={updateChild} showToast={showToast} loading={loading} setLoading={setLoading} />}
        {section==="targeted" && <TargetedSection child={child} updateChild={updateChild} showToast={showToast} loading={loading} setLoading={setLoading} />}
        {section==="specialist" && <SpecialistSection child={child} updateChild={updateChild} showToast={showToast} />}
        {section==="parent" && <ParentSection child={child} updateChild={updateChild} pendingQueue={pendingQueue} setPendingQueue={setPendingQueue} save={save} showToast={showToast} loading={loading} setLoading={setLoading} />}
        {section==="sessions" && <SessionsSection child={child} updateChild={updateChild} showToast={showToast} />}
        {section==="files" && <FilesSection child={child} updateChild={updateChild} showToast={showToast} />}
      </div>
    </div>
  );
}

// ── Core Data Section ─────────────────────────────────────────────────────────
function CoreDataSection({ child }) {
  const firstName = child.name.split(" ")[0];
  const lastName = child.name.split(" ").slice(1).join(" ");
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card banner={<SectionBanner title="Core data" color="bg-amber-400" />}>
        <div className="flex gap-4">
          <div className="w-24 h-28 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200 text-3xl">👤</div>
          <div className="flex-1">
            <Field label="First name" value={firstName} />
            <Field label="Last name" value={lastName} />
            <Field label="Date of birth" value={child.dob} />
            <Field label="Year group" value={child.yearGroup} />
            <Field label="Class" value={child.class} />
            <Field label="Gender" value={child.gender} />
            <Field label="SEN stage" value={child.senStatus} />
          </div>
        </div>
      </Card>
      <Card banner={<SectionBanner title="Additional data" color="bg-emerald-500" />}>
        <Field label="Home language" value={child.language} />
        <Field label="Ethnicity" value={child.ethnicity} />
        <Field label="SLT lead" value={child.lead} />
        <Field label="Review date" value={child.reviewDate} />
        <Field label="Additional needs" value={child.additionalNeeds} />
        <Field label="EHCP" value={child.ehcp ? `Yes — ${child.ehcpHours} hrs/year` : "No"} />
        {child.notes && <div className="mt-3 p-2.5 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800">📌 {child.notes}</div>}
        {child.extraFields && Object.keys(child.extraFields).length>0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(child.extraFields).map(([k,v])=>(
              <span key={k} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{k}: {v}</span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── S&L Profile Section ───────────────────────────────────────────────────────
function SLProfileSection({ child }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card banner={<SectionBanner title="Areas of difficulty" color="bg-blue-500" />}>
        <div className="flex flex-wrap gap-2">
          {child.difficulties.length>0
            ? child.difficulties.map(d=>(
                <span key={d} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium capitalize">
                  {SLT_HIERARCHIES[d]?.label||d}
                </span>
              ))
            : <p className="text-gray-400 text-sm italic">No difficulties recorded</p>}
        </div>
      </Card>
      <Card banner={<SectionBanner title="Progress overview" color="bg-blue-500" />}>
        {child.tiers.map(t=>(
          <div key={t} className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span className="capitalize font-medium">{t} level</span><span>{child.progress[t]}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${t==="universal"?"bg-emerald-400":t==="targeted"?"bg-blue-400":"bg-purple-400"}`}
                style={{width:`${child.progress[t]}%`}} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Universal Section ─────────────────────────────────────────────────────────
function UniversalSection({ child, updateChild, showToast, loading, setLoading }) {
  const [problem, setProblem] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [asked, setAsked] = useState(false);

  const getSuggestions = async () => {
    if (!problem.trim()) return;
    setLoading(true); setAsked(true);
    try {
      const strategyList = EBP_KNOWLEDGE.languageStrategies24.join(", ");
      const attentionInfo = JSON.stringify(EBP_KNOWLEDGE.attentionLevels);
      const prompt = `You are an expert UK Speech and Language Therapist. Child: ${child.name}, ${child.yearGroup}. Difficulties: ${child.difficulties.join(", ")}. Teacher-observed classroom problem: "${problem}". Current universal targets: ${child.currentTargets.universal.join(", ")||"none set yet"}. Notes: ${child.notes||"none"}.

Draw on: 24 Language Facilitation Strategies (SLT Handbook): ${strategyList}. Attention levels: ${attentionInfo}. Classroom approaches: Visual supports, Colourful Semantics, Barrier Games, Word Aware, Talk Boost, Dialogic Reading.

Generate 4 specific, practical, creative classroom strategies. Each must be immediately actionable by a teacher with no SLT background. Format:
[N]. **[Strategy Name]** (Evidence: [approach name])
[Description max 50 words]
Why it works: [1 sentence]

Start directly with strategy 1.`;
      const result = await callClaude(prompt, "You are an expert UK SLT applying evidence-based classroom strategies.");
      setSuggestions(result.split(/\n(?=\d\.)/).filter(Boolean));
    } catch { showToast("AI unavailable","error"); }
    setLoading(false);
  };

  const saveTarget = (s) => {
    updateChild(child.id, c=>({currentTargets:{...c.currentTargets,universal:[...c.currentTargets.universal,s.replace(/\*\*/g,"").split("\n")[0].replace(/^\d+\.\s*/,"").split("(")[0].trim()]}}));
    showToast("Target saved ✓");
  };

  return (
    <div className="space-y-4">
      <Card banner={<SectionBanner title="Universal Support — Classroom Strategy Generator" color="bg-emerald-500" />}>
        <p className="text-sm text-gray-500 mb-3">Describe a functional classroom problem and get evidence-based strategies the teacher can use immediately.</p>
        <textarea value={problem} onChange={e=>setProblem(e.target.value)}
          placeholder="e.g. 'Child is not participating in group discussions and loses track of what others are saying…'"
          className="w-full border border-gray-200 rounded-lg p-3 text-sm h-20 outline-none focus:border-emerald-400 resize-none" />
        <button onClick={getSuggestions} disabled={loading||!problem.trim()}
          className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
          {loading?"Generating…":"✨ Suggest Classroom Strategies"}
        </button>
      </Card>

      {asked && suggestions.length>0 && (
        <Card banner={<SectionBanner title="AI-Suggested Strategies" color="bg-emerald-400" />}>
          <div className="space-y-3">
            {suggestions.map((s,i)=>(
              <div key={i} className="flex gap-3 border border-emerald-100 rounded-lg p-3 bg-emerald-50">
                <span className="text-emerald-600 font-bold text-lg shrink-0">{i+1}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.replace(/^\d+\.\s*/,"")}</p>
                </div>
                <button onClick={()=>saveTarget(s)} className="text-xs text-emerald-600 border border-emerald-300 px-2 py-1 rounded hover:bg-emerald-100 shrink-0">+ Save</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card banner={<SectionBanner title="Current Universal Targets" color="bg-gray-400" />}>
        {child.currentTargets.universal.length>0
          ? <ul className="space-y-2">{child.currentTargets.universal.map((t,i)=>(
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-emerald-400 mt-0.5">●</span>{t}</li>
            ))}</ul>
          : <p className="text-gray-400 text-sm italic">No universal targets set yet</p>}
      </Card>
    </div>
  );
}

// ── Targeted Section ──────────────────────────────────────────────────────────
function TargetedSection({ child, updateChild, showToast, loading, setLoading }) {
  const [nextSuggestions, setNextSuggestions] = useState([]);
  const [observationNote, setObservationNote] = useState("");
  const [generated, setGenerated] = useState(false);

  const suggestNextTargets = async () => {
    setLoading(true); setGenerated(true);
    try {
      const hier = child.difficulties.map(d=>SLT_HIERARCHIES[d]?`${SLT_HIERARCHIES[d].label}: levels = ${JSON.stringify(SLT_HIERARCHIES[d].levels)}`:d).join("\n");
      const prompt = `You are an expert UK SLT. Child: ${child.name}, ${child.yearGroup}. Difficulties: ${child.difficulties.join(", ")}. Current targeted targets: ${child.currentTargets.targeted.join(", ")||"none"}. SEN: ${child.senStatus||"not specified"}. Notes: ${child.notes||"none"}. Observation: "${observationNote||"Good progress on current targets - ready to progress"}".

SLT hierarchical progressions:\n${hier}

Evidence base: SLT Handbook 24 strategies, GLP stages: ${JSON.stringify(EBP_KNOWLEDGE.glpStages)}, Attention levels: ${JSON.stringify(EBP_KNOWLEDGE.attentionLevels)}, What Works (Speech and Language UK), ELKLAN, Hanen ITT2T, TMCR, play types: ${EBP_KNOWLEDGE.playTypes.join(", ")}, communication functions: ${EBP_KNOWLEDGE.communicationFunctions.join(", ")}.

Provide:
NEXT TARGETS (3-4 functional, hierarchically appropriate - include progression rationale):
RECOMMENDED APPROACHES (2-3 - name approach, 1-sentence rationale, 1 specific activity):
CLASSROOM CARRY-OVER STRATEGIES (2 - using the 24 language facilitation strategies):`;
      const result = await callClaude(prompt, "You are an expert UK SLT drawing on evidence-based hierarchical target progression.");
      setNextSuggestions([result]);
    } catch { showToast("AI unavailable","error"); }
    setLoading(false);
  };

  const acceptTargets = (text) => {
    const lines = text.split("\n").filter(l=>/^\d\./.test(l)).map(l=>l.replace(/^\d\.\s*/,"").replace(/\(.*?\)/,"").trim());
    if (lines.length>0) { updateChild(child.id, c=>({currentTargets:{...c.currentTargets,targeted:lines}})); showToast("Targeted targets updated ✓"); setNextSuggestions([]); }
  };

  return (
    <div className="space-y-4">
      <Card banner={<SectionBanner title="Targeted Support — Next Target Generator" color="bg-blue-500" />}>
        <p className="text-sm text-gray-500 mb-3">Add observation notes then generate the next hierarchical targets based on the evidence base.</p>
        <textarea value={observationNote} onChange={e=>setObservationNote(e.target.value)}
          placeholder="Observation notes (e.g. 'Child is consistently using in/on/under correctly, ready to progress…')"
          className="w-full border border-gray-200 rounded-lg p-3 text-sm h-20 outline-none focus:border-blue-400 resize-none" />
        <button onClick={suggestNextTargets} disabled={loading}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading?"Thinking…":"✨ Suggest Next Targets"}
        </button>
      </Card>

      {generated && nextSuggestions.length>0 && (
        <Card banner={<SectionBanner title="AI Suggested Progression" color="bg-blue-400" />}>
          <div className="flex justify-end mb-3">
            <button onClick={()=>acceptTargets(nextSuggestions[0])} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700">✓ Accept & Update Targets</button>
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{nextSuggestions[0]}</pre>
        </Card>
      )}

      <Card banner={<SectionBanner title="Current Targeted Targets (6-week cycle)" color="bg-gray-400" />}>
        {child.currentTargets.targeted.length>0
          ? <ul className="space-y-2">{child.currentTargets.targeted.map((t,i)=>(
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-blue-400 mt-0.5">●</span>{t}</li>
            ))}</ul>
          : <p className="text-gray-400 text-sm italic">No targeted targets set yet</p>}
      </Card>
    </div>
  );
}

// ── Specialist Section ────────────────────────────────────────────────────────
function SpecialistSection({ child, updateChild, showToast }) {
  const [newSession, setNewSession] = useState({date:"",duration:45,type:"Individual",notes:""});
  const totalHours = child.sessionsLogged.reduce((s,sess)=>s+sess.duration,0)/60;
  const pct = child.ehcp&&child.ehcpHours>0 ? Math.min(100,(totalHours/(child.ehcpHours/60))*100) : 0;

  const logSession = () => {
    if (!newSession.date) return;
    updateChild(child.id, c=>({sessionsLogged:[...c.sessionsLogged,{...newSession}]}));
    setNewSession({date:"",duration:45,type:"Individual",notes:""});
    showToast("Session logged ✓");
  };

  return (
    <div className="space-y-4">
      {child.ehcp && (
        <Card banner={<SectionBanner title="EHCP Hours Tracker" color="bg-purple-500" />}>
          <div className="flex gap-8 mb-3">
            {[{l:"Delivered",v:totalHours.toFixed(1)+"h"},{l:"Allocated",v:(child.ehcpHours/60).toFixed(0)+"h"},{l:"Remaining",v:((child.ehcpHours/60)-totalHours).toFixed(1)+"h"}].map(s=>(
              <div key={s.l}><p className="text-2xl font-bold text-gray-800">{s.v}</p><p className="text-xs text-gray-400">{s.l}</p></div>
            ))}
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-400 rounded-full" style={{width:`${pct}%`}} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct.toFixed(0)}% of annual allocation used</p>
        </Card>
      )}

      <Card banner={<SectionBanner title="Current Specialist Targets" color="bg-purple-500" />}>
        {child.currentTargets.specialist.length>0
          ? <ul className="space-y-2">{child.currentTargets.specialist.map((t,i)=>(
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="text-purple-400 mt-0.5">●</span>{t}</li>
            ))}</ul>
          : <p className="text-gray-400 text-sm italic">No specialist targets set yet</p>}
      </Card>
    </div>
  );
}

// ── Sessions Section ──────────────────────────────────────────────────────────
function SessionsSection({ child, updateChild, showToast }) {
  const [newSession, setNewSession] = useState({date:"",duration:45,type:"Individual",notes:""});

  const logSession = () => {
    if (!newSession.date) return;
    updateChild(child.id, c=>({sessionsLogged:[...c.sessionsLogged,{...newSession}]}));
    setNewSession({date:"",duration:45,type:"Individual",notes:""});
    showToast("Session logged ✓");
  };

  return (
    <div className="space-y-4">
      <Card banner={<SectionBanner title="Log a Session" color="bg-indigo-500" />}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input type="date" value={newSession.date} onChange={e=>setNewSession(s=>({...s,date:e.target.value}))} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          <input type="number" value={newSession.duration} onChange={e=>setNewSession(s=>({...s,duration:+e.target.value}))} placeholder="Duration (mins)" className="border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          <select value={newSession.type} onChange={e=>setNewSession(s=>({...s,type:e.target.value}))} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-indigo-400">
            <option>Individual</option><option>Group</option><option>Observation</option><option>Consultation</option>
          </select>
        </div>
        <input value={newSession.notes} onChange={e=>setNewSession(s=>({...s,notes:e.target.value}))} placeholder="Session notes" className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-indigo-400 mb-2" />
        <button onClick={logSession} className="bg-indigo-600 text-white px-4 py-2 rounded text-xs font-medium hover:bg-indigo-700">Log Session</button>
      </Card>

      <Card banner={<SectionBanner title={`Session Log (${child.sessionsLogged.length} sessions)`} color="bg-gray-500" />}>
        {child.sessionsLogged.length>0 ? (
          <table className="w-full text-xs">
            <thead className="bg-gray-50"><tr>{["Date","Duration","Type","Notes"].map(h=><th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">
              {[...child.sessionsLogged].reverse().map((s,i)=>(
                <tr key={i}><td className="px-3 py-2">{s.date}</td><td className="px-3 py-2">{s.duration}min</td><td className="px-3 py-2">{s.type}</td><td className="px-3 py-2 text-gray-500">{s.notes}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-gray-400 text-sm italic">No sessions logged yet</p>}
      </Card>
    </div>
  );
}

// ── Parent Section ────────────────────────────────────────────────────────────
function ParentSection({ child, updateChild, pendingQueue, setPendingQueue, save, showToast, loading, setLoading }) {
  const season = getCurrentSeason();

  const generateResource = async () => {
    setLoading(true);
    try {
      const allTargets = [...child.currentTargets.universal, ...child.currentTargets.targeted, ...child.currentTargets.specialist];
      const prompt = `You are a warm, expert UK SLT creating a family-friendly home activity resource.
CHILD: ${child.name}, ${child.yearGroup}. TARGETS: ${allTargets.join(", ")}. DIFFICULTIES: ${child.difficulties.join(", ")}. SEASON: ${season.name} (themes: ${season.themes.join(", ")}). LANGUAGE: ${child.language||"English"}.
EVIDENCE BASE: SLT Handbook 24 strategies (follow their lead, parallel talk, pausing, verbal routines, communicative temptations, copy and add words, reduce questions, be animated), Routine-based intervention (Crawford & Weber), People Play games, Dialogic reading PEER sequence, TMCR parent coaching.
STRUCTURE: 🌟 [Seasonal Activity Title] | [1-2 sentence warm intro] | What you'll need: [simple items] | How to play: [3-4 steps] | What to say: [3-4 example phrases using the strategies] | How this helps ${child.name}: [2-3 plain English sentences] | Try this too: [1 quick routine tip]
Seasonal ${season.name} theme. Joyful and celebratory. Under 320 words.`;
      const result = await callClaude(prompt, "You are a warm, expert UK SLT creating joyful, evidence-based family resources.");
      const newResource = {id:Date.now().toString(),childId:child.id,childName:child.name,yearGroup:child.yearGroup,content:result,season:season.name,generatedDate:new Date().toLocaleDateString(),status:"pending"};
      const newQ = [...pendingQueue, newResource];
      setPendingQueue(newQ); save(null,newQ);
      showToast("Resource generated — awaiting your approval ✓");
    } catch { showToast("AI unavailable","error"); }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card banner={<SectionBanner title={`${season.emoji} Generate ${season.name}-Themed Home Resource`} color="bg-amber-400" />}>
        <p className="text-sm text-gray-500 mb-3">AI will create a themed take-home activity based on {child.name}'s current targets. You'll review it before it reaches parents.</p>
        <button onClick={generateResource} disabled={loading} className="bg-amber-500 text-white px-4 py-2 rounded text-xs font-medium hover:bg-amber-600 disabled:opacity-50">
          {loading?"Generating…":`✨ Generate ${season.name} Resource`}
        </button>
        <p className="text-xs text-gray-400 mt-2">All resources require your approval before being shared.</p>
      </Card>

      {(child.approvedResources||[]).length>0 && (
        <Card banner={<SectionBanner title="Approved Resources" color="bg-gray-400" />}>
          {child.approvedResources.map((r,i)=>(
            <div key={i} className="border border-gray-100 rounded p-3 mb-2 bg-amber-50">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span className="font-medium text-gray-600">{r.season} Resource</span><span>{r.generatedDate}</span>
              </div>
              <p className="text-xs text-gray-600">{r.content.substring(0,200)}…</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Files Section ─────────────────────────────────────────────────────────────
function FilesSection({ child, updateChild, showToast }) {
  const [url, setUrl] = useState(""); const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const add = () => {
    if (!url) return;
    updateChild(child.id, c=>({videos:[...(c.videos||[]),{url,title:title||"Strategy video",desc,date:new Date().toLocaleDateString()}]}));
    setUrl(""); setTitle(""); setDesc("");
    showToast("Video added ✓");
  };
  return (
    <Card banner={<SectionBanner title="Strategy Video Library" color="bg-teal-500" />}>
      <p className="text-sm text-gray-500 mb-3">Add video links for parents and carers to watch at home.</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Video title" className="border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-teal-400" />
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="YouTube/Vimeo URL" className="border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-teal-400" />
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" className="border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-teal-400" />
      </div>
      <button onClick={add} className="bg-teal-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-teal-700 mb-3">Add Video</button>
      {(child.videos||[]).length>0 && (
        <div className="space-y-2">
          {child.videos.map((v,i)=>(
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded p-2">
              <span className="text-xl">🎬</span>
              <div className="flex-1"><p className="text-xs font-medium text-gray-700">{v.title}</p><p className="text-xs text-gray-400">{v.desc}</p></div>
              <a href={v.url} target="_blank" rel="noreferrer" className="text-indigo-500 text-xs hover:underline">Watch →</a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ children, stats, onOpen }) {
  const season = getCurrentSeason();
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Good morning 👋</h2>
        <p className="text-gray-500 text-sm">{season.emoji} {season.name} term · {stats.total} children on caseload</p>
      </div>
      <div className="flex gap-3">
        {[{l:"Total Caseload",v:stats.total,c:"bg-indigo-500"},{l:"Universal",v:stats.universal,c:"bg-emerald-500"},{l:"Targeted",v:stats.targeted,c:"bg-blue-500"},{l:"Specialist",v:stats.specialist,c:"bg-purple-500"},{l:"EHCP",v:stats.ehcp,c:"bg-amber-500"}].map(s=>(
          <div key={s.l} className={`${s.c} rounded-lg p-4 text-white flex-1`}>
            <p className="text-2xl font-bold">{s.v}</p>
            <p className="text-xs mt-0.5 opacity-90">{s.l}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">Recent children</h3>
        <div className="grid grid-cols-3 gap-3">
          {children.slice(0,6).map(c=>(
            <button key={c.id} onClick={()=>onOpen(c.id)}
              className="bg-white rounded-lg p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md text-left transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.yearGroup}{c.class?` · ${c.class}`:""}</p>
                </div>
                {c.ehcp && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">EHCP</span>}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {c.tiers.map(t=><span key={t} className={`text-xs px-1.5 py-0.5 rounded-full ${TIER_COLOURS[t].badge}`}>{t}</span>)}
              </div>
              <div className="space-y-1">
                {c.tiers.map(t=>(
                  <div key={t} className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${t==="universal"?"bg-emerald-400":t==="targeted"?"bg-blue-400":"bg-purple-400"}`} style={{width:`${c.progress[t]}%`}} />
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Caseload ──────────────────────────────────────────────────────────────────
function Caseload({ children, setChildren, save, onOpen, showToast }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = children.filter(c => {
    const m = String(c.name||"").toLowerCase().includes(search.toLowerCase());
    const f = filter==="all"||c.tiers.includes(filter);
    return m&&f;
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Caseload ({children.length})</h2>
      </div>
      <div className="flex gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 outline-none focus:border-indigo-400" />
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400">
          <option value="all">All tiers</option>
          <option value="universal">Universal</option>
          <option value="targeted">Targeted</option>
          <option value="specialist">Specialist</option>
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{["Name","Year","Class","Tiers","Lead","Progress","EHCP",""].map(h=>(
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c=>(
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 cursor-pointer" onClick={()=>onOpen(c.id)}>{c.name}</td>
                <td className="px-4 py-3 text-gray-500 cursor-pointer" onClick={()=>onOpen(c.id)}>{c.yearGroup}</td>
                <td className="px-4 py-3 text-gray-500 text-xs cursor-pointer" onClick={()=>onOpen(c.id)}>{c.class||"—"}</td>
                <td className="px-4 py-3 cursor-pointer" onClick={()=>onOpen(c.id)}>
                  <div className="flex flex-wrap gap-1">
                    {c.tiers.map(t=><span key={t} className={`text-xs px-1.5 py-0.5 rounded-full ${TIER_COLOURS[t].badge}`}>{t.slice(0,3).toUpperCase()}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 cursor-pointer" onClick={()=>onOpen(c.id)}>{c.lead||"—"}</td>
                <td className="px-4 py-3 cursor-pointer" onClick={()=>onOpen(c.id)}>
                  <div className="flex gap-1">
                    {c.tiers.map(t=>(
                      <div key={t} className="h-2 w-10 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${t==="universal"?"bg-emerald-400":t==="targeted"?"bg-blue-400":"bg-purple-400"}`} style={{width:`${c.progress[t]}%`}} />
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{c.ehcp&&<span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">EHCP</span>}</td>
                <td className="px-4 py-3">
                  <button onClick={()=>{if(window.confirm(`Remove ${c.name}?`)){const next=children.filter(x=>x.id!==c.id);setChildren(next);save(next,null);}}}
                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Delete">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <p className="text-center text-gray-400 py-8 text-sm">No children found</p>}
      </div>
    </div>
  );
}

// ── Approvals ─────────────────────────────────────────────────────────────────
function Approvals({ queue, setQueue, children, setChildren, save, showToast, loading, setLoading }) {
  const approve = (res) => {
    setChildren(prev => { const next = prev.map(c=>c.id===res.childId?{...c,approvedResources:[...(c.approvedResources||[]),{...res,status:"approved"}]}:c); save(next,null); return next; });
    const newQ = queue.filter(r=>r.id!==res.id); setQueue(newQ); save(null,newQ);
    showToast("Resource approved ✓");
  };
  const regenerate = async (res) => {
    setLoading(true);
    const child = children.find(c=>c.id===res.childId);
    if (!child) { setLoading(false); return; }
    const season = getCurrentSeason();
    try {
      const allTargets = [...child.currentTargets.universal,...child.currentTargets.targeted,...child.currentTargets.specialist];
      const prompt = `Regenerate a DIFFERENT parent-friendly home activity for ${child.name} in ${child.yearGroup}. Targets: ${allTargets.join(", ")}. Season: ${season.name}. Previous version rejected as not age-appropriate. Draw from SLT Handbook strategies: follow their lead, pausing, verbal routines, copy and add words, parallel talk. Use routine-based intervention (embed in daily routines). Structure: warm title, parent intro, what-you-need, 3-4 play steps, example phrases, "how this helps" in plain English, 1 routine tip. Under 320 words. Seasonal, joyful.`;
      const result = await callClaude(prompt, "You are a warm, expert UK SLT creating family-friendly seasonal resources.");
      const newQ = queue.map(r=>r.id===res.id?{...r,content:result,generatedDate:new Date().toLocaleDateString()}:r);
      setQueue(newQ); save(null,newQ);
      showToast("Resource regenerated — please review again");
    } catch { showToast("AI unavailable","error"); }
    setLoading(false);
  };
  const reject = (id) => { const newQ = queue.filter(r=>r.id!==id); setQueue(newQ); save(null,newQ); showToast("Resource removed"); };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Resource Approval Queue</h2>
      <p className="text-sm text-gray-500">Review AI-generated parent resources before they go live.</p>
      {queue.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400"><p className="text-4xl mb-2">✅</p><p>No resources awaiting approval</p></div>
      ) : queue.map(res=>(
        <Card key={res.id} banner={<SectionBanner title={`${res.childName} — ${res.season} Resource (${res.yearGroup} · ${res.generatedDate})`} color="bg-amber-400" />}>
          <div className="flex justify-end gap-2 mb-3">
            <button onClick={()=>approve(res)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-emerald-700">✓ Approve & Share</button>
            <button onClick={()=>regenerate(res)} disabled={loading} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">{loading?"…":"↻ Regenerate"}</button>
            <button onClick={()=>reject(res.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded text-xs font-medium hover:bg-red-100">✕ Discard</button>
          </div>
          <div className="bg-amber-50 rounded p-4 text-sm text-gray-700 whitespace-pre-wrap border border-amber-100">{res.content}</div>
        </Card>
      ))}
    </div>
  );
}

// ── Add Child Modal ───────────────────────────────────────────────────────────
function AddChildModal({ onAdd, onClose }) {
  const [form, setForm] = useState({name:"",yearGroup:"Year 1",dob:"",tiers:[],difficulties:[],ehcp:false,ehcpHours:0,notes:"",class:"",lead:"",senStatus:""});
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const toggleArr = (k,v) => setForm(p=>({...p,[k]:p[k].includes(v)?p[k].filter(x=>x!==v):[...p[k],v]}));
  const submit = () => {
    if (!form.name||form.tiers.length===0) return;
    onAdd({...form,id:"c"+Date.now(),currentTargets:{universal:[],targeted:[],specialist:[]},nextTargets:{targeted:[]},sessionsLogged:[],progress:{universal:0,targeted:0,specialist:0},approvedResources:[],pendingResources:[],videos:[],gender:"",ethnicity:"",language:"",reviewDate:"",additionalNeeds:"",extraFields:{}});
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-gray-800 text-lg mb-4">Add New Child</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Full name" value={form.name} onChange={e=>f("name",e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none col-span-2" />
            <select value={form.yearGroup} onChange={e=>f("yearGroup",e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none">
              {["Reception","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6"].map(y=><option key={y}>{y}</option>)}
            </select>
            <input type="date" value={form.dob} onChange={e=>f("dob",e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none" />
            <input placeholder="Class" value={form.class} onChange={e=>f("class",e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none" />
            <input placeholder="SLT Lead" value={form.lead} onChange={e=>f("lead",e.target.value)} className="border border-gray-200 rounded px-3 py-2 text-sm outline-none" />
          </div>
          <div><p className="text-xs font-medium text-gray-600 mb-1">Support tiers</p>
            <div className="flex gap-2">
              {["universal","targeted","specialist"].map(t=>(
                <button key={t} onClick={()=>toggleArr("tiers",t)} className={`text-xs px-3 py-1 rounded-full border font-medium ${form.tiers.includes(t)?TIER_COLOURS[t].badge+" border-transparent":"border-gray-200 text-gray-500"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div><p className="text-xs font-medium text-gray-600 mb-1">Difficulties</p>
            <div className="flex flex-wrap gap-1">
              {Object.keys(SLT_HIERARCHIES).map(d=>(
                <button key={d} onClick={()=>toggleArr("difficulties",d)} className={`text-xs px-2 py-0.5 rounded border ${form.difficulties.includes(d)?"bg-indigo-100 text-indigo-700 border-indigo-300":"border-gray-200 text-gray-500"}`}>
                  {SLT_HIERARCHIES[d].label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer"><input type="checkbox" checked={form.ehcp} onChange={e=>f("ehcp",e.target.checked)} />Has EHCP</label>
            {form.ehcp && <input type="number" value={form.ehcpHours} onChange={e=>f("ehcpHours",+e.target.value)} placeholder="Annual hours" className="border border-gray-200 rounded px-2 py-1 text-xs outline-none flex-1" />}
          </div>
          <textarea placeholder="Notes (optional)" value={form.notes} onChange={e=>f("notes",e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-14 resize-none outline-none" />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={submit} className="flex-1 bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700">Add Child</button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded text-sm font-medium hover:bg-gray-200">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, setChildren, save, showToast }) {
  const [status, setStatus] = useState(""); const [step, setStep] = useState("upload"); const [preview, setPreview] = useState(null); const [aiMapping, setAiMapping] = useState(null);

  const loadXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX); s.onerror = () => reject(new Error("Failed to load XLSX"));
    document.head.appendChild(s);
  });

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setStatus("Reading file…"); setStep("upload");
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
      if (!rows.length) { setStatus("No data found."); return; }
      const headers = Object.keys(rows[0]);
      const sampleRows = rows.slice(0,3);
      setStatus("AI is reading your column headers…");

      const mappingPrompt = `You are an SLT data assistant. Headers from a school caseload spreadsheet: ${JSON.stringify(headers)}. Sample data (first 3 rows): ${JSON.stringify(sampleRows)}.
Map each header to one of these fields (null if no match):
- name, yearGroup, dob, lead (named professional/therapist responsible e.g. "Priya"), interventionLevel (Universal/Targeted/Specialist), difficulties, targetedTargets, specialistTargets, universalTargets, ehcp, ehcpHours, notes, class, gender, ethnicity, language, senStatus, reviewDate, additionalNeeds
For unrecognised useful columns use "extra_COLUMNNAME".
Respond ONLY with a valid JSON object. No explanation, no markdown.`;

      const mappingResult = await callClaude(mappingPrompt, "You map spreadsheet columns to SLT data fields. Respond only with a valid JSON object, nothing else.");
      let mapping = {};
      try { const clean = mappingResult.replace(/```json|```/g,"").trim(); mapping = JSON.parse(clean); } catch { headers.forEach(h=>{mapping[h]=null;}); }
      setAiMapping(mapping); setStatus("Mapping complete…");

      const resolveTiers = (v) => {
        const s = String(v||"").toLowerCase().trim();
        if (s.includes("specialist")) return ["universal","targeted","specialist"];
        if (s.includes("targeted")) return ["universal","targeted"];
        return ["universal"];
      };

      const mapped = rows.map((r,i) => {
        const get = (field) => { const col = Object.entries(mapping).find(([,v])=>v===field)?.[0]; return col?r[col]:""; };
        const parseBool = (v) => ["yes","true","1","✓","✔","x","y"].includes(String(v).toLowerCase().trim());
        const parseList = (v) => String(v||"").split(/[,;\n|]/).map(s=>s.trim()).filter(Boolean);

        const leadValue = String(get("lead")||"").trim().toLowerCase();
        const isPriya = leadValue.includes("priya");
        const tiers = isPriya ? ["universal","targeted","specialist"] : resolveTiers(get("interventionLevel"));
        const targetedTargets = isPriya ? [] : parseList(get("targetedTargets"));
        const specialistTargets = isPriya ? parseList(get("targetedTargets")).concat(parseList(get("specialistTargets"))) : parseList(get("specialistTargets"));

        const extraFields = {};
        Object.entries(mapping).forEach(([col,field])=>{ if (field&&field.startsWith("extra_")&&r[col]) extraFields[field.replace("extra_","")]=r[col]; });

        return {
          id:"imp_"+i+"_"+Date.now(), name:get("name")||`Child ${i+1}`, yearGroup:get("yearGroup")||"Unknown",
          dob:get("dob")||"", tiers, difficulties:parseList(get("difficulties")).map(s=>s.toLowerCase()),
          currentTargets:{ universal:parseList(get("universalTargets")), targeted:targetedTargets, specialist:specialistTargets },
          nextTargets:{targeted:[]}, ehcp:parseBool(get("ehcp")), ehcpHours:+(get("ehcpHours")||0),
          sessionsLogged:[], notes:get("notes")||"", class:get("class")||"", lead:get("lead")||"",
          gender:get("gender")||"", ethnicity:get("ethnicity")||"", language:get("language")||"",
          senStatus:get("senStatus")||"", reviewDate:get("reviewDate")||"", additionalNeeds:get("additionalNeeds")||"",
          extraFields, progress:{universal:0,targeted:0,specialist:0}, approvedResources:[], pendingResources:[], videos:[]
        };
      });

      const isRealName = (name) => !/^child\s*\d+$/i.test(String(name||"").trim());
      const filtered = mapped.filter(c=>isRealName(c.name));
      setPreview({mapped:filtered,mapping,headers,sampleRows}); setStep("preview"); setStatus("");
    } catch (err) { console.error(err); setStatus("Something went wrong reading the file. Please try again."); }
  };

  const confirmImport = () => {
    if (!preview) return;
    setChildren(preview.mapped); save(preview.mapped,null);
    showToast(`✓ Imported ${preview.mapped.length} children successfully`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">Import Your Caseload</h3>
          <p className="text-xs text-gray-500 mt-1">Upload any Excel or CSV file — AI will read your column headers and map them automatically.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {step==="upload" && (
            <div>
              <div className="border-2 border-dashed border-indigo-200 rounded-xl p-10 text-center bg-indigo-50">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-gray-600 font-medium mb-1">Drop your file here</p>
                <p className="text-xs text-gray-400 mb-4">Supports .xlsx, .xls, .csv · Any column names</p>
                <label className="bg-indigo-600 text-white px-5 py-2.5 rounded text-sm font-medium cursor-pointer hover:bg-indigo-700">
                  Choose File <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                </label>
              </div>
              {status && <div className="mt-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded p-3"><span className="text-blue-500 text-lg">⟳</span><p className="text-sm text-blue-700">{status}</p></div>}
            </div>
          )}
          {step==="preview"&&preview && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
                <p className="text-emerald-800 font-semibold text-sm">✓ AI mapped your columns — {preview.mapped.length} children ready to import</p>
              </div>
              <div className="bg-white border border-gray-200 rounded p-4">
                <h4 className="font-semibold text-gray-700 text-sm mb-2">Column mapping</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(aiMapping||{}).filter(([,v])=>v).map(([col,field])=>(
                    <div key={col} className="flex items-center gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono truncate max-w-32">{col}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-indigo-600 font-medium">{field}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500">Preview (first 5)</div>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100">{["Name","Year","Tiers","Lead","EHCP"].map(h=><th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.mapped.slice(0,5).map((c,i)=>(
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-gray-500">{c.yearGroup}</td>
                        <td className="px-3 py-2"><div className="flex gap-1">{c.tiers.map(t=><span key={t} className={`px-1.5 py-0.5 rounded-full ${TIER_COLOURS[t].badge}`}>{t.slice(0,3).toUpperCase()}</span>)}</div></td>
                        <td className="px-3 py-2 text-gray-500">{c.lead||"—"}</td>
                        <td className="px-3 py-2">{c.ehcp?<span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">EHCP</span>:"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {step==="preview" && <button onClick={confirmImport} className="flex-1 bg-indigo-600 text-white py-2.5 rounded text-sm font-semibold hover:bg-indigo-700">✓ Import {preview?.mapped.length} Children</button>}
          {step==="preview" && <button onClick={()=>setStep("upload")} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded text-sm font-medium hover:bg-gray-200">← Re-upload</button>}
          <button onClick={onClose} className={`${step==="preview"?"":"flex-1"} bg-gray-100 text-gray-600 px-4 py-2.5 rounded text-sm font-medium hover:bg-gray-200`}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
