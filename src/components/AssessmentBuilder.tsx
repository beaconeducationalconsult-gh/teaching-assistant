import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ClipboardList, Pencil, Trash2 } from "lucide-react";
import {
  addAssessment,
  addAssessmentItem,
  listAssessmentItems,
  listAssessments,
  removeAssessment,
  removeAssessmentItem,
  updateAssessment,
  updateAssessmentItem,
  type AssessmentItemRow,
  type AssessmentRow,
  type LessonIndicatorLinkRow,
} from "../lib/planning";

type Props = {
  workspaceId: string;
  termId: string;
  weekId: string;
  lessonId: string;
  indicators: LessonIndicatorLinkRow[];
};

type ItemType = AssessmentItemRow["type"];

const itemLabels: Record<ItemType, string> = {
  shortAnswer: "Short answer",
  multipleChoice: "Multiple choice",
  trueFalse: "True / False",
  essay: "Extended response",
  practical: "Practical task",
};

export default function AssessmentBuilder({ workspaceId, termId, weekId, lessonId, indicators }: Props) {
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [activeId, setActiveId] = useState("");
  const [items, setItems] = useState<AssessmentItemRow[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AssessmentRow["type"]>("formative");
  const [instructions, setInstructions] = useState("");
  const [markingNotes, setMarkingNotes] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [itemType, setItemType] = useState<ItemType>("shortAnswer");
  const [prompt, setPrompt] = useState("");
  const [marks, setMarks] = useState("1");
  const [options, setOptions] = useState("");
  const [answer, setAnswer] = useState("");
  const [markingGuide, setMarkingGuide] = useState("");
  const [indicatorId, setIndicatorId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingItemId, setEditingItemId] = useState("");

  const active = assessments.find((assessment) => assessment.id === activeId) || null;
  const totalMarks = useMemo(() => items.reduce((sum, item) => sum + (Number(item.marks) || 0), 0), [items]);

  useEffect(() => {
    let live = true;
    listAssessments(workspaceId, termId, weekId, lessonId).then((rows) => {
      if (!live) return;
      setAssessments(rows);
      setActiveId((current) => current || rows[0]?.id || "");
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, termId, weekId, lessonId]);

  useEffect(() => {
    if (!activeId) { setItems([]); return; }
    let live = true;
    listAssessmentItems(workspaceId, termId, weekId, lessonId, activeId).then((rows) => {
      if (live) setItems(rows);
    }).catch((reason) => live && setError(message(reason)));
    return () => { live = false; };
  }, [workspaceId, termId, weekId, lessonId, activeId]);

  useEffect(() => {
    if (!active) return;
    setTitle(active.title);
    setType(active.type);
    setInstructions(active.instructions);
    setMarkingNotes(active.markingNotes);
    setPlannedDate(active.plannedDate || "");
  }, [activeId]);

  async function createAssessment() {
    if (!title.trim()) return;
    setBusy(true); setError("");
    try {
      const sortOrder = Date.now();
      const values = { lessonId, title: title.trim(), type, instructions: instructions.trim(), markingNotes: markingNotes.trim(), plannedDate: plannedDate || null, sortOrder };
      const ref = await addAssessment(workspaceId, termId, weekId, lessonId, values);
      const row = { id: ref.id, ...values, archivedAt: null } as AssessmentRow;
      setAssessments((rows) => [...rows, row]);
      setActiveId(row.id);
      setItems([]);
      setTitle(""); setInstructions(""); setMarkingNotes(""); setPlannedDate("");
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  async function saveAssessment() {
    if (!active || !title.trim()) return;
    setBusy(true); setError("");
    try {
      const values = { title: title.trim(), type, instructions: instructions.trim(), markingNotes: markingNotes.trim(), plannedDate: plannedDate || null };
      await updateAssessment(workspaceId, termId, weekId, lessonId, active.id, values);
      setAssessments((rows) => rows.map((row) => row.id === active.id ? { ...row, ...values } : row));
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  async function deleteAssessment() {
    if (!active || !window.confirm(`Remove “${active.title}” and its assessment record?`)) return;
    setBusy(true); setError("");
    try {
      await removeAssessment(workspaceId, termId, weekId, lessonId, active.id);
      const remaining = assessments.filter((row) => row.id !== active.id);
      setAssessments(remaining);
      setActiveId(remaining[0]?.id || "");
      setItems([]);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  function beginEditItem(item: AssessmentItemRow) {
    setEditingItemId(item.id); setItemType(item.type); setPrompt(item.prompt); setMarks(String(item.marks)); setOptions(item.options.join("\n")); setAnswer(item.answer); setMarkingGuide(item.markingGuide); setIndicatorId(item.indicatorId || "");
  }

  function resetItemForm() {
    setEditingItemId(""); setPrompt(""); setOptions(""); setAnswer(""); setMarkingGuide(""); setIndicatorId(""); setMarks("1"); setItemType("shortAnswer");
  }

  async function saveItem() {
    if (!active || !editingItemId || !prompt.trim()) return;
    setBusy(true); setError("");
    try {
      const normalizedOptions = itemType === "multipleChoice" ? options.split("\n").map((value) => value.trim()).filter(Boolean) : itemType === "trueFalse" ? ["True", "False"] : [];
      const values = { type: itemType, prompt: prompt.trim(), marks: Math.max(1, Number(marks) || 1), options: normalizedOptions, answer: answer.trim(), markingGuide: markingGuide.trim(), indicatorId: indicatorId || null };
      await updateAssessmentItem(workspaceId, termId, weekId, lessonId, active.id, editingItemId, values);
      setItems((rows) => rows.map((row) => row.id === editingItemId ? { ...row, ...values } : row));
      resetItemForm();
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  async function moveItem(index: number, direction: -1 | 1) {
    if (!active) return;
    const target = index + direction; if (target < 0 || target >= items.length) return;
    try {
      const current = items[index]; const other = items[target];
      await Promise.all([
        updateAssessmentItem(workspaceId, termId, weekId, lessonId, active.id, current.id, { sortOrder: other.sortOrder }),
        updateAssessmentItem(workspaceId, termId, weekId, lessonId, active.id, other.id, { sortOrder: current.sortOrder }),
      ]);
      const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; setItems(next);
    } catch (reason) { setError(message(reason)); }
  }

  async function createItem() {
    if (!active || !prompt.trim()) return;
    setBusy(true); setError("");
    try {
      const normalizedOptions = itemType === "multipleChoice"
        ? options.split("\n").map((value) => value.trim()).filter(Boolean)
        : itemType === "trueFalse" ? ["True", "False"] : [];
      const values = {
        assessmentId: active.id,
        type: itemType,
        prompt: prompt.trim(),
        marks: Math.max(1, Number(marks) || 1),
        options: normalizedOptions,
        answer: answer.trim(),
        markingGuide: markingGuide.trim(),
        indicatorId: indicatorId || null,
        sortOrder: Date.now(),
      };
      const ref = await addAssessmentItem(workspaceId, termId, weekId, lessonId, active.id, values);
      setItems((rows) => [...rows, { id: ref.id, ...values, archivedAt: null }]);
      setPrompt(""); setOptions(""); setAnswer(""); setMarkingGuide(""); setIndicatorId(""); setMarks("1");
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  async function deleteItem(itemId: string) {
    if (!active) return;
    try {
      await removeAssessmentItem(workspaceId, termId, weekId, lessonId, active.id, itemId);
      setItems((rows) => rows.filter((row) => row.id !== itemId));
    } catch (reason) { setError(message(reason)); }
  }

  return <section className="editor-card assessment-builder">
    <div className="editor-card-head">
      <div><span className="overline">ASSESSMENT BUILDER</span><h2>Check the learning</h2></div>
      <span className="count-pill">{totalMarks} marks</span>
    </div>
    <p className="assessment-intro">Build checks from the lesson objectives and curriculum indicators. Keep the assessment reusable instead of burying questions inside the lesson notes.</p>
    {error && <div className="assessment-error">{error}</div>}

    <div className="assessment-tabs">
      {assessments.map((item) => <button type="button" className={item.id === activeId ? "active" : ""} key={item.id} onClick={() => setActiveId(item.id)}>{item.title}</button>)}
      {!assessments.length && <span>No assessment yet.</span>}
    </div>

    <div className="assessment-meta-form">
      <div className="assessment-form-row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assessment title, e.g. Exit ticket" />
        <select value={type} onChange={(e) => setType(e.target.value as AssessmentRow["type"])}><option value="formative">Formative</option><option value="summative">Summative</option><option value="practical">Practical</option><option value="other">Other</option></select>
        <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
      </div>
      <textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instructions learners should see…" />
      <textarea rows={2} value={markingNotes} onChange={(e) => setMarkingNotes(e.target.value)} placeholder="General marking guidance for the teacher…" />
      <div className="assessment-actions">
        {active ? <><button type="button" className="button outlined" onClick={() => void saveAssessment()} disabled={busy}>Save assessment</button><button type="button" className="icon-only danger-icon" title="Archive assessment" onClick={() => void deleteAssessment()}><Trash2 size={14}/></button></> : <button type="button" className="button outlined" onClick={() => void createAssessment()} disabled={busy || !title.trim()}>+ Create assessment</button>}
        {active && <button type="button" className="button outlined" onClick={() => { setActiveId(""); setTitle(""); setType("formative"); setInstructions(""); setMarkingNotes(""); setPlannedDate(""); }}>+ New assessment</button>}
      </div>
    </div>

    {active && <div className="assessment-items">
      <div className="assessment-items-head"><div><span className="overline">QUESTIONS</span><b>{items.length} item{items.length === 1 ? "" : "s"}</b></div><small>{active.type} · {totalMarks} marks</small></div>
      {items.map((item, index) => <article className="assessment-item" key={item.id}>
        <span className="assessment-number">{String(index + 1).padStart(2, "0")}</span>
        <div className="assessment-item-copy"><div><b>{itemLabels[item.type]}</b><small>{item.marks} mark{item.marks === 1 ? "" : "s"}</small></div><p>{item.prompt}</p>{item.options.length > 0 && <ul>{item.options.map((option) => <li key={option}>{option}</li>)}</ul>}{item.markingGuide && <small className="marking-guide">Marking: {item.markingGuide}</small>}</div>
        <div className="assessment-item-actions"><button type="button" className="icon-only" title="Move up" disabled={index === 0} onClick={() => void moveItem(index, -1)}><ArrowUp size={12}/></button><button type="button" className="icon-only" title="Move down" disabled={index === items.length - 1} onClick={() => void moveItem(index, 1)}><ArrowDown size={12}/></button><button type="button" className="icon-only" title="Edit question" onClick={() => beginEditItem(item)}><Pencil size={13}/></button><button type="button" className="icon-only danger-icon" title="Remove question" onClick={() => void deleteItem(item.id)}><Trash2 size={14}/></button></div>
      </article>)}
      {!items.length && <div className="assessment-empty"><ClipboardList size={19}/><span>Add the first question below.</span></div>}

      <div className="question-form">
        <div className="assessment-form-row question-top">
          <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)}>{Object.entries(itemLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <input type="number" min="1" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Marks" />
          <select value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}><option value="">No linked indicator</option>{indicators.map((indicator) => <option key={indicator.indicatorId} value={indicator.indicatorId}>{indicator.fullCode}</option>)}</select>
        </div>
        <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Write the question or task…" />
        {itemType === "multipleChoice" && <textarea rows={4} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"Options — one per line\nA. …\nB. …\nC. …"} />}
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={itemType === "multipleChoice" ? "Correct option" : "Expected answer / response"} />
        <textarea rows={3} value={markingGuide} onChange={(e) => setMarkingGuide(e.target.value)} placeholder="Specific marking guidance…" />
        <div className="question-actions">{editingItemId && <button type="button" className="button outlined" onClick={resetItemForm}>Cancel edit</button>}<button type="button" className="button outlined" onClick={() => void (editingItemId ? saveItem() : createItem())} disabled={busy || !prompt.trim()}><Check size={14}/> {editingItemId ? "Save question" : "Add question"}</button></div>
      </div>
    </div>}
  </section>;
}

function message(reason: unknown) {
  const error = reason as { message?: string };
  return error?.message || "Could not load the assessment.";
}
