import { describe, expect, it } from "vitest";
import { allocateLessonMinutes, findWeekOverlap, isDateOnly, validateDateRange, validateWeekWithinTerm } from "../src/lib/validation";

describe("date validation", () => {
  it("rejects impossible dates and accepts valid date-only strings", () => {
    expect(isDateOnly("2026-02-28")).toBe(true);
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-2-02")).toBe(false);
  });

  it("validates date order and term containment", () => {
    expect(validateDateRange({ startDate: "2026-09-01", endDate: "2026-09-02" }, "Term")).toBeNull();
    expect(validateDateRange({ startDate: "2026-09-03", endDate: "2026-09-02" }, "Term")).toMatch(/on or after/);
    expect(validateWeekWithinTerm(
      { startDate: "2026-09-07", endDate: "2026-09-11" },
      { startDate: "2026-09-01", endDate: "2026-12-01" },
    )).toBeNull();
    expect(validateWeekWithinTerm(
      { startDate: "2026-08-31", endDate: "2026-09-04" },
      { startDate: "2026-09-01", endDate: "2026-12-01" },
    )).toMatch(/before the term/);
  });

  it("detects overlap only when both week ranges are complete", () => {
    const existing = [
      { id: "one", number: 1, startDate: "2026-09-01", endDate: "2026-09-05" },
      { id: "two", number: 2, startDate: "2026-09-08", endDate: null },
    ];
    expect(findWeekOverlap({ number: 3, startDate: "2026-09-05", endDate: "2026-09-09" }, existing)?.id).toBe("one");
    expect(findWeekOverlap({ number: 3, startDate: "2026-09-12", endDate: "2026-09-15" }, existing)).toBeNull();
  });
});

describe("lesson minute allocation", () => {
  it.each([6, 7, 30, 50, 75, 100])("allocates exactly %i whole minutes across all six phases", (total) => {
    const allocation = allocateLessonMinutes(total);
    expect(allocation).toHaveLength(6);
    expect(allocation.every((minutes) => Number.isInteger(minutes) && minutes >= 1)).toBe(true);
    expect(allocation.reduce((sum, minutes) => sum + minutes, 0)).toBe(total);
  });

  it("keeps every phase in the minimum-length draft", () => {
    expect(allocateLessonMinutes(1)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});
