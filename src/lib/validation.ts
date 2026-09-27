export type DateRange = {
  startDate: string | null;
  endDate: string | null;
};

export type ExistingWeek = DateRange & {
  id?: string;
  number: number;
  title?: string;
};

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function validateDateRange(range: DateRange, label: string): string | null {
  const { startDate, endDate } = range;
  if (startDate && !isDateOnly(startDate)) return `${label} start date must be a valid date.`;
  if (endDate && !isDateOnly(endDate)) return `${label} end date must be a valid date.`;
  if (startDate && endDate && startDate > endDate) {
    return `${label} end date must be on or after its start date.`;
  }
  return null;
}

export function validateWeekWithinTerm(week: DateRange, term: DateRange): string | null {
  const invalidWeek = validateDateRange(week, "Week");
  if (invalidWeek) return invalidWeek;
  if (week.startDate && term.startDate && week.startDate < term.startDate) {
    return "A week cannot start before the term starts.";
  }
  if (week.endDate && term.endDate && week.endDate > term.endDate) {
    return "A week cannot end after the term ends.";
  }
  return null;
}

export function findWeekOverlap(
  candidate: ExistingWeek,
  weeks: ExistingWeek[],
  excludedId?: string,
): ExistingWeek | null {
  if (!candidate.startDate || !candidate.endDate) return null;
  return weeks.find((week) => {
    if (week.id === excludedId || !week.startDate || !week.endDate) return false;
    return candidate.startDate! <= week.endDate! && week.startDate <= candidate.endDate!;
  }) || null;
}

const LESSON_PHASE_WEIGHTS = [0.1, 0.2, 0.25, 0.3, 0.1, 0.05] as const;

/** Allocate whole minutes across six lesson phases; every phase gets at least one minute. */
export function allocateLessonMinutes(totalMinutes: number): number[] {
  const total = Math.max(LESSON_PHASE_WEIGHTS.length, Math.floor(totalMinutes));
  const distributable = total - LESSON_PHASE_WEIGHTS.length;
  const exact = LESSON_PHASE_WEIGHTS.map((weight) => distributable * weight);
  const extras = exact.map(Math.floor);
  let remainder = distributable - extras.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i += 1) extras[order[i].index] += 1;
  return extras.map((value) => value + 1);
}
