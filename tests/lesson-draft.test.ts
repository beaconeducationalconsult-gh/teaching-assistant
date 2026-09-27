import { describe, expect, it } from "vitest";
import { buildLessonDraft } from "../src/lib/lessonDraft";
import type { LessonIndicatorLinkRow } from "../src/lib/planning";

const indicators: LessonIndicatorLinkRow[] = [
  { id: "one", indicatorId: "indicator-one", fullCode: "B7.1.1.1", description: "Classify familiar materials", subjectId: "science", subjectName: "Science", levelId: "jhs-1", sortOrder: 1, archivedAt: null },
  { id: "two", indicatorId: "indicator-two", fullCode: "B7.1.1.2", description: "Explain material properties", subjectId: "science", subjectName: "Science", levelId: "jhs-1", sortOrder: 2, archivedAt: null },
];

describe("structured lesson starter", () => {
  it("uses every selected curriculum anchor and fits the requested duration", () => {
    const draft = buildLessonDraft({ indicators, durationMinutes: 50, className: "JHS 1", context: "Local examples", focus: "Materials" });
    expect(draft).not.toBeNull();
    expect(draft?.summary).toContain("B7.1.1.1");
    expect(draft?.summary).toContain("B7.1.1.2");
    expect(draft?.objectives).toContain("Classify familiar materials");
    expect(draft?.steps.reduce((sum, step) => sum + (step.minutes || 0), 0)).toBe(50);
  });

  it("returns no draft without a linked curriculum indicator", () => {
    expect(buildLessonDraft({ indicators: [], durationMinutes: null, className: "JHS 1", context: "", focus: "" })).toBeNull();
  });
});
