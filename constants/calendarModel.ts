// VIVA Cycle — calendar month model
// Draws ONLY what lib/cycleEngine.ts calculates. No cycle maths happens here
// beyond laying engine dates onto the month grid.
//
//  CONFIRMED period  = a day the user actually logged (start day, plus the
//                      days up to a logged end date when one exists)
//  PREDICTED period  = engine estimate: future periods, and the remaining
//                      days of a logged period whose end hasn't been recorded

import { DayInfo } from './cycleData';
import { addDays, CycleEstimate, cycleDayOn, diffDays, PeriodLog, predictCycles } from '../lib/cycleEngine';
import type { FlowValue, MucusValue } from '../lib/dailyTracking';

export type DayModel = DayInfo & {
  isPredictedPeriod: boolean;
  cycleDay: number | null; // from the engine; null before the first logged period
  flow?: FlowValue | null; // recorded flow / spotting - never makes a day a period day
  cervicalMucus?: MucusValue | null; // recorded observation only - never changes fertile/ovulation days
  isPeriodStart?: boolean; // first logged bleeding day of a run of consecutive days
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
  todayKey: string,
  bleeding?: { period: Set<string>; notPeriod: Set<string>; flow?: Record<string, FlowValue> }, // recorded facts
  observations?: { mucus?: Record<string, MucusValue> } // other recorded observations (not drawn yet)
): DayModel[] {
  const confirmedDays = new Set<string>();
  const predictedDays = new Set<string>();
  const fertileDays = new Set<string>();
  const ovulationDays = new Set<string>();

  // 1. Confirmed periods (facts only — no bleeding length is invented)
  const starts = Array.from(new Set(periods.map((p) => p.start))).sort();
  const plen = est ? est.periodLengthUsed : 5;
  starts.forEach((start, i) => {
    const next = starts[i + 1];
    const cap = (end: string) => (next && diffDays(next, end) <= 0 ? addDays(next, -1) : end);
    const log = periods.find((p) => p.start === start);
    if (log?.end) {
      addRange(confirmedDays, start, cap(log.end));
    } else {
      confirmedDays.add(start);
      // Current period only: remaining days use the usual period length — an
      // ESTIMATE, drawn as predicted. Past periods show only what was logged,
      // so changing Settings can never repaint history.
      const isCurrent = est ? start === est.currentCycleStart : i === starts.length - 1;
      if (isCurrent && plen > 1) addRange(predictedDays, addDays(start, 1), cap(addDays(start, plen - 1)));
    }
  });

  // 2. Predictions from the engine. While a period is late, only the overdue
  //    prediction is shown — nothing further is projected.
  if (est) {
    predictCycles(est, est.isLate ? 1 : 4).forEach((c) => {
      addRange(predictedDays, c.periodStart, c.periodEnd);
      addRange(fertileDays, c.fertileStart, c.fertileEnd);
      ovulationDays.add(c.ovulation);
    });
  }

  // 3. Recorded bleeding days are confirmed period days. A day she marked "no period"
  //    is never drawn as predicted bleeding.
  if (bleeding) {
    bleeding.period.forEach((d) => confirmedDays.add(d));
    bleeding.notPeriod.forEach((d) => predictedDays.delete(d));
  }

  const sex = new Set(sexDates);

  const make = (dateKey: string, day: number, inMonth: boolean): DayModel => ({
    dateKey,
    day,
    isCurrentMonth: inMonth,
    isToday: dateKey === todayKey,
    isPeriod: confirmedDays.has(dateKey),
    isPeriodStart: confirmedDays.has(dateKey) && !confirmedDays.has(addDays(dateKey, -1)),
    isPredictedPeriod: predictedDays.has(dateKey) && !confirmedDays.has(dateKey),
    isFertile: fertileDays.has(dateKey),
    isOvulation: ovulationDays.has(dateKey),
    isSexLogged: sex.has(dateKey),
    flow: bleeding?.flow?.[dateKey] ?? null,
    cervicalMucus: observations?.mucus?.[dateKey] ?? null,
    cycleDay: cycleDayOn(periods, dateKey, todayKey),
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
