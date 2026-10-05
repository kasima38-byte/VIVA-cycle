import { PeriodEntry } from './cycleStore';

export type DerivedCycleInfo = {
  currentCycleStart: string | null;
  nextPeriod: string | null;
  ovulationDate: string | null;
  fertileWindow: { start: string; end: string } | null;
  periodDays: string[]; // every day covered by every logged period
};

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + mm + '-' + dd;
}

export function deriveCycleInfo(
  periods: PeriodEntry[],
  cycleLength: number,
  periodLength: number,
  todayKey: string
): DerivedCycleInfo {
  if (periods.length === 0) {
    return { currentCycleStart: null, nextPeriod: null, ovulationDate: null, fertileWindow: null, periodDays: [] };
  }

  const sorted = [...periods].sort((a, b) => a.date.localeCompare(b.date));

  // All days covered by every logged period.
  const periodDays: string[] = [];
  sorted.forEach((p) => {
    for (let i = 0; i < periodLength; i++) {
      periodDays.push(addDays(p.date, i));
    }
  });

  // Current cycle = most recent period on or before today; fall back to the latest one.
  const onOrBefore = sorted.filter((p) => p.date <= todayKey);
  const currentCycleStart = (onOrBefore.length ? onOrBefore[onOrBefore.length - 1] : sorted[sorted.length - 1]).date;

  const nextPeriod = addDays(currentCycleStart, cycleLength);
  const ovulationDate = addDays(nextPeriod, -14);
  const fertileWindow = { start: addDays(ovulationDate, -2), end: addDays(ovulationDate, 2) };

  return { currentCycleStart, nextPeriod, ovulationDate, fertileWindow, periodDays };
}