/**
 * Helpers for the dropdown-based lesson setup: the new-lesson dialog picks a
 * term and a week from dropdowns, and the lesson workspace sets the planned
 * lesson length from a duration dropdown with a custom fallback.
 */
export const MIN_LESSON_MINUTES = 6;
export const DURATION_NONE = "none";
export const DURATION_CUSTOM = "custom";
/** Common Ghanaian lesson lengths; anything else is offered through "custom". */
export const DURATION_PRESETS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 120];

export function parseDurationMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateLessonDuration(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (!Number.isInteger(minutes) || minutes < MIN_LESSON_MINUTES) {
    return `Lesson length must be a whole number of at least ${MIN_LESSON_MINUTES} minutes.`;
  }
  return null;
}

/** Select value that represents a stored duration: "none", a preset, or "custom". */
export function durationSelection(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return DURATION_NONE;
  return DURATION_PRESETS.includes(minutes) ? String(minutes) : DURATION_CUSTOM;
}

/**
 * Week dropdown selection: keep the current week while it belongs to the chosen
 * term, otherwise use the requested fallback week, otherwise the first week.
 */
export function pickWeekId(weeks: Array<{ id: string }>, current: string, fallback = ""): string {
  if (weeks.some((week) => week.id === current)) return current;
  if (weeks.some((week) => week.id === fallback)) return fallback;
  return weeks[0]?.id ?? "";
}
