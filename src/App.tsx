import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, type User } from "firebase/auth";
import { Archive, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, ClipboardList, GraduationCap, Layers3, LogOut, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { auth, firebaseConfigured } from "./lib/firebase";
import { ensureWorkspace } from "./lib/workspace";
import { addLesson, addTerm, addWeek, archiveLesson, listLessons, listTerms, listWeeks, setLessonStatus, type LessonRow, type TermRow, type WeekRow } from "./lib/planning";
import type { UserProfile } from "./types/models";
import CurriculumBrowser from "./components/CurriculumBrowser";
import type { ReactNode } from "react";

type AppSession = { user: User; profile: UserProfile };
type View = "planning" | "curriculum" | "account";
type Modal = "term" | "week" | "lesson" | null;

export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { setSession(null); setLoading(false); return; }
      setLoading(true); setSetupError("");
      try { const profile = await ensureWorkspace(user); setSession({ user, profile }); }
      catch (error) { setSetupError(friendlyError(error)); setSession(null); }
      finally { setLoading(false); }
    });
  }, []);

  if (!firebaseConfigured) return <ConfigNotice />;
  if (loading) return <div className="loading"><span className="spinner" />Opening your workspace…</div>;
  if (!session) return <AuthPage setupError={setupError} />;
  return <WorkspaceApp session={session} />;
}

function WorkspaceApp({ session }: { session: AppSession }) {
  const [view, setView] = useState<View>("planning");
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [lessons, setLessons] = useState<Record<string, LessonRow[]>>({});
  const [expandedWeek, setExpandedWeek] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const workspaceId = session.profile.activeWorkspaceId;

  useEffect(() => {
    let live = true;
    setBusy(true);
    listTerms(workspaceId)
      .then((rows) => { if (live) { setTerms(rows); setSelectedTermId((prev) => rows.some((row) => row.id === prev) ? prev : rows[0]?.id || ""); setError(""); } })
      .catch((reason) => live && setError(friendlyError(reason)))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [workspaceId, revision]);

  useEffect(() => {
    let live = true;
    if (!selectedTermId) { setWeeks([]); setLessons({}); return; }
    listWeeks(workspaceId, selectedTermId)
      .then((rows) => { if (live) { setWeeks(rows); setExpandedWeek((prev) => rows.some((week) => week.id === prev) ? prev : rows[0]?.id || ""); } })
      .catch((reason) => live && setError(friendlyError(reason)));
    return () => { live = false; };
  }, [workspaceId, selectedTermId, revision]);

  useEffect(() => {
    let live = true;
    if (!selectedTermId || !weeks.length) { setLessons({}); return; }
    Promise.all(weeks.map(async (week) => [week.id, await listLessons(workspaceId, selectedTermId, week.id)] as const))
      .then((rows) => live && setLessons(Object.fromEntries(rows)))
      .catch((reason) => live && setError(friendlyError(reason)));
    return () => { live = false; };
  }, [workspaceId, selectedTermId, weeks, revision]);

  const selectedTerm = terms.find((term) => term.id === selectedTermId);
  const allLessons = useMemo(() => Object.values(lessons).flat(), [lessons]);
  const visibleLessonCount = allLessons.filter((lesson) => lesson.title.toLowerCase().includes(search.toLowerCase())).length;

  async function mutate(action: () => Promise<unknown>) {
    setSaving(true); setError("");
    try { await action(); setModal(null); setRevision((n) => n + 1); }
    catch (reason) { setError(friendlyError(reason)); }
    finally { setSaving(false); }
  }

  return <div className="layout">
    <aside className="sidebar">
      <a className="brand" href="#planning" onClick={(e) => { e.preventDefault(); setView("planning"); }}><span className="brand-icon"><GraduationCap size={20} /></span><span><b>Teaching Assistant</b><small>KL AZRUM · PLANNER</small></span></a>
      <button className="workspace-switch"><span className="avatar-sm">{initial(session.user.displayName)}</span><span><b>{session.user.displayName || "My workspace"}</b><small>Personal workspace</small></span><ChevronDown size={15} /></button>
      <div className="side-label">WORKSPACE</div>
      <nav className="nav-list">
        <NavButton active={view === "planning"} icon={<CalendarDays size={17} />} onClick={() => setView("planning")}>My planning</NavButton>
        <NavButton active={view === "curriculum"} icon={<BookOpen size={17} />} onClick={() => setView("curriculum")}>Curriculum</NavButton>
      </nav>
      <div className="sidebar-bottom">
        <div className="side-note"><span><Sparkles size={16} /></span><b>A little more clarity.</b><small>One week at a time.</small></div>
        <NavButton active={view === "account"} icon={<Settings2 size={17} />} onClick={() => setView("account")}>Account</NavButton>
        <div className="user-row"><span className="avatar-sm soft">{initial(session.user.displayName)}</span><span className="user-details"><b>{session.user.displayName || "Educator"}</b><small>{session.user.email}</small></span><button className="icon-only" title="Sign out" onClick={() => auth && void signOut(auth)}><LogOut size={15} /></button></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="crumb">Teaching Assistant <span>/</span> <b>{view === "planning" ? "My planning" : view === "curriculum" ? "Curriculum" : "Account"}</b></div><div className="topbar-right"><span className="connected"><i /> Workspace connected</span><button className="icon-only" title="Help"><CircleHelp size={18} /></button></div></header>
      {view === "planning" ? <section className="content">
        <div className="hero"><div><div className="overline"><i /> YOUR TEACHING SPACE</div><h1>Plan with a little more <em>purpose.</em></h1><p>A thoughtful place to shape the weeks ahead, one lesson at a time.</p></div><div className="hero-graphic" aria-hidden="true"><span className="orb"/><span className="plant-stem"/><i className="leaf leaf-one"/><i className="leaf leaf-two"/><i className="leaf leaf-three"/><span className="hill"/></div></div>
        <div className="stats"><Stat icon={<CalendarDays size={16}/>} label="CURRENT TERM" value={selectedTerm?.name || "No term yet"} detail={selectedTerm?.academicYear || "Start by creating a term"} tone="sand"/><Stat icon={<Layers3 size={16}/>} label="PLANNED WEEKS" value={String(weeks.length).padStart(2,"0")} detail="In this term" tone="sage"/><Stat icon={<BookOpen size={16}/>} label="LESSON PLANS" value={String(allLessons.length).padStart(2,"0")} detail="In this term" tone="blue"/></div>
        {error && <div className="alert">{error}<button onClick={() => setError("")}><X size={15}/></button></div>}
        <div className="section-title"><div><span className="overline">THE ROAD AHEAD</span><h2>Your term at a glance</h2><p>Give each week a shape. Add lessons as the ideas come.</p></div><div className="section-controls">{terms.length > 0 && <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)}>{terms.map((term) => <option key={term.id} value={term.id}>{term.name} · {term.academicYear}</option>)}</select>}<button className="button dark" onClick={() => setModal("term")}><Plus size={15}/> New term</button></div></div>
        {busy ? <div className="loading-panel"><span className="spinner"/> Loading your plans…</div> : !terms.length ? <Empty icon={<CalendarDays size={24}/>} eyebrow="A FRESH START" title="Your first term starts here." body="Set the dates and name, then build the weeks and lessons that make it yours." action="Create your first term" onClick={() => setModal("term")}/> : !weeks.length ? <Empty icon={<Layers3 size={24}/>} eyebrow="START WITH A WEEK" title="Your term is ready." body="Add its first week to begin planning lessons." action="Add first week" onClick={() => setModal("week")}/> : <div className="week-list">{weeks.map((week) => {
          const opened = expandedWeek === week.id;
          const rows = (lessons[week.id] || []).filter((lesson) => lesson.title.toLowerCase().includes(search.toLowerCase()));
          return <article className={`week-card ${opened ? "opened" : ""}`} key={week.id}>
            <button className="week-head" onClick={() => setExpandedWeek(opened ? "" : week.id)}><span className="week-no">{String(week.number).padStart(2,"0")}</span><span className="week-heading"><b>{week.title || `Week ${week.number}`}</b><small>{dateRange(week.startDate, week.endDate)}</small></span><span className="week-count"><BookOpen size={13}/> {(lessons[week.id] || []).length} lessons</span><ChevronDown className={opened ? "turn" : ""} size={17}/></button>
            {opened && <div className="week-content">{rows.length ? rows.map((lesson, index) => <LessonItem key={lesson.id} lesson={lesson} index={index} onStatus={(status) => mutate(() => setLessonStatus(workspaceId, selectedTermId, week.id, lesson.id, status))} onArchive={() => { if (window.confirm(`Archive “${lesson.title}”?`)) void mutate(() => archiveLesson(workspaceId, selectedTermId, week.id, lesson.id)); }}/>) : <p className="week-empty">{search ? "No lessons match that search." : "Nothing planned here yet. Start with one small idea."}</p>}<button className="add-lesson" onClick={() => setModal("lesson")}><span><Plus size={14}/></span> Add a lesson to this week</button></div>}
          </article>;
        })}<button className="add-week" onClick={() => setModal("week")}><span className="add-circle"><Plus size={16}/></span><span><b>Add another week</b><small>Keep your plan moving forward</small></span><ArrowRight size={16}/></button></div>}
        {!!terms.length && <div className="plan-foot"><span><ClipboardList size={14}/> {visibleLessonCount} lessons match this view</span><label className="search-box"><Search size={14}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a lesson"/></label></div>}
      </section> : view === "curriculum" ? <CurriculumView workspaceId={workspaceId}/> : <AccountView session={session}/>}
      <footer className="footer"><span>TEACHING ASSISTANT <i>·</i> A CLEARER WAY TO PLAN</span><span>Made for the work that matters.</span></footer>
    </main>
    {modal && <Modal title={modal === "term" ? "A new term, a fresh start." : modal === "week" ? "Add a week to the plan." : "Start with a lesson idea."} subtitle={modal === "term" ? "SET THE SEASON" : modal === "week" ? "SHAPE THE TIMELINE" : "MAKE IT CONCRETE"} onClose={() => setModal(null)}>
      {modal === "term" ? <TermForm busy={saving} onCancel={() => setModal(null)} onSave={(values) => mutate(() => addTerm(workspaceId, values))}/> : modal === "week" ? <WeekForm busy={saving} next={weeks.length + 1} onCancel={() => setModal(null)} onSave={(values) => mutate(() => addWeek(workspaceId, selectedTermId, values))}/> : <LessonForm busy={saving} onCancel={() => setModal(null)} onSave={(values) => mutate(() => addLesson(workspaceId, selectedTermId, expandedWeek, values))}/>}
    </Modal>}
  </div>;
}

function AuthPage({ setupError }: { setupError: string }) {
  const [signup, setSignup] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(setupError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      if (!auth) throw new Error("Firebase is not configured.");
      if (signup) { const credential = await createUserWithEmailAndPassword(auth, String(data.get("email")), String(data.get("password"))); await updateProfile(credential.user, { displayName: String(data.get("name")).trim() }); }
      else await signInWithEmailAndPassword(auth, String(data.get("email")), String(data.get("password")));
    } catch (reason) { setError(friendlyError(reason)); } finally { setBusy(false); }
  }
  return <div className="auth-layout"><section className="auth-art-panel"><a className="brand inverse"><span className="brand-icon"><GraduationCap size={20}/></span><b>Teaching Assistant</b></a><div className="auth-message"><span className="quote">“</span><h1>Good teaching begins with a little <em>room to think.</em></h1><p>Make a plan. Find your rhythm. Be ready for the moments that matter.</p><small>— A CALMER WAY TO PREPARE</small></div><div className="auth-lines"/></section><section className="auth-form-panel"><div className="auth-form-inner"><span className="overline"><i/> WELCOME TO YOUR TEACHING SPACE</span><h2>{signup ? "Make this space yours." : "Good to have you back."}</h2><p>{signup ? "Create an account. We’ll set up your personal workspace automatically." : "Sign in to pick up where your planning left off."}</p>{error && <div className="form-error">{error}</div>}<form onSubmit={submit} className="form">{signup && <label>Your name<input name="name" autoComplete="name" required placeholder="Ama Mensah"/></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@school.edu"/></label><label>Password<input name="password" type="password" minLength={6} autoComplete={signup ? "new-password" : "current-password"} required placeholder="At least 6 characters"/></label><button className="button dark full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}<ArrowRight size={16}/></button></form><div className="auth-switch">{signup ? "Already have an account?" : "New to Teaching Assistant?"} <button onClick={() => {setSignup(!signup);setError("");}}>{signup ? "Sign in" : "Create an account"}</button></div><div className="privacy"><Check size={14}/> Your plans are private to your workspace.</div></div></section></div>;
}

function TermForm({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (value: { name: string; academicYear: string; startDate: string | null; endDate: string | null }) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ name: String(data.get("name")).trim(), academicYear: String(data.get("year")).trim(), startDate: String(data.get("start") || "") || null, endDate: String(data.get("end") || "") || null }); }
  return <form className="modal-form" onSubmit={submit}><p>Set the name and academic year. Dates can be filled in later.</p><label>Term name<input name="name" required autoFocus placeholder="First Term"/></label><label>Academic year<input name="year" required placeholder="2026/2027"/></label><div className="two-cols"><label>Starts<input type="date" name="start"/></label><label>Ends<input type="date" name="end"/></label></div><ModalActions busy={busy} onCancel={onCancel} label="Create term"/></form>;
}
function WeekForm({ busy, next, onCancel, onSave }: { busy: boolean; next: number; onCancel: () => void; onSave: (value: { number: number; title: string; startDate: string | null; endDate: string | null; sortOrder: number }) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const number = Number(data.get("number")); onSave({ number, title: String(data.get("title")).trim(), startDate: String(data.get("start") || "") || null, endDate: String(data.get("end") || "") || null, sortOrder: number }); }
  return <form className="modal-form" onSubmit={submit}><p>Give this week a number. Add dates now or adjust the timeline later.</p><div className="two-cols"><label>Week number<input name="number" type="number" min="1" required defaultValue={next}/></label><label>Display name<input name="title" placeholder={`Week ${next}`}/></label></div><div className="two-cols"><label>Starts<input type="date" name="start"/></label><label>Ends<input type="date" name="end"/></label></div><ModalActions busy={busy} onCancel={onCancel} label="Add week"/></form>;
}
function LessonForm({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (value: { title: string; summary: string }) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ title: String(data.get("title")).trim(), summary: String(data.get("summary")).trim() }); }
  return <form className="modal-form" onSubmit={submit}><p>Start with a title. You can add curriculum links, notes, and materials afterward.</p><label>Lesson title<input name="title" required autoFocus placeholder="Fractions in everyday life"/></label><label>Short summary<textarea name="summary" rows={3} placeholder="What will learners explore?"/></label><ModalActions busy={busy} onCancel={onCancel} label="Save as draft"/></form>;
}
function ModalActions({ busy, onCancel, label }: { busy: boolean; onCancel: () => void; label: string }) { return <div className="modal-actions"><button type="button" className="button outlined" onClick={onCancel}>Cancel</button><button className="button dark" disabled={busy}>{busy ? "Saving…" : label}<ArrowRight size={15}/></button></div>; }
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) { return <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal"><button className="close" onClick={onClose} aria-label="Close"><X size={18}/></button><span className="overline"><i/> {subtitle}</span><h2>{title}</h2>{children}</section></div>; }

function LessonItem({ lesson, index, onStatus, onArchive }: { lesson: LessonRow; index: number; onStatus: (status: LessonRow["status"]) => void; onArchive: () => void }) {
  return <div className="lesson-row"><span className={`lesson-index idx-${index%4}`}>{String(index+1).padStart(2,"0")}</span><div className="lesson-copy"><b>{lesson.title}</b><small>{lesson.summary || "Add a summary when you are ready"}</small></div><select className={`status status-${lesson.status}`} value={lesson.status} onChange={(e) => onStatus(e.target.value as LessonRow["status"])} aria-label={`Status of ${lesson.title}`}><option value="draft">Draft</option><option value="ready">Ready</option><option value="taught">Taught</option></select><button className="icon-only archive-button" title="Archive lesson" onClick={onArchive}><Archive size={15}/></button></div>;
}

function CurriculumView({ workspaceId }: { workspaceId: string }) { return <CurriculumBrowser workspaceId={workspaceId} />; }
function AccountView({ session }: { session: AppSession }) { return <section className="content secondary"><div className="overline"><i/> YOUR ACCOUNT</div><h1>Your teaching <em>space.</em></h1><p className="intro">The account and workspace that keep your plans together.</p><div className="account-card"><span className="avatar-lg">{initial(session.user.displayName)}</span><div><b>{session.user.displayName || "Educator"}</b><small>{session.user.email}</small></div><span className="owner-tag"><Check size={13}/> Owner</span></div><button className="button outlined" onClick={() => auth && void signOut(auth)}><LogOut size={15}/> Sign out</button></section>; }

function ConfigNotice() { return <div className="center-screen"><div className="notice-card"><span className="brand-icon"><GraduationCap size={20}/></span><span className="overline"><i/> ONE QUICK SETUP</span><h1>Connect your Firebase project.</h1><p>The app is ready to run. Copy <code>.env.example</code> to <code>.env</code> and fill in the six Firebase web app values from your Firebase project.</p><pre>cp .env.example .env</pre></div></div>; }
function NavButton({ active, icon, children, onClick }: { active: boolean; icon: ReactNode; children: ReactNode; onClick: () => void }) { return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}{children}{active && <i/>}</button>; }
function Stat({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) { return <article className={`stat ${tone}`}><div className="stat-top"><span>{icon}</span><b>{label}</b></div><strong>{value}</strong><small>{detail}</small></article>; }
function Empty({ icon, eyebrow, title, body, action, onClick }: { icon: ReactNode; eyebrow: string; title: string; body: string; action: string; onClick: () => void }) { return <div className="empty"><span className="empty-icon">{icon}</span><span className="overline">{eyebrow}</span><h3>{title}</h3><p>{body}</p><button className="button dark" onClick={onClick}><Plus size={15}/>{action}</button></div>; }
function initial(name?: string | null) { return name?.trim()?.[0]?.toUpperCase() || "E"; }
function dateRange(start: string | null, end: string | null) { const fmt = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)); if (start && end) return `${fmt(start)} – ${fmt(end)}`; if (start) return `From ${fmt(start)}`; if (end) return `Until ${fmt(end)}`; return "Dates to be decided"; }
function friendlyError(reason: unknown) {
  const error = reason as { message?: string; code?: string };
  if (error?.code === "auth/email-already-in-use") return "An account already uses this email. Sign in instead.";
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(error?.code || "")) return "That email and password did not match.";
  if (error?.code === "auth/weak-password") return "Choose a password with at least six characters.";
  if (error?.code === "permission-denied") return "Firebase denied this action. Deploy the Firestore rules and check Authentication settings.";
  if (error?.code === "failed-precondition") return "A Firestore index is needed. Deploy firebase/firestore.indexes.json.";
  return error?.message || "Something went wrong. Please try again.";
}
