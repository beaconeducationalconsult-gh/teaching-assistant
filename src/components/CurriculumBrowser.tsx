import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { listContentStandards, listFrameworks, listIndicators, listLevels, listStrands, listSubjects, listSubStrands } from "../lib/curriculum";
import type { ContentStandard, CurriculumFramework, CurriculumLevel, Indicator, Strand, Subject, SubStrand } from "../types/models";

type Props = { workspaceId: string };

export default function CurriculumBrowser({ workspaceId }: Props) {
  const [frameworks, setFrameworks] = useState<CurriculumFramework[]>([]);
  const [levels, setLevels] = useState<CurriculumLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [strands, setStrands] = useState<Strand[]>([]);
  const [subStrands, setSubStrands] = useState<SubStrand[]>([]);
  const [standards, setStandards] = useState<ContentStandard[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [frameworkId, setFrameworkId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [strandId, setStrandId] = useState("");
  const [subStrandId, setSubStrandId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    listFrameworks(workspaceId).then((rows) => {
      if (live) { setFrameworks(rows); setFrameworkId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [workspaceId]);

  useEffect(() => {
    if (!frameworkId) return;
    let live = true;
    Promise.all([listLevels(workspaceId, frameworkId), listSubjects(workspaceId, frameworkId)]).then(([nextLevels, nextSubjects]) => {
      if (live) { setLevels(nextLevels); setSubjects(nextSubjects); setLevelId(nextLevels[0]?.id || ""); setSubjectId(nextSubjects[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId) return;
    let live = true;
    listStrands(workspaceId, frameworkId, levelId, subjectId).then((rows) => {
      if (live) { setStrands(rows); setStrandId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId || !strandId) return;
    let live = true;
    listSubStrands(workspaceId, frameworkId, levelId, subjectId, strandId).then((rows) => {
      if (live) { setSubStrands(rows); setSubStrandId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId, strandId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId || !strandId || !subStrandId) return;
    let live = true;
    listContentStandards(workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId).then((rows) => {
      if (live) { setStandards(rows); setStandardId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId || !strandId || !subStrandId || !standardId) return;
    let live = true;
    listIndicators(workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId, standardId).then((rows) => {
      if (live) setIndicators(rows);
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId, standardId]);

  const visible = indicators.filter((item) => `${item.code} ${item.fullCode} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <section className="content secondary"><div className="loading-panel"><LoaderCircle className="spinner" size={16}/> Loading curriculum…</div></section>;

  return <section className="content secondary curriculum-browser">
    <div className="overline"><i/> BEACON CURRICULUM LIBRARY</div>
    <h1>Teach from the <em>right standard.</em></h1>
    <p className="intro">Move from framework to learning indicator without leaving your planning space.</p>
    {error && <div className="alert">{error}</div>}
    {!frameworks.length ? <div className="empty"><span className="empty-icon"><BookOpen size={24}/></span><span className="overline">CURRICULUM NOT IMPORTED</span><h3>Your library is ready for its first framework.</h3><p>Once Beacon's audited curriculum records are imported into this workspace, teachers will be able to browse them here.</p></div> :
      <div className="curriculum-shell">
        <div className="curriculum-toolbar">
          <Select label="Framework" value={frameworkId} onChange={setFrameworkId} options={frameworks.map((x) => [x.id, `${x.name} · ${x.version}`])}/>
          <Select label="Level" value={levelId} onChange={setLevelId} options={levels.map((x) => [x.id, x.name])}/>
          <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjects.map((x) => [x.id, x.name])}/>
        </div>
        <div className="curriculum-path">
          <PathPill label="Strand" value={strands.find((x) => x.id === strandId)?.name}/>
          <PathPill label="Sub-strand" value={subStrands.find((x) => x.id === subStrandId)?.name}/>
          <PathPill label="Content standard" value={standards.find((x) => x.id === standardId)?.code}/>
        </div>
        <div className="indicator-header">
          <div><span className="overline"><i/> LEARNING INDICATORS</span><h2>{standards.find((x) => x.id === standardId)?.description || "Select a content standard"}</h2></div>
          <label className="search-box"><Search size={14}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search indicators"/></label>
        </div>
        <div className="indicator-list">
          {visible.map((item) => <article className="indicator-card" key={item.id}><div className="indicator-code">{item.fullCode || item.code}</div><div className="indicator-copy"><b>{item.description}</b><small>Learning indicator</small></div><ChevronRight size={16}/></article>)}
          {!visible.length && <div className="week-empty">No indicators match this search.</div>}
        </div>
      </div>}
  </section>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="curriculum-select"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}
function PathPill({ label, value }: { label: string; value?: string }) {
  return <div className="path-pill"><small>{label}</small><b>{value || "Not selected"}</b></div>;
}
function message(reason: unknown) {
  const error = reason as { message?: string };
  return error?.message || "We could not load the curriculum. Please try again.";
}
