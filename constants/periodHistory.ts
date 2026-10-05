import { dayDiff, isValidDateKey } from './dateUtils';

// A CONFIRMED period: something the user actually logged. Predictions are
// never stored here; they are calculated on demand and thrown away.
export type PeriodEntry = {
  date: string; // first day of bleeding, YYYY-MM-DD
  durationDays?: number; // bleeding days, when the user recorded them
  flowIntensity?: 'light' | 'medium' | 'heavy' | 'spotting';
  source: 'confirmed';
};

export type PeriodDetails = {
  durationDays?: number;
  flowIntensity?: PeriodEntry['flowIntensity'];
};

export type AddOutcome = 'added' | 'updated' | 'merged';

// Two start dates closer together than this are one bleed, not two periods.
export const SAME_PERIOD_WITHIN_DAYS = 15;

export function sortPeriods(periods: PeriodEntry[]): PeriodEntry[] {
  return [...periods].sort((a, b) => a.date.localeCompare(b.date));
}

export function startDates(periods: PeriodEntry[]): string[] {
  return sortPeriods(periods).map((p) => p.date);
}

// Adds a confirmed period without creating duplicates. Pure: returns a new list.
//  - same day logged again          -> 'updated' (details replaced)
//  - within 15 days of another start -> 'merged' (the earlier start date wins)
//  - otherwise                      -> 'added'
export function addPeriod(
  periods: PeriodEntry[],
  date: string,
  details: PeriodDetails = {}
): { periods: PeriodEntry[]; entry: PeriodEntry; outcome: AddOutcome } {
  if (!isValidDateKey(date)) throw new Error('Invalid period date: ' + date);

  const defined: PeriodDetails = {};
  if (details.durationDays !== undefined) defined.durationDays = details.durationDays;
  if (details.flowIntensity !== undefined) defined.flowIntensity = details.flowIntensity;

  const near = periods.filter((p) => Math.abs(dayDiff(p.date, date)) < SAME_PERIOD_WITHIN_DAYS);

  if (near.length === 0) {
    const entry: PeriodEntry = { date, source: 'confirmed', ...defined };
    return { periods: sortPeriods([...periods, entry]), entry, outcome: 'added' };
  }

  const earliest = [date, ...near.map((p) => p.date)].sort()[0];
  const base = near.find((p) => p.date === earliest) ?? near[0];
  const entry: PeriodEntry = { ...base, ...defined, date: earliest, source: 'confirmed' };
  const rest = periods.filter((p) => !near.includes(p));
  const outcome: AddOutcome = near.length === 1 && near[0].date === date ? 'updated' : 'merged';
  return { periods: sortPeriods([...rest, entry]), entry, outcome };
}

// Completed cycle lengths: the gap between each confirmed start and the next.
// The number of bleeding days is never used here.
export function completedCycleLengths(periods: PeriodEntry[]): number[] {
  const starts = startDates(periods);
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    lengths.push(dayDiff(starts[i - 1], starts[i]));
  }
  return lengths;
}

export function latestStartOnOrBefore(periods: PeriodEntry[], todayKey: string): string | null {
  const starts = startDates(periods).filter((s) => s <= todayKey);
  return starts.length ? starts[starts.length - 1] : null;
}
