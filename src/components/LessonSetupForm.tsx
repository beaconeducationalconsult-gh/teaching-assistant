import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { listWeeks, type TermRow, type WeekRow } from "../lib/planning";
import { pickWeekId } from "../lib/lessonSetup";

type Props = {
  workspaceId: string;
  terms: TermRow[];
  defaultTermId: string;
  defaultWeekId: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: { termId: string; weekId: string; title: string; summary: string }) => void;
};

/**
 * Dropdown-based lesson setup. A lesson belongs to the week it is created in
 * (the Firestore rules keep `weekId` fixed for the life of the document), so the
 * term and week are chosen here rather than guessed from whatever is expanded.
 */
export default function LessonSetupForm({ workspaceId, terms, defaultTermId, defaultWeekId, busy, onCancel, onSave }: Props) {
  const [termId, setTermId] = useState(defaultTermId || terms[0]?.id || "");
  const [weekId, setWeekId] = useState(defaultWeekId);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loadingWeeks, setLoadingWeeks] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let live = true;
    if (!termId) { setWeeks([]); setWeekId(""); return; }
    setLoadingWeeks(true); setLoadError("");
    listWeeks(workspaceId, termId)
      .then((rows) => {
        if (!live) return;
        setWeeks(rows);
        setWeekId((current) => pickWeekId(rows, current, termId === defaultTermId ? defaultWeekId : ""));
      })
      .catch((reason) => live && setLoadError(reason instanceof Error ? reason.message : "Could not load the weeks for that term."))
      .finally(() => live && setLoadingWeeks(false));
    return () => { live = false; };
  }, [workspaceId, termId, defaultTermId, defaultWeekId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termId || !weekId) return;
    const data = new FormData(event.currentTarget);
    onSave({ termId, weekId, title: String(data.get("title")).trim(), summary: String(data.get("summary")).trim() });
  }

  const weekLabel = (week: WeekRow) => `Week ${week.number}${week.title ? ` · ${week.title}` : ""}`;

  return <form className="modal-form lesson-setup-form" onSubmit={submit}>
    <p>Choose the term and week from the dropdowns, then give the lesson a title. A lesson stays in the week it is created in.</p>
    <div className="two-cols">
      <label>Term<select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={busy || !terms.length} required>
        {terms.map((term) => <option key={term.id} value={term.id}>{term.name} · {term.academicYear}</option>)}
      </select></label>
      <label>Week<select value={weekId} onChange={(event) => setWeekId(event.target.value)} disabled={busy || loadingWeeks || !weeks.length} required>
        {weeks.map((week) => <option key={week.id} value={week.id}>{weekLabel(week)}</option>)}
        {!weeks.length && <option value="">{loadingWeeks ? "Loading weeks…" : "No weeks yet"}</option>}
      </select></label>
    </div>
    {loadError && <div className="form-error">{loadError}</div>}
    {!loadError && !loadingWeeks && !weeks.length && <small className="setup-note">This term has no weeks yet. Add a week to it before planning a lesson.</small>}
    <label>Lesson title<input name="title" required autoFocus placeholder="Fractions in everyday life"/></label>
    <label>Short summary<textarea name="summary" rows={3} placeholder="What will learners explore?"/></label>
    <div className="modal-actions">
      <button type="button" className="button outlined" onClick={onCancel}>Cancel</button>
      <button className="button dark" disabled={busy || loadingWeeks || !weekId}>{busy ? "Saving…" : "Save as draft"}<ArrowRight size={15}/></button>
    </div>
  </form>;
}
