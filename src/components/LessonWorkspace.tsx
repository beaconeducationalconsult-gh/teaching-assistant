import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, Clock3, Download, Printer, Save, Trash2, Upload } from "lucide-react";
import { addLessonFile, addLessonIndicatorLink, addLessonResource, addTeachingStep, deleteLessonFile, downloadLessonFile, listLessonIndicatorLinks, listLessonResources, listTeachingSteps, removeLessonIndicatorLink, removeLessonResource, removeTeachingStep, updateLesson, updateTeachingStep, type LessonIndicatorLinkRow, type LessonResourceRow, type LessonRow, type TeachingStepRow } from "../lib/planning";
import CurriculumPicker, { type CurriculumIndicatorChoice } from "./CurriculumPicker";
import AssessmentBuilder from "./AssessmentBuilder";
import LessonGenerator, { type GeneratedLessonDraft } from "./LessonGenerator";
import { DURATION_CUSTOM, DURATION_NONE, DURATION_PRESETS, MIN_LESSON_MINUTES, durationSelection, parseDurationMinutes, validateLessonDuration } from "../lib/lessonSetup";

type Props = { workspaceId: string; termId: string; weekId: string; lesson: LessonRow; placement?: string; onBack: () => void; onSaved: () => void; };
type LessonFields = Pick<LessonRow, "title" | "summary" | "objectives" | "plannedDate" | "durationMinutes" | "status">;

function fieldsFromLesson(lesson: LessonRow): LessonFields {
  return { title: lesson.title, summary: lesson.summary, objectives: lesson.objectives, plannedDate: lesson.plannedDate, durationMinutes: lesson.durationMinutes, status: lesson.status };
}

export default function LessonWorkspace({ workspaceId, termId, weekId, lesson, placement, onBack, onSaved }: Props) {
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [objectives, setObjectives] = useState(lesson.objectives);
  const [plannedDate, setPlannedDate] = useState(lesson.plannedDate || "");
  const [duration, setDuration] = useState(lesson.durationMinutes ? String(lesson.durationMinutes) : "");
  const [durationChoice, setDurationChoice] = useState(() => durationSelection(lesson.durationMinutes));
  const [status, setStatus] = useState(lesson.status);
  const [savedFields, setSavedFields] = useState<LessonFields>(() => fieldsFromLesson(lesson));
  const [links, setLinks] = useState<LessonIndicatorLinkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resources, setResources] = useState<LessonResourceRow[]>([]);
  const [steps, setSteps] = useState<TeachingStepRow[]>([]);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceNotes, setResourceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [stepPhase, setStepPhase] = useState<TeachingStepRow["phase"]>("opening");
  const [stepMinutes, setStepMinutes] = useState("");
  const [stepInstructions, setStepInstructions] = useState("");
  const [editingStepId, setEditingStepId] = useState("");

  const currentFields = useMemo<LessonFields>(() => ({
    title,
    summary,
    objectives,
    plannedDate: plannedDate || null,
    durationMinutes: durationChoice === DURATION_NONE ? null : parseDurationMinutes(duration),
    status,
  }), [title, summary, objectives, plannedDate, duration, durationChoice, status]);
  const editedStep = steps.find((step) => step.id === editingStepId);
  const stepFormDirty = editingStepId
    ? !editedStep || editedStep.title !== stepTitle.trim() || editedStep.phase !== stepPhase
      || (editedStep.minutes ? String(editedStep.minutes) : "") !== stepMinutes
      || editedStep.instructions !== stepInstructions.trim()
    : Boolean(stepTitle.trim() || stepInstructions.trim());
  const hasUnsavedChanges = useMemo(() => JSON.stringify(currentFields) !== JSON.stringify(savedFields)
    || Boolean(stepFormDirty || resourceTitle.trim() || resourceUrl.trim() || resourceNotes.trim() || selectedFile),
  [currentFields, savedFields, stepFormDirty, resourceTitle, resourceUrl, resourceNotes, selectedFile]);

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

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  async function applyGeneratedDraft(draft: GeneratedLessonDraft) {
    const requestedDuration = duration.trim() ? Number(duration) : null;
    if (requestedDuration !== null && (!Number.isInteger(requestedDuration) || requestedDuration < 6)) {
      setError("Lesson duration must be a whole number of at least six minutes.");
      return;
    }
    const durationMinutes = requestedDuration ?? draft.steps.reduce((sum, step) => sum + (step.minutes || 0), 0);
    setTitle(draft.title); setSummary(draft.summary); setObjectives(draft.objectives);
    setDuration(String(durationMinutes)); setDurationChoice(durationSelection(durationMinutes));
    setSaving(true); setError("");
    try {
      await updateLesson(workspaceId, termId, weekId, lesson.id, { title: draft.title, summary: draft.summary, objectives: draft.objectives, durationMinutes });
      setSavedFields((previous) => ({ ...previous, title: draft.title, summary: draft.summary, objectives: draft.objectives, durationMinutes }));
      const sortBase = Math.max(Date.now(), ...steps.map((step) => step.sortOrder + 1));
      const created = await Promise.all(draft.steps.map((step, index) => addTeachingStep(workspaceId, termId, weekId, lesson.id, { title: step.title, phase: step.phase, instructions: step.instructions, minutes: step.minutes, sortOrder: sortBase + index })));
      setSteps((rows) => [...rows, ...created.map((reference, index) => ({ id: reference.id, ...draft.steps[index], lessonId: lesson.id, sortOrder: sortBase + index, archivedAt: null }))]);
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not apply the generated lesson."); }
    finally { setSaving(false); }
  }

  function chooseDuration(value: string) {
    setDurationChoice(value);
    if (value === DURATION_NONE) setDuration("");
    else if (value !== DURATION_CUSTOM) setDuration(value);
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    const durationMinutes = durationChoice === DURATION_NONE ? null : parseDurationMinutes(duration);
    if (durationChoice === DURATION_CUSTOM && durationMinutes === null) {
      setError("Enter the lesson length as a whole number of minutes, for example 45.");
      return;
    }
    const durationError = validateLessonDuration(durationMinutes);
    if (durationError) { setError(durationError); return; }
    setSaving(true); setError("");
    const values: LessonFields = {
      title: title.trim(), summary: summary.trim(), objectives: objectives.trim(),
      plannedDate: plannedDate || null,
      durationMinutes,
      status,
    };
    try {
      await updateLesson(workspaceId, termId, weekId, lesson.id, values);
      setTitle(values.title); setSummary(values.summary); setObjectives(values.objectives);
      setDuration(durationMinutes === null ? "" : String(durationMinutes));
      setDurationChoice(durationSelection(durationMinutes));
      setSavedFields(values);
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this lesson."); }
    finally { setSaving(false); }
  }

  function leaveWorkspace() {
    if (hasUnsavedChanges && !window.confirm("You have unsaved lesson changes. Leave without saving?")) return;
    onBack();
  }

  async function addLink(choice: CurriculumIndicatorChoice) {
    try {
      const sortOrder = Math.max(Date.now(), ...links.map((link) => link.sortOrder + 1));
      const reference = await addLessonIndicatorLink(workspaceId, termId, weekId, lesson.id, { ...choice, sortOrder });
      setLinks((rows) => [...rows, { id: reference.id, ...choice, sortOrder, archivedAt: null }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not link the indicator."); }
  }

  async function addResource() {
    if (!resourceTitle.trim() || (!resourceUrl.trim() && !resourceNotes.trim())) return;
    try {
      const sortOrder = Math.max(Date.now(), ...resources.map((resource) => resource.sortOrder + 1));
      const values = { title: resourceTitle.trim(), type: resourceUrl.trim() ? "link" as const : "note" as const, url: resourceUrl.trim(), storagePath: "", notes: resourceNotes.trim(), sortOrder };
      const reference = await addLessonResource(workspaceId, termId, weekId, lesson.id, values);
      setResources((rows) => [...rows, { id: reference.id, ...values, archivedAt: null }]);
      setResourceTitle(""); setResourceUrl(""); setResourceNotes("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add the resource."); }
  }

  async function uploadFile() {
    if (!selectedFile) return;
    setUploadingFile(true); setError("");
    try {
      const resource = await addLessonFile(workspaceId, termId, weekId, lesson.id, selectedFile);
      setResources((rows) => [...rows, resource]);
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not upload the attachment."); }
    finally { setUploadingFile(false); }
  }

  async function downloadResource(resource: LessonResourceRow) {
    if (resource.type !== "file" || !resource.storagePath) return;
    try {
      const blob = await downloadLessonFile(resource.storagePath);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl; anchor.download = resource.title; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not download the attachment."); }
  }

  async function removeResource(id: string) {
    const resource = resources.find((row) => row.id === id);
    try {
      await removeLessonResource(workspaceId, termId, weekId, lesson.id, id);
      setResources((rows) => rows.filter((row) => row.id !== id));
      if (resource?.type === "file" && resource.storagePath) {
        try { await deleteLessonFile(resource.storagePath); }
        catch { setError("The attachment was removed from this lesson, but its stored file could not be cleaned up."); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove the resource."); }
  }

  function beginEditStep(step: TeachingStepRow) {
    setEditingStepId(step.id); setStepTitle(step.title); setStepPhase(step.phase); setStepMinutes(step.minutes ? String(step.minutes) : ""); setStepInstructions(step.instructions);
  }

  function resetStepForm() {
    setEditingStepId(""); setStepTitle(""); setStepMinutes(""); setStepInstructions(""); setStepPhase("opening");
  }

  async function saveStep() {
    if (!editingStepId || !stepTitle.trim() || !stepInstructions.trim()) return;
    try {
      const values = { title: stepTitle.trim(), phase: stepPhase, instructions: stepInstructions.trim(), minutes: stepMinutes ? Math.max(1, Math.floor(Number(stepMinutes))) : null };
      await updateTeachingStep(workspaceId, termId, weekId, lesson.id, editingStepId, values);
      setSteps((rows) => rows.map((row) => row.id === editingStepId ? { ...row, ...values } : row));
      resetStepForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update the teaching step."); }
  }

  async function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    try {
      const current = steps[index]; const other = steps[target];
      await Promise.all([
        updateTeachingStep(workspaceId, termId, weekId, lesson.id, current.id, { sortOrder: other.sortOrder }),
        updateTeachingStep(workspaceId, termId, weekId, lesson.id, other.id, { sortOrder: current.sortOrder }),
      ]);
      const next = [...steps]; [next[index], next[target]] = [next[target], next[index]]; setSteps(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reorder the teaching steps."); }
  }

  async function addStep() {
    if (!stepTitle.trim() || !stepInstructions.trim()) return;
    try {
      const sortOrder = Math.max(Date.now(), ...steps.map((step) => step.sortOrder + 1));
      const values = { title: stepTitle.trim(), phase: stepPhase, instructions: stepInstructions.trim(), minutes: stepMinutes ? Math.max(1, Math.floor(Number(stepMinutes))) : null, sortOrder };
      const reference = await addTeachingStep(workspaceId, termId, weekId, lesson.id, values);
      setSteps((rows) => [...rows, { id: reference.id, ...values, lessonId: lesson.id, archivedAt: null }]);
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
    <button type="button" className="back-link" onClick={leaveWorkspace}><ArrowLeft size={15}/> Back to planning</button>
    <div className="lesson-workspace-head"><div><div className="overline"><i/> LESSON WORKSPACE</div><h1>Shape the <em>learning.</em></h1><p className="intro">Turn a plan into something you can teach, revisit, and improve.</p></div><div className="lesson-toolbar"><button type="button" className="button outlined" onClick={() => window.print()}><Printer size={14}/> Print plan</button><button type="button" className="button dark" onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? "Saving…" : "Save lesson"}</button></div></div>
    {hasUnsavedChanges && <div className="unsaved-note">You have lesson details that have not been saved yet.</div>}
    {error && <div className="alert">{error}</div>}
    <form className="lesson-editor-grid" onSubmit={save}>
      <div className="editor-main">
        <label className="editor-field"><span>LESSON TITLE</span><input value={title} onChange={(event) => setTitle(event.target.value)} required/></label>
        <label className="editor-field"><span>LESSON SUMMARY</span><textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What should learners understand or experience?"/></label>
        <label className="editor-field"><span>LEARNING OBJECTIVES</span><textarea rows={7} value={objectives} onChange={(event) => setObjectives(event.target.value)} placeholder="By the end of the lesson, learners should be able to…"/></label>
        <section className="editor-card"><div className="editor-card-head"><div><span className="overline">CURRICULUM ALIGNMENT</span><h2>Learning indicators</h2></div><span className="count-pill">{links.length}</span></div>
          {links.map((link) => <div className="linked-indicator" key={link.id}><div><b>{link.fullCode}</b><p>{link.description || link.subjectName || "Curriculum indicator"}</p></div><button type="button" className="icon-only" title="Remove indicator" onClick={() => void removeLink(link.id)}><Trash2 size={14}/></button></div>)}
          <button type="button" className="button outlined picker-trigger" onClick={() => setPickerOpen(true)}><span>+</span> Browse curriculum</button>
          {pickerOpen && <div className="picker-panel"><CurriculumPicker workspaceId={workspaceId} selectedIds={links.map((link) => link.indicatorId)} onSelect={(choice) => { void addLink(choice); }} onClose={() => setPickerOpen(false)} /></div>}
          <small className="helper">Browse the hierarchy or search by indicator code and description. Added indicators are stored against their exact curriculum record.</small>
        </section>
        <LessonGenerator indicators={links} durationMinutes={duration ? Number(duration) : null} onApply={(draft) => void applyGeneratedDraft(draft)} />
      </div>
      <aside className="editor-side">
        <section className="editor-card lesson-setup-card"><div className="editor-card-head"><div><span className="overline">LESSON SETUP</span><h2>Plan the delivery</h2></div>{placement && <span className="setup-meta">{placement}</span>}</div><div className="detail-field"><Check size={15}/><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as LessonRow["status"])}><option value="draft">Draft</option><option value="ready">Ready</option><option value="taught">Taught</option></select></label></div><div className="detail-field"><Clock3 size={15}/><label>Lesson length<select value={durationChoice} onChange={(event) => chooseDuration(event.target.value)}><option value={DURATION_NONE}>Not set</option>{DURATION_PRESETS.map((minutes) => <option key={minutes} value={String(minutes)}>{minutes} minutes</option>)}<option value={DURATION_CUSTOM}>Custom…</option></select>{durationChoice === DURATION_CUSTOM && <input className="duration-custom" type="number" min={MIN_LESSON_MINUTES} step="1" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Minutes"/>}</label></div><div className="detail-field"><CalendarDays size={15}/><label>Planned date<input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)}/></label></div><small className="helper">Lesson length drives the lesson-plan starter, which splits the total across the six teaching phases.</small></section>
        <section className="editor-card">
          <div className="editor-card-head"><div><span className="overline">TEACHING FLOW</span><h2>Lesson sequence</h2></div><span className="count-pill">{steps.length}</span></div>
          <div className="step-list">{steps.map((step, index) => <div className="teaching-step" key={step.id}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><div><div className="step-meta"><b>{step.title}</b><small>{step.phase}{step.minutes ? " · " + step.minutes + " min" : ""}</small></div><p>{step.instructions}</p></div><div className="step-actions"><button type="button" className="icon-only" title="Move up" disabled={index === 0} onClick={() => void moveStep(index, -1)}><ArrowUp size={12}/></button><button type="button" className="icon-only" title="Move down" disabled={index === steps.length - 1} onClick={() => void moveStep(index, 1)}><ArrowDown size={12}/></button><button type="button" className="icon-only" title="Edit step" onClick={() => beginEditStep(step)}><span className="edit-mark">Edit</span></button><button type="button" className="icon-only danger-icon" title="Remove step" onClick={() => void removeStep(step.id)}><Trash2 size={14}/></button></div></div>)}</div>
          <div className="step-form"><div className="form-row"><input value={stepTitle} onChange={(event) => setStepTitle(event.target.value)} placeholder="Activity title, e.g. Starter question"/><select value={stepPhase} onChange={(event) => setStepPhase(event.target.value as TeachingStepRow["phase"])}><option value="opening">Opening</option><option value="explore">Explore</option><option value="explain">Explain</option><option value="practice">Practice</option><option value="assessment">Assessment</option><option value="closing">Closing</option></select><input type="number" min="1" step="1" value={stepMinutes} onChange={(event) => setStepMinutes(event.target.value)} placeholder="Min"/></div><textarea rows={3} value={stepInstructions} onChange={(event) => setStepInstructions(event.target.value)} placeholder="What will the teacher and learners do? Include prompts, grouping, materials, or expected evidence."/><div className="step-form-actions">{editingStepId && <button type="button" className="button outlined" onClick={resetStepForm}>Cancel edit</button>}<button type="button" className="button outlined" onClick={() => void (editingStepId ? saveStep() : addStep())}>{editingStepId ? "Save step" : "+ Add teaching step"}</button></div></div>
        </section>
        <section className="editor-card">
          <div className="editor-card-head"><div><span className="overline">MATERIALS</span><h2>Resources</h2></div><span className="count-pill">{resources.length}</span></div>
          <div className="resource-list">{resources.map((resource) => <div className="resource-item" key={resource.id}><div><b>{resource.type === "file" ? <button type="button" className="resource-download" onClick={() => void downloadResource(resource)}><Download size={12}/>{resource.title}</button> : resource.title}</b><small>{resource.type === "link" ? resource.url : resource.type === "file" ? `Attachment · ${formatBytes(resource.sizeBytes || 0)}` : resource.notes}</small></div><button type="button" className="icon-only" title="Remove resource" onClick={() => void removeResource(resource.id)}><Trash2 size={14}/></button></div>)}</div>
          <div className="resource-form"><input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="Resource title"/><input value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://… (optional for notes)"/><textarea rows={2} value={resourceNotes} onChange={(event) => setResourceNotes(event.target.value)} placeholder="Notes or how this resource will be used"/><button type="button" className="button outlined" onClick={() => void addResource()}>+ Add link or note</button></div>
          <div className="attachment-form"><label className="attachment-pick"><Upload size={14}/><span>{selectedFile ? selectedFile.name : "Choose a file (up to 10 MB)"}</span><input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}/></label><button type="button" className="button outlined" onClick={() => void uploadFile()} disabled={!selectedFile || uploadingFile}>{uploadingFile ? "Uploading…" : "Attach file"}</button></div>
          <small className="helper">Files are private to this workspace. Supported formats: PDF, images, text, Word, Excel, and PowerPoint.</small>
        </section>
        <AssessmentBuilder workspaceId={workspaceId} termId={termId} weekId={weekId} lessonId={lesson.id} indicators={links} />
      </aside>
    </form>
    <div className="print-only">
      <h1>{title}</h1>
      <div className="print-meta"><span>{plannedDate || "Date not set"}</span><span>{duration ? `${duration} minutes` : "Duration not set"}</span><span>{status}</span></div>
      {summary && <section><h2>Lesson summary</h2><p>{summary}</p></section>}
      {objectives && <section><h2>Learning objectives</h2><p>{objectives}</p></section>}
      {!!links.length && <section><h2>Curriculum indicators</h2><ul>{links.map((link) => <li key={link.id}><b>{link.fullCode}</b> — {link.description} {link.subjectName ? `(${link.subjectName})` : ""}</li>)}</ul></section>}
      {!!steps.length && <section><h2>Lesson sequence</h2>{steps.map((step, index) => <div className="print-step" key={step.id}><b>{index + 1}. {step.title} — {step.phase}{step.minutes ? ` · ${step.minutes} min` : ""}</b><p>{step.instructions}</p></div>)}</section>}
      {!!resources.length && <section><h2>Resources</h2><ul>{resources.map((resource) => <li key={resource.id}>{resource.title}{resource.type === "link" ? ` — ${resource.url}` : resource.notes ? ` — ${resource.notes}` : ""}</li>)}</ul></section>}
    </div>
  </section>;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
