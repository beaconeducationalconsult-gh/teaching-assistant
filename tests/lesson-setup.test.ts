import { describe, expect, it } from "vitest";
import { DURATION_CUSTOM, DURATION_NONE, DURATION_PRESETS, MIN_LESSON_MINUTES, durationSelection, parseDurationMinutes, pickWeekId, validateLessonDuration } from "../src/lib/lessonSetup";

describe("lesson duration dropdown", () => {
  it("maps stored minutes onto the dropdown selection", () => {
    expect(durationSelection(null)).toBe(DURATION_NONE);
    expect(durationSelection(Number.NaN)).toBe(DURATION_NONE);
    expect(durationSelection(50)).toBe("50");
    expect(durationSelection(120)).toBe("120");
    expect(durationSelection(47)).toBe(DURATION_CUSTOM);
  });

  it("parses a custom length only when it is a positive whole number", () => {
    expect(parseDurationMinutes(" 45 ")).toBe(45);
    expect(parseDurationMinutes("")).toBeNull();
    expect(parseDurationMinutes("0")).toBeNull();
    expect(parseDurationMinutes("-5")).toBeNull();
    expect(parseDurationMinutes("12.5")).toBeNull();
    expect(parseDurationMinutes("forty")).toBeNull();
  });

  it("requires at least six whole minutes, while leaving an unset length alone", () => {
    expect(validateLessonDuration(null)).toBeNull();
    expect(validateLessonDuration(MIN_LESSON_MINUTES)).toBeNull();
    expect(validateLessonDuration(5)).toMatch(/at least 6 minutes/);
    expect(validateLessonDuration(0)).toMatch(/at least 6 minutes/);
    expect(DURATION_PRESETS.every((minutes) => validateLessonDuration(minutes) === null)).toBe(true);
  });
});

describe("week dropdown selection", () => {
  const weeks = [{ id: "w-one" }, { id: "w-two" }];

  it("keeps the chosen week while it belongs to the selected term", () => {
    expect(pickWeekId(weeks, "w-two")).toBe("w-two");
  });

  it("falls back to the requested week, then to the first week of the term", () => {
    expect(pickWeekId(weeks, "other-term-week", "w-two")).toBe("w-two");
    expect(pickWeekId(weeks, "other-term-week", "missing")).toBe("w-one");
    expect(pickWeekId([], "w-one", "w-two")).toBe("");
  });
});
