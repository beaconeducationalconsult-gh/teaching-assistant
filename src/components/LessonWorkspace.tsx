import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, Save, Trash2 } from "lucide-react";
import { addLessonIndicatorLink, addLessonResource, addTeachingStep, listLessonIndicatorLinks, listLessonResources, listTeachingSteps, removeLessonIndicatorLink, removeLessonResource, removeTeachingStep, updateLesson, type LessonIndicatorLinkRow, type LessonResourceRow, type LessonRow, type TeachingStepRow } from "../lib/planning";
import CurriculumPicker, { type CurriculumIndicatorChoice } from "./CurriculumPicker";

type Props = { workspaceId: string; termId: string; weekId: string; lesson: LessonRow; onBack: () => void; onSaved: () => void; };

export default function LessonWorkspace({ workspaceId, termId, weekId, lesson, onBack, onSaved }: Props) {
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [objectives, setObjectives] = useState(lesson.objectives);
  const [plannedDate, setPlannedDate] = useState(lesson.plannedDate || "");
  const [duration, setDuration] = useState(lesson.durationMinutes ? String(lesson.durationMinutes) : "");
  const [status, setStatus] = useState(lesson.status);
  const [links, setLinks] = useState<LessonIndicatorLinkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resources, setResources] = useState<LessonResourceRow[]>([]);
  const [steps, setSteps] = useState<TeachingStepRow[]>([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceNotes, setResourceNotes] = useState("");
  const [stepTitle, setStepTitle] = useState("");
  const [stepPhase, setStepPhase] = useState<TeachingStepRow["phase"]>("opening");
  const [stepMinutes, setStepMinutes] = useState("");
  const [stepInstructions, setStepInstructions] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([listLessonResources(workspaceId, termId, weekId, lesson.id), listTeachingSteps(workspaceId, termId, weekId, lesson.id)]).then(([nextResources, nextSteps]) => {
      if (live) { setResources(nextResources); setSteps(nextSteps); }
    }).catch((reason) => live && setError(reason instanceof Error ? reason.message : "Could not load lesson materials."));
    return () => { live = false; };
  }, [workspaceId, termId, weekId, lesson.id]);

  useEffect(() => {
    let live = true;
    listLessonIndicatorLinks(workspaceId, termId, weekId, lesson.id).then((rows) => live && setLinks(rows)).catch((reason) => live && setError(reason instanceof Error ? reason.message : "Could not load curriculum links."));
    return () => { live = false; };
  }, [workspaceId, termId, weekId, lesson.id]);

  async function save(event?: FormEvent) {
    event?.preventDefault(); setSaving(true); setError("");
    try {
      await updateLesson(workspaceId, termId, weekId, lesson.id, { title: title.trim(), summary: summary.trim(), objectives: objectives.trim(), plannedDate: plannedDate || null, durationMinutes: duration ? Number(duration) : null, status });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this lesson."); }
    finally { setSaving(false); }
  }

  async function addLink(choice: CurriculumIndicatorChoice) {
    try {
      const sortOrder = Date.now();
      const ref = await addLessonIndicatorLink(workspaceId, termId, weekId, lesson.id, { ...choice, sortOrder });
      setLinks((rows) => [...rows, { id: ref.id, ...choice, sortOrder, archivedAt: null }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not link the indicator."); }
  }

  async function addResource() {
    if (!resourceTitle.trim() || (!resourceUrl.trim() && !resourceNotes.trim())) return;
    try {
      const sortOrder = Date.now();
      const values = { title: resourceTitle.trim(), type: resourceUrl.trim() ? "link" as const : "note" as const, url: resourceUrl.trim(), storagePath: "", notes: resourceNotes.trim(), sortOrder };
      const ref = await addLessonResource(workspaceId, termId, weekId, lesson.id, values);
      setResources((rows) => [...rows, { id: ref.id, ...values, archivedAt: null }]);
      setResourceTitle(""); setResourceUrl(""); setResourceNotes("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add the resource."); }
  }

  async function removeResource(id: string) {
    try { await removeLessonResource(workspaceId, termId, weekId, lesson.id, id); setResources((rows) => rows.filter((row) => row.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the resource."); }
  }

  async function addStep() {
    if (!stepTitle.trim() || !stepInstructions.trim()) return;
    try {
      const sortOrder = Date.now();
      const values = { title: stepTitle.trim(), phase: stepPhase, instructions: stepInstructions.trim(), minutes: stepMinutes ? Number(stepMinutes) : null, sortOrder };
      const ref = await addTeachingStep(workspaceId, termId, weekId, lesson.id, values);
      setSteps((rows) => [...rows, { id: ref.id, ...values, archivedAt: null }]);
      setStepTitle(""); setStepMinutes(""); setStepInstructions("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add the teaching step."); }
  }

  async function removeStep(id: string) {
    try { await removeTeachingStep(workspaceId, termId, weekId, lesson.id, id); setSteps((rows) => rows.filter((row) => row.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the teaching step."); }
  }

  async function removeLink(id: string) {
    try { await removeLessonIndicatorLink(workspaceId, termId, weekId, lesson.id, id); setLinks((rows) => rows.filter((row) => row.id !== id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the curriculum link."); }
  }

  return <section className="content secondary lesson-workspace">
    <button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to planning</button>
    <div className="lesson-workspace-head"><div><div className="overline"><i/> LESSON WORKSPACE</div><h1>Shape the <em>learning.</em></h1><p className="intro">Turn a plan into something you can teach, revisit, and improve.</p></div><button className="button dark" onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? "Saving…" : "Save lesson"}</button></div>
    {error && <div className="alert">{error}</div>}
    <form className="lesson-editor-grid" onSubmit={save}>
      <div className="editor-main">
        <label className="editor-field"><span>LESSON TITLE</span><input value={title} onChange={(e) => setTitle(e.target.value)} required/></label>
        <label className="editor-field"><span>LESSON SUMMARY</span><textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What should learners understand or experience?"/></label>
        <label className="editor-field"><span>LEARNING OBJECTIVES</span><textarea rows={7} value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="By the end of the lesson, learners should be able to…"/></label>
        <section className="editor-card"><div className="editor-card-head"><div><span className="overline">CURRICULUM ALIGNMENT</span><h2>Learning indicators</h2></div><span className="count-pill">{links.length}</span></div>
          {links.map((link) => <div className="linked-indicator" key={link.id}><div><b>{link.fullCode}</b><p>{link.subjectName || "Curriculum indicator"}</p></div><button type="button" className="icon-only" title="Remove indicator" onClick={() => void removeLink(link.id)}><Trash2 size={14}/></button></div>)}
          <button type="button" className="button outlined picker-trigger" onClick={() => setPickerOpen(true)}><span>+</span> Browse curriculum</button>
          {pickerOpen && <div className="picker-panel"><CurriculumPicker workspaceId={workspaceId} selectedIds={links.map((link) => link.indicatorId)} onSelect={(choice) => { void addLink(choice); }} onClose={() => setPickerOpen(false)} /></div>}
          <small className="helper">Browse the hierarchy or search by indicator code and description. Added indicators are stored against their exact curriculum record.</small>
        </section>
      </div>
      <aside className="editor-side">
        <section className="editor-card"><span className="overline">TEACHING DETAILS</span><div className="detail-field"><CalendarDays size={15}/><label>Date<input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)}/></label></div><div className="detail-field"><Clock3 size={15}/><label>Duration (minutes)<input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="50"/></label></div><div className="detail-field"><Check size={15}/><label>Status<select value={status} onChange={(e) => setStatus(e.target.value as LessonRow["status"])}><option value="draft">Draft</option><option value="ready">Ready</option><option value="taught">Taught</option></select></label></div></section>
        <section className="editor-card">
          <div className="editor-card-head"><div><span className="overline">TEACHING FLOW</span><h2>Lesson sequence</h2></div><span className="count-pill">{steps.length}</span></div>
          <div className="step-list">{steps.map((step, index) => <div className="teaching-step" key={step.id}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><div><div className="step-meta"><b>{step.title}</b><small>{step.phase}{step.minutes ? " · " + step.minutes + " min" : ""}</small></div><p>{step.instructions}</p></div><button type="button" className="icon-only" title="Remove step" onClick={() => void removeStep(step.id)}><Trash2 size={14}/></button></div>)}</div>
          <div className="step-form"><div className="form-row"><input value={stepTitle} onChange={(e) => setStepTitle(e.target.value)} placeholder="Activity title, e.g. Starter question"/><select value={stepPhase} onChange={(e) => setStepPhase(e.target.value as TeachingStepRow["phase"])}><option value="opening">Opening</option><option value="explore">Explore</option><option value="explain">Explain</option><option value="practice">Practice</option><option value="assessment">Assessment</option><option value="closing">Closing</option></select><input type="number" min="1" value={stepMinutes} onChange={(e) => setStepMinutes(e.target.value)} placeholder="Min"/></div><textarea rows={3} value={stepInstructions} onChange={(e) => setStepInstructions(e.target.value)} placeholder="What will the teacher and learners do? Include prompts, grouping, materials, or expected evidence."/><button type="button" className="button outlined" onClick={() => void addStep()}>+ Add teaching step</button></div>
        </section>
        <section className="editor-card">
          <div className="editor-card-head"><div><span className="overline">MATERIALS</span><h2>Resources</h2></div><span className="count-pill">{resources.length}</span></div>
          <div className="resource-list">{resources.map((resource) => <div className="resource-item" key={resource.id}><div><b>{resource.title}</b><small>{resource.type === "link" ? resource.url : resource.notes}</small></div><button type="button" className="icon-only" title="Remove resource" onClick={() => void removeResource(resource.id)}><Trash2 size={14}/></button></div>)}</div>
          <div className="resource-form"><input value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} placeholder="Resource title"/><input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://… (optional for notes)"/><textarea rows={2} value={resourceNotes} onChange={(e) => setResourceNotes(e.target.value)} placeholder="Notes or how this resource will be used"/><button type="button" className="button outlined" onClick={() => void addResource()}>+ Add resource</button></div>
        </section>
        <section className="editor-card next-card"><span className="overline">COMING NEXT</span><h3>Assessment builder</h3><p>Once the teaching flow is in place, assessment items can be tied directly to the lesson objectives and curriculum indicators.</p><span className="feature-row"><Check size={14}/> Formative checks</span><span className="feature-row"><Check size={14}/> Marking guidance</span></section>
      </aside>
    </form>
  </section>;
}
