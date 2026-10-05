// VIVA Cycle — engine, calendar and Home tests (no phone needed)
// Run with:  npx tsx tests/cycleEngine.test.ts
// Other time zones:  TZ=Africa/Kampala npx tsx tests/cycleEngine.test.ts
import { addDays, calculateCycle, CycleBaseline, diffDays, PeriodLog, Regularity } from '../lib/cycleEngine';
import { buildCalendarMonth } from '../constants/calendarModel';
import { dateToKey, isValidDateKey, keyToLocalDate } from '../constants/dateUtils';
import { getHomeSummary } from '../constants/homeData';
import type { VivaState } from '../lib/vivaStore';

declare const process: { exitCode?: number; env: Record<string, string | undefined> };

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log('  PASS  ' + label);
  } else {
    failed++;
    console.log('  FAIL  ' + label + '\n        expected ' + e + '\n        got      ' + a);
  }
}
const group = (name: string) => console.log('\n' + name);

const B = (cycleLength: number | null, periodLength: number | null, regularity: Regularity = 'regular'): CycleBaseline =>
  ({ cycleLength, periodLength, regularity });
const logs = (...starts: string[]): PeriodLog[] => starts.map((start) => ({ start }));
const est = (b: CycleBaseline, l: PeriodLog[], today: string) => calculateCycle(b, l, today)!;
const viva = (b: CycleBaseline, l: PeriodLog[]): VivaState => ({
  loaded: true, version: 1, setupComplete: true, name: 'Sarah', dateOfBirth: null,
  baseline: b, goal: 'conceive', periods: l,
});
const marked = (year: number, month: number, l: PeriodLog[], e: ReturnType<typeof est>, today: string,
  key: 'isPeriod' | 'isPredictedPeriod' | 'isFertile' | 'isOvulation') =>
  buildCalendarMonth(year, month, l, e, [], today).filter((d) => d.isCurrentMonth && d[key]).map((d) => d.day);

console.log('Time zone: ' + (process.env.TZ ?? 'system default'));

group('A  Sarah: LMP 5 Sep, 28 days, 5-day period, regular (Prompt 3 example)');
{
  const e = est(B(28, 5), logs('2026-09-05'), '2026-09-26');
  eq(e.currentCycleStart, '2026-09-05', 'confirmed current period start = LMP');
  eq(e.currentCycleDay, 22, '26 Sep is cycle day 22 (5 Sep = day 1)');
  eq(e.estimatedNextPeriod, '2026-10-03', 'next period 3 Oct');
  eq(e.estimatedPeriodWindow, { start: '2026-10-03', end: '2026-10-07' }, 'period window 3–7 Oct');
  eq(e.estimatedOvulation, '2026-09-19', 'estimated ovulation 19 Sep');
  eq(e.estimatedFertileWindow, { start: '2026-09-14', end: '2026-09-19' }, 'fertile window 14–19 Sep (6 days)');
  eq(e.lengthSource, 'baseline', 'uses her stated 28 days');
}

group('B–D  Other cycle lengths');
{
  eq(est(B(30, 5), logs('2026-09-05'), '2026-09-26').estimatedNextPeriod, '2026-10-05', '30 days → 5 Oct');
  eq(est(B(21, 5), logs('2026-09-05'), '2026-09-20').estimatedNextPeriod, '2026-09-26', '21 days → 26 Sep');
  eq(est(B(35, 5), logs('2026-09-05'), '2026-09-26').estimatedNextPeriod, '2026-10-10', '35 days → 10 Oct');
}

group('E  Unknown cycle length');
{
  const e = est(B(null, 5, 'not_sure'), logs('2026-09-05'), '2026-09-26');
  eq(e.lengthSource, 'default', 'marked as a default, not as her real length');
  eq(e.confidence, 'low', 'low confidence');
  const h = getHomeSummary(viva(B(null, 5, 'not_sure'), logs('2026-09-05')), '2026-09-26');
  eq(h.confidenceNote.includes('Not sure'), true, 'Home tells her the 28 days is an assumption');
}

group('F–G  Period durations');
{
  eq(est(B(28, 3), logs('2026-09-05'), '2026-09-06').estimatedPeriodWindow, { start: '2026-10-03', end: '2026-10-05' }, '3-day period');
  eq(est(B(28, 7), logs('2026-09-05'), '2026-09-11').estimatedPeriodWindow, { start: '2026-10-03', end: '2026-10-09' }, '7-day period');
}

group('H–J  Month, year and February boundaries');
{
  const l = logs('2026-12-30');
  const e = est(B(28, 5), l, '2027-01-02');
  eq(marked(2026, 11, l, e, '2027-01-02', 'isPeriod'), [30, 31], 'December shows 30–31');
  eq(marked(2027, 0, l, e, '2027-01-02', 'isPeriod'), [1, 2, 3], 'January shows 1–3 (same period)');
  eq(e.currentCycleDay, 4, '2 Jan is day 4');
  eq(est(B(28, 5), logs('2028-02-10'), '2028-02-20').estimatedNextPeriod, '2028-03-09', 'leap-year February');
  eq(est(B(28, 5), logs('2027-02-10'), '2027-02-20').estimatedNextPeriod, '2027-03-10', 'normal February');
  eq(addDays('2028-02-27', 2), '2028-02-29', '29 Feb 2028 exists');
  eq(diffDays('2027-03-01', '2027-02-27'), 2, 'no 29 Feb in 2027');
}

group('L  Settings change keeps history');
{
  const l = logs('2026-09-05', '2026-10-03');
  const before = JSON.stringify(l);
  const e28 = est(B(28, 5), l, '2026-10-10');
  const e30 = est(B(30, 5), l, '2026-10-10');
  eq(e28.estimatedNextPeriod, '2026-10-31', '28 days → 31 Oct');
  eq(e30.estimatedNextPeriod, '2026-11-02', '30 days → 2 Nov');
  eq(e30.currentCycleStart, '2026-10-03', 'current cycle still starts at the confirmed 3 Oct');
  eq(JSON.stringify(l), before, 'confirmed periods unchanged');
}

group('M  New period logged after onboarding');
{
  const e = est(B(28, 5), logs('2026-09-05', '2026-10-06'), '2026-10-07');
  eq(e.currentCycleStart, '2026-10-06', '6 Oct becomes Cycle Day 1');
  eq(e.currentCycleDay, 2, '7 Oct is day 2');
  eq(e.estimatedNextPeriod, '2026-11-03', 'predictions recalculated from 6 Oct');
}

group('Predictions are never confirmed');
{
  const l = logs('2026-09-05');
  const e = est(B(28, 5), l, '2026-10-06');
  eq(e.isLate, true, '6 Oct with no new log = late');
  eq(e.daysLate, 3, '3 days late');
  eq(e.currentCycleDay, 32, 'cycle keeps counting from the confirmed 5 Sep');
  eq(marked(2026, 9, l, e, '2026-10-06', 'isPeriod'), [], 'October has no confirmed period days');
  eq(marked(2026, 9, l, e, '2026-10-06', 'isPredictedPeriod'), [3, 4, 5, 6, 7], 'overdue 3–7 Oct still shown as predicted');
  eq(est(B(28, 5), logs('2026-12-01'), '2026-11-20') === null, true, 'future-dated log is ignored');
}

group('Calendar matches the engine');
{
  const l = logs('2026-09-05');
  const e = est(B(28, 5), l, '2026-09-26');
  eq(marked(2026, 8, l, e, '2026-09-26', 'isPeriod'), [5, 6, 7, 8, 9], 'September: confirmed 5–9');
  eq(marked(2026, 8, l, e, '2026-09-26', 'isFertile'), [14, 15, 16, 17, 18, 19], 'September: fertile 14–19');
  eq(marked(2026, 8, l, e, '2026-09-26', 'isOvulation'), [19], 'September: ovulation 19');
  eq(marked(2026, 9, l, e, '2026-09-26', 'isPredictedPeriod'), [3, 4, 5, 6, 7, 31], 'October: predicted 3–7 and 31');
}

group('Home matches the engine');
{
  const h = getHomeSummary(viva(B(28, 5), logs('2026-09-05')), '2026-09-26');
  eq(h.cycleDay, 22, 'cycle day 22');
  eq(h.nextPeriodText, 'Expected 3 Oct 2026', 'next period text');
  eq(h.fertileRange, '14 Sep – 19 Sep 2026', 'fertile range text');
  eq(h.confidenceNote.includes('null'), false, 'no "null" in the wording');
}

group('Dates and time zones');
{
  eq(dateToKey(new Date(2026, 9, 3)), '2026-10-03', 'local 3 Oct midnight is 2026-10-03');
  eq(dateToKey(new Date(2026, 9, 3, 23, 59)), '2026-10-03', 'local 23:59 is still 3 Oct');
  eq(dateToKey(keyToLocalDate('2026-10-03')), '2026-10-03', 'key → Date → key round trip');
  eq(isValidDateKey('2026-02-30'), false, '30 Feb is rejected');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed === 0 ? 0 : 1;
