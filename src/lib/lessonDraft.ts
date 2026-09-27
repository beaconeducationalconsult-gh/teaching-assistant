import type { LessonIndicatorLinkRow, TeachingStepRow } from "./planning";
import { allocateLessonMinutes } from "./validation";

export type GeneratedLessonDraft = {
  title: string;
  summary: string;
  objectives: string;
  steps: Array<{
    title: string;
    phase: TeachingStepRow["phase"];
    instructions: string;
    minutes: number | null;
  }>;
};

const phases: Array<{
  title: string;
  phase: TeachingStepRow["phase"];
}> = [
  { title: "Starter and prior knowledge", phase: "opening" },
  { title: "Explore the idea", phase: "explore" },
  { title: "Explain and connect", phase: "explain" },
  { title: "Guided and independent practice", phase: "practice" },
  { title: "Assessment and exit ticket", phase: "assessment" },
  { title: "Close and extend", phase: "closing" },
];

export function buildLessonDraft({
  indicators,
  durationMinutes,
  className,
  context,
  focus,
}: {
  indicators: LessonIndicatorLinkRow[];
  durationMinutes: number | null;
  className: string;
  context: string;
  focus: string;
}): GeneratedLessonDraft | null {
  if (!indicators.length) return null;

  const primary = indicators[0];
  const subject = primary.subjectName || "the subject";
  const focusText = focus.trim() || primary.description || "the selected learning indicators";
  const title = `${subject}: ${focusText.charAt(0).toUpperCase()}${focusText.slice(1)}`;
  const totalMinutes = Math.max(6, Math.floor(durationMinutes || 50));
  const minutes = allocateLessonMinutes(totalMinutes);
  const anchors = indicators.map((indicator) => `${indicator.fullCode} (${indicator.description})`).join("; ");
  const teachingContext = context.trim() || "familiar examples, discussion, and locally available materials";

  const objectives = indicators
    .map((indicator) => `Learners should be able to explain or demonstrate ${indicator.description} (${indicator.fullCode}).`)
    .concat("Learners should apply the learning to a familiar situation or a new question.")
    .join("\n");

  const instructions = [
    `Begin with a familiar question or short demonstration connected to ${focusText}. Ask learners to share what they already know; record a few ideas and note misconceptions.`,
    `In pairs or small groups, use a simple observation, example, problem, object, picture, or scenario related to ${focusText}. Ask learners what they notice and why it matters. Context: ${teachingContext}.`,
    `Build the explanation from learners' observations. Introduce key vocabulary, connect it explicitly to ${anchors}, and check understanding with short oral questions.`,
    `Give learners progressively challenging tasks connected to ${focusText}. Model one example, then let pairs or individuals work while you circulate and record evidence of understanding.`,
    `Use a short individual check that assesses ${anchors}. Include an explanation or application item and a prompt that can reveal a likely misconception.`,
    "Ask learners to share one thing they learned and one question they still have. Suggest a short home or community-based extension that applies the learning.",
  ];

  return {
    title,
    summary: `A ${totalMinutes}-minute ${className} lesson in ${subject}, anchored to ${anchors}. Learners explore the ideas through ${teachingContext}.`,
    objectives,
    steps: phases.map((step, index) => ({
      ...step,
      instructions: instructions[index],
      minutes: minutes[index],
    })),
  };
}
