// VIVA Cycle — calendar month model
// Draws ONLY what lib/cycleEngine.ts calculates. No cycle maths happens here
// beyond laying dates onto the month grid.

import { DayInfo } from './cycleData';
import { addDays, CycleEstimate, diffDays, PeriodLog, predictCycles } from '../lib/cycleEngine';

export type DayModel = DayInfo & {
  isPredictedPeriod: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (y: number, m: number, d: number) => y + '-' + pad(m + 1) + '-' + pad(d);

function addRange(set: Set<string>, start: string, end: string) {
  for (let d = start; diffDays(end, d) >= 0; d = addDays(d, 1)) set.add(d);
}

export function buildCalendarMonth(
  year: number,
  monthIndex: number,
  periods: PeriodLog[],
  est: CycleEstimate | null,
  sexDates: string[],
  todayKey: string
): DayModel[] {
  const periodDays = new Set<string>();
  const predictedDays = new Set<string>();
  const fertileDays = new Set<string>();
  const ovulationDays = new Set<string>();

  // 1. Confirmed periods (facts). Until period-end logging exists, a period
  //    without an end date is drawn with the period length in use.
  const starts = Array.from(new Set(periods.map((p) => p.start))).sort();
  const plen = est ? est.periodLengthUsed : 5;
  starts.forEach((start, i) => {
    const log = periods.find((p) => p.start === start);
    let end = log?.end ?? addDays(start, plen - 1);
    const next = starts[i + 1];
    if (next && diffDays(next, end) <= 0) end = addDays(next, -1); // never overlap the next period
    addRange(periodDays, start, end);
  });

  // 2. Predictions (estimates). While a period is late, only the overdue
  //    prediction is shown — nothing further is projected.
  if (est) {
    predictCycles(est, est.isLate ? 1 : 4).forEach((c) => {
      addRange(predictedDays, c.periodStart, c.periodEnd);
      addRange(fertileDays, c.fertileStart, c.fertileEnd);
      ovulationDays.add(c.ovulation);
    });
  }

  const sex = new Set(sexDates);

  const make = (dateKey: string, day: number, inMonth: boolean): DayModel => ({
    dateKey,
    day,
    isCurrentMonth: inMonth,
    isToday: dateKey === todayKey,
    isPeriod: periodDays.has(dateKey),
    isPredictedPeriod: predictedDays.has(dateKey) && !periodDays.has(dateKey),
    isFertile: fertileDays.has(dateKey),
    isOvulation: ovulationDays.has(dateKey),
    isSexLogged: sex.has(dateKey),
  });

  const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const total = new Date(year, monthIndex + 1, 0).getDate();
  const prevTotal = new Date(year, monthIndex, 0).getDate();
  const prevY = monthIndex === 0 ? year - 1 : year;
  const prevM = monthIndex === 0 ? 11 : monthIndex - 1;
  const nextY = monthIndex === 11 ? year + 1 : year;
  const nextM = monthIndex === 11 ? 0 : monthIndex + 1;

  const cells: DayModel[] = [];
  for (let i = lead - 1; i >= 0; i--) {
    const day = prevTotal - i;
    cells.push(make(toKey(prevY, prevM, day), day, false));
  }
  for (let day = 1; day <= total; day++) {
    cells.push(make(toKey(year, monthIndex, day), day, true));
  }
  let nd = 1;
  while (cells.length % 7 !== 0) {
    cells.push(make(toKey(nextY, nextM, nd), nd, false));
    nd++;
  }
  return cells;
}
