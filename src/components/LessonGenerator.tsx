import { useMemo, useState } from "react";
import { RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import type { LessonIndicatorLinkRow } from "../lib/planning";
import { buildLessonDraft, type GeneratedLessonDraft } from "../lib/lessonDraft";

export type { GeneratedLessonDraft } from "../lib/lessonDraft";

type Props = { indicators: LessonIndicatorLinkRow[]; durationMinutes: number | null; onApply: (draft: GeneratedLessonDraft) => void };

export default function LessonGenerator({ indicators, durationMinutes, onApply }: Props) {
  const [className, setClassName] = useState("JHS 1");
  const [context, setContext] = useState("Use familiar Ghanaian examples, pair/group discussion, and locally available materials.");
  const [focus, setFocus] = useState("");
  const [generated, setGenerated] = useState<GeneratedLessonDraft | null>(null);
  const indicatorText = useMemo(() => indicators.map((item) => item.fullCode + " · " + item.subjectName).join(" · "), [indicators]);

  function generate() {
    const draft = buildLessonDraft({ indicators, durationMinutes, className, context, focus });
    setGenerated(draft);
  }

  return <section className="editor-card lesson-generator">
    <div className="generator-head"><div><span className="overline"><i/> LESSON PLAN STARTER</span><h2>Build a teachable first draft.</h2><p>This structured, local template uses the linked curriculum indicators; it does not call an AI service. Review and adapt it before teaching.</p></div><span className="generator-icon"><Sparkles size={17}/></span></div>
    {!indicators.length ? <div className="generator-empty"><WandSparkles size={18}/><div><b>Link a curriculum indicator first.</b><small>The starter uses the selected indicators as its curriculum anchors.</small></div></div> :
      <div className="generator-body">
        <div className="generator-source"><span>CURRICULUM ANCHORS</span><b>{indicatorText}</b></div>
        <div className="generator-grid">
          <label>Class<select value={className} onChange={(e) => setClassName(e.target.value)}><option>JHS 1</option><option>JHS 2</option><option>JHS 3</option></select></label>
          <label>Lesson focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. identify and explain the stages" /></label>
        </div>
        <label className="generator-context">Teaching context<textarea rows={2} value={context} onChange={(e) => setContext(e.target.value)} /></label>
        <div className="generator-actions"><button type="button" className="button dark" onClick={generate}><WandSparkles size={14}/> Generate starter</button>{generated && <button type="button" className="button outlined" onClick={() => setGenerated(null)}><RotateCcw size={14}/> Start again</button>}</div>
        {generated && <div className="generated-preview">
          <div className="generated-preview-head"><div><span className="overline">STRUCTURED DRAFT</span><b>{generated.title}</b></div><button type="button" className="button outlined" onClick={() => onApply(generated)}>Apply to lesson</button></div>
          <div className="generated-summary"><b>Summary</b><p>{generated.summary}</p><b>Objectives</b><p>{generated.objectives}</p></div>
          <div className="generated-steps">{generated.steps.map((step, index) => <div key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><section><b>{step.title}</b><small>{step.phase} · {step.minutes} min</small><p>{step.instructions}</p></section></div>)}</div>
        </div>}
      </div>}
  </section>;
}
