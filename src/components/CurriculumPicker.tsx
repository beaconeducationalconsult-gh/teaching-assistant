import { useEffect, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { listContentStandards, listFrameworks, listIndicators, listLevels, listStrands, listSubjects, listSubStrands } from "../lib/curriculum";
import type { ContentStandard, CurriculumFramework, CurriculumLevel, Indicator, Strand, Subject, SubStrand } from "../types/models";

export type CurriculumIndicatorChoice = {
  indicatorId: string;
  fullCode: string;
  subjectId: string;
  subjectName: string;
  levelId: string;
};

type Props = {
  workspaceId: string;
  selectedIds: string[];
  onSelect: (indicator: CurriculumIndicatorChoice) => void;
  onClose: () => void;
};

export default function CurriculumPicker({ workspaceId, selectedIds, onSelect, onClose }: Props) {
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
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    listFrameworks(workspaceId).then((rows) => {
      if (live) { setFrameworks(rows); setFrameworkId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [workspaceId]);

  useEffect(() => {
    if (!frameworkId) return;
    let live = true;
    setLevels([]); setSubjects([]); setStrands([]); setSubStrands([]); setStandards([]); setIndicators([]);
    Promise.all([listLevels(workspaceId, frameworkId), listSubjects(workspaceId, frameworkId)]).then(([nextLevels, nextSubjects]) => {
      if (live) { setLevels(nextLevels); setSubjects(nextSubjects); setLevelId(nextLevels[0]?.id || ""); setSubjectId(nextSubjects[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId) return;
    let live = true;
    setStrands([]); setSubStrands([]); setStandards([]); setIndicators([]);
    listStrands(workspaceId, frameworkId, levelId, subjectId).then((rows) => {
      if (live) { setStrands(rows); setStrandId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId || !strandId) return;
    let live = true;
    setSubStrands([]); setStandards([]); setIndicators([]);
    listSubStrands(workspaceId, frameworkId, levelId, subjectId, strandId).then((rows) => {
      if (live) { setSubStrands(rows); setSubStrandId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId, strandId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId || !strandId || !subStrandId) return;
    let live = true;
    setStandards([]); setIndicators([]);
    listContentStandards(workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId).then((rows) => {
      if (live) { setStandards(rows); setStandardId(rows[0]?.id || ""); }
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId]);

  useEffect(() => {
    if (!frameworkId || !levelId || !subjectId || !strandId || !subStrandId || !standardId) return;
    let live = true;
    setLoadingIndicators(true);
    listIndicators(workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId, standardId).then((rows) => {
      if (live) setIndicators(rows);
    }).catch((reason) => live && setError(message(reason))).finally(() => live && setLoadingIndicators(false));
    return () => { live = false; };
  }, [workspaceId, frameworkId, levelId, subjectId, strandId, subStrandId, standardId]);

  const visible = indicators.filter((item) => {
    const needle = search.trim().toLowerCase();
    return !needle || (item.code + " " + item.fullCode + " " + item.description).toLowerCase().includes(needle);
  });

  function choose(item: Indicator) {
    if (selectedIds.includes(item.id)) return;
    onSelect({ indicatorId: item.id, fullCode: item.fullCode || item.code, description: item.description, subjectId, subjectName: subjects.find((x) => x.id === subjectId)?.name || "", levelId });
  }

  if (loading) return <div className="picker-loading"><LoaderCircle className="spinner" size={16}/> Loading curriculum…</div>;

  return <div className="curriculum-picker">
    <div className="picker-head">
      <div><span className="overline"><i/> CURRICULUM LIBRARY</span><h3>Choose a learning indicator</h3><p>Browse the same curriculum hierarchy used by the library. Add the exact indicator to this lesson.</p></div>
      <button type="button" className="icon-only" onClick={onClose} aria-label="Close curriculum picker"><X size={17}/></button>
    </div>
    {error && <div className="alert">{error}</div>}
    {!frameworks.length ? <div className="picker-empty">No curriculum framework is available in this workspace yet.</div> :
      <>
        <div className="picker-selects">
          <Select label="Framework" value={frameworkId} onChange={setFrameworkId} options={frameworks.map((x) => [x.id, x.name + " · " + x.version])}/>
          <Select label="Level" value={levelId} onChange={setLevelId} options={levels.map((x) => [x.id, x.name])}/>
          <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjects.map((x) => [x.id, x.name])}/>
          <Select label="Strand" value={strandId} onChange={setStrandId} options={strands.map((x) => [x.id, x.code + " · " + x.name])}/>
          <Select label="Sub-strand" value={subStrandId} onChange={setSubStrandId} options={subStrands.map((x) => [x.id, x.code + " · " + x.name])}/>
          <Select label="Content standard" value={standardId} onChange={setStandardId} options={standards.map((x) => [x.id, x.code + " · " + x.description])}/>
        </div>
        <div className="picker-results-head">
          <div><span className="overline">LEARNING INDICATORS</span><b>{visible.length} available</b></div>
          <label className="search-box"><Search size={14}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or description"/></label>
        </div>
        {loadingIndicators ? <div className="picker-loading"><LoaderCircle className="spinner" size={16}/> Loading indicators…</div> :
          <div className="picker-results">
            {visible.map((item) => {
              const selected = selectedIds.includes(item.id);
              return <button type="button" className={"picker-indicator" + (selected ? " selected" : "")} key={item.id} onClick={() => choose(item)} disabled={selected}>
                <span className="picker-code">{item.fullCode || item.code}</span>
                <span className="picker-description">{item.description}</span>
                <span className="picker-action">{selected ? <><Check size={14}/> Added</> : <><PlusIcon/> Add</>}</span>
              </button>;
            })}
            {!visible.length && <div className="picker-empty">No indicators match this search.</div>}
          </div>
        }
      </>
    }
  </div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="curriculum-select"><span>{label}</span><div className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><ChevronDown size={13}/></div></label>;
}
function PlusIcon() { return <span className="plus-mark">+</span>; }
function message(reason: unknown) {
  const error = reason as { message?: string };
  return error?.message || "We could not load the curriculum. Please try again.";
}
