import { useMemo, useState } from "react";
import { RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import type { LessonIndicatorLinkRow, TeachingStepRow } from "../lib/planning";

export type GeneratedLessonDraft = {
  title: string;
  summary: string;
  objectives: string;
  steps: Array<{ title: string; phase: TeachingStepRow["phase"]; instructions: string; minutes: number | null }>;
};

type Props = { indicators: LessonIndicatorLinkRow[]; durationMinutes: number | null; onApply: (draft: GeneratedLessonDraft) => void };

export default function LessonGenerator({ indicators, durationMinutes, onApply }: Props) {
  const [className, setClassName] = useState("JHS 1");
  const [context, setContext] = useState("Use familiar Ghanaian examples, pair/group discussion, and locally available materials.");
  const [focus, setFocus] = useState("");
  const [generated, setGenerated] = useState<GeneratedLessonDraft | null>(null);
  const indicatorText = useMemo(() => indicators.map((item) => item.fullCode + " · " + item.subjectName).join(" · "), [indicators]);

  function generate() {
    if (!indicators.length) return;
    const primary = indicators[0];
    const subject = primary.subjectName || "the subject";
    const code = primary.fullCode || "the selected curriculum indicator";
    const clean = focus.trim() || "understanding and applying the selected curriculum indicator";
    const title = subject + ": " + clean.charAt(0).toUpperCase() + clean.slice(1);
    const minutes = durationMinutes || 50;
    const opening = Math.max(5, Math.round(minutes * 0.1));
    const explore = Math.max(8, Math.round(minutes * 0.2));
    const explain = Math.max(10, Math.round(minutes * 0.25));
    const practice = Math.max(10, Math.round(minutes * 0.3));
    const assessment = Math.max(5, minutes - opening - explore - explain - practice);
    setGenerated({
      title,
      summary: "A " + minutes + "-minute " + className + " lesson in " + subject + " built around " + code + ". Learners will explore the idea through " + context.toLowerCase(),
      objectives: [
        "By the end of the lesson, learners should be able to explain the key idea represented by " + code + ".",
        "Learners should be able to demonstrate their understanding using an example, observation, explanation, or worked response.",
        "Learners should be able to apply the learning to a familiar situation or new question.",
      ].join("\n"),
      steps: [
        { title: "Starter and prior knowledge", phase: "opening", minutes: opening, instructions: "Begin with a familiar question or short demonstration connected to " + clean + ". Ask learners to share what they already know. Record two or three ideas and identify misconceptions." },
        { title: "Explore the idea", phase: "explore", minutes: explore, instructions: "Put learners in pairs or small groups. Give each group a simple observation, example, problem, object, picture, or scenario related to " + clean + ". Ask groups to discuss what they notice and why it matters. " + context },
        { title: "Explain and connect", phase: "explain", minutes: explain, instructions: "Bring the class together. Build the explanation from learners' observations. Introduce key vocabulary and connect it explicitly to curriculum indicator " + code + ". Check understanding with short oral questions." },
        { title: "Guided and independent practice", phase: "practice", minutes: practice, instructions: "Give learners two or three progressively challenging tasks. Start with one guided example, then allow pairs or individuals to complete the remaining tasks. Circulate, question learners, and record evidence of understanding." },
        { title: "Assessment and exit ticket", phase: "assessment", minutes: assessment, instructions: "Ask learners to complete a short individual check: one recall or identification item, one explanation/application item, and one item that reveals a common misconception. Collect responses or sample them before learners leave." },
        { title: "Close and extend", phase: "closing", minutes: 2, instructions: "Ask learners to state one thing they learned and one question they still have. Give a short home or community-based extension that applies the lesson to everyday life." },
      ],
    });
  }

  return <section className="editor-card lesson-generator">
    <div className="generator-head"><div><span className="overline"><i/> LESSON GENERATOR</span><h2>Build a teachable first draft.</h2><p>Start from the curriculum indicators linked to this lesson. Review the draft before teaching.</p></div><span className="generator-icon"><Sparkles size={17}/></span></div>
    {!indicators.length ? <div className="generator-empty"><WandSparkles size={18}/><div><b>Link a curriculum indicator first.</b><small>The generator uses the selected indicator as its curriculum anchor.</small></div></div> :
      <div className="generator-body">
        <div className="generator-source"><span>CURRICULUM ANCHOR</span><b>{indicatorText}</b></div>
        <div className="generator-grid">
          <label>Class<select value={className} onChange={(e) => setClassName(e.target.value)}><option>JHS 1</option><option>JHS 2</option><option>JHS 3</option></select></label>
          <label>Lesson focus<input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. identify and explain the stages" /></label>
        </div>
        <label className="generator-context">Teaching context<textarea rows={2} value={context} onChange={(e) => setContext(e.target.value)} /></label>
        <div className="generator-actions"><button type="button" className="button dark" onClick={generate}><WandSparkles size={14}/> Generate draft</button>{generated && <button type="button" className="button outlined" onClick={() => setGenerated(null)}><RotateCcw size={14}/> Start again</button>}</div>
        {generated && <div className="generated-preview">
          <div className="generated-preview-head"><div><span className="overline">GENERATED DRAFT</span><b>{generated.title}</b></div><button type="button" className="button outlined" onClick={() => onApply(generated)}>Apply to lesson</button></div>
          <div className="generated-summary"><b>Summary</b><p>{generated.summary}</p><b>Objectives</b><p>{generated.objectives}</p></div>
          <div className="generated-steps">{generated.steps.map((step, index) => <div key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><section><b>{step.title}</b><small>{step.phase} · {step.minutes} min</small><p>{step.instructions}</p></section></div>)}</div>
        </div>}
      </div>}
  </section>;
}
