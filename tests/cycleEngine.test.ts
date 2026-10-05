// VIVA Cycle — engine, calendar and Home tests (no phone needed)
// Run with:  npx tsx tests/cycleEngine.test.ts
// Other time zones:  TZ=Africa/Kampala npx tsx tests/cycleEngine.test.ts
import {
  addDays, applyPeriodCorrection, applyPeriodLog, calculateCycle, completedCycles, cycleDayOn,
  CycleBaseline, diffDays, PeriodLog, Regularity,
} from '../lib/cycleEngine';
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
  key: 'isPeriod' | 'isPredictedPeriod' | 'isFertile' | 'isOvulation' | 'isToday') =>
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
  eq(marked(2026, 11, l, e, '2027-01-02', 'isPeriod'), [30], 'December: logged start 30 Dec');
  eq(marked(2026, 11, l, e, '2027-01-02', 'isPredictedPeriod'), [31], 'December: 31 Dec estimated (no end logged)');
  eq(marked(2027, 0, l, e, '2027-01-02', 'isPredictedPeriod').slice(0, 3), [1, 2, 3], 'January: 1–3 continue the same period');
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
  eq(marked(2026, 8, l, e, '2026-09-26', 'isPeriod'), [5], 'September: only the logged day is confirmed');
  eq(marked(2026, 8, l, e, '2026-09-26', 'isPredictedPeriod'), [6, 7, 8, 9], 'September: 6–9 estimated from usual length');
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

group('Prompt 4 · TEST A  On-time period (3 Oct)');
{
  const r = applyPeriodLog(logs('2026-09-05'), '2026-10-03', '2026-10-03');
  eq(r.result, { kind: 'added', completedCycle: 28 }, 'added, completed cycle 28 days');
  const e = est(B(28, 5), r.logs, '2026-10-03');
  eq([e.currentCycleStart, e.currentCycleDay], ['2026-10-03', 1], '3 Oct = confirmed Cycle Day 1');
}

group('Prompt 4 · TEST B  Late period (8 Oct)');
{
  const r = applyPeriodLog(logs('2026-09-05'), '2026-10-08', '2026-10-08');
  eq(r.result, { kind: 'added', completedCycle: 33 }, 'completed cycle 33 days');
  eq(r.logs.map((l) => l.start), ['2026-09-05', '2026-10-08'], 'no fake 3 Oct period created');
  const e = est(B(28, 5), r.logs, '2026-10-08');
  eq(e.currentCycleDay, 1, '8 Oct = Cycle Day 1');
  eq(e.estimatedNextPeriod, '2026-11-05', 'next prediction from 8 Oct');
  eq(marked(2026, 9, r.logs, e, '2026-10-08', 'isPredictedPeriod').filter((d) => d < 8), [], 'old 3–7 Oct prediction is gone');
  eq(marked(2026, 9, r.logs, e, '2026-10-08', 'isPeriod'), [8], 'one period, confirmed from 8 Oct');
}

group('Prompt 4 · TEST C  Early period (30 Sep)');
{
  const r = applyPeriodLog(logs('2026-09-05'), '2026-09-30', '2026-09-30');
  eq(r.result, { kind: 'added', completedCycle: 25 }, 'completed cycle 25 days');
  const e = est(B(28, 5), r.logs, '2026-09-30');
  eq([e.currentCycleStart, e.estimatedNextPeriod], ['2026-09-30', '2026-10-28'], 'predictions recalculated from 30 Sep');
}

group('Prompt 4 · TEST D  No period logged');
{
  const l = logs('2026-09-05');
  est(B(28, 5), l, '2026-10-10');
  eq(l.map((x) => x.start), ['2026-09-05'], 'passing the predicted dates creates no confirmed period');
}

group('Prompt 4 · TEST E  Duplicates, future and close dates');
{
  const first = applyPeriodLog(logs('2026-09-05'), '2026-10-06', '2026-10-06');
  const again = applyPeriodLog(first.logs, '2026-10-06', '2026-10-06');
  eq(again.result.kind, 'duplicate', 'second 6 Oct is refused');
  eq(again.logs.length, 2, 'still only two records');
  eq(applyPeriodLog(logs('2026-09-05'), '2026-10-20', '2026-10-06').result.kind, 'future', 'future date refused');
  eq(applyPeriodLog(logs('2026-09-05'), '2026-02-30', '2026-10-06').result.kind, 'invalid', 'impossible date refused');
  eq(applyPeriodLog(first.logs, '2026-10-05', '2026-10-06').result,
    { kind: 'tooClose', existing: '2026-10-06', daysApart: 1 }, '5 Oct next to 6 Oct is flagged as a likely mistake');
}

group('Prompt 4 · Correction (5 Oct logged by mistake → 6 Oct)');
{
  const wrong = applyPeriodLog(logs('2026-09-05'), '2026-10-05', '2026-10-07').logs;
  const fixed = applyPeriodCorrection(wrong, '2026-10-05', '2026-10-06', '2026-10-07');
  eq(fixed.result, { kind: 'replaced', replaced: '2026-10-05' }, 'replaced');
  eq(fixed.logs.map((l) => l.start), ['2026-09-05', '2026-10-06'], 'old date gone, no duplicate');
  eq(est(B(28, 5), fixed.logs, '2026-10-07').currentCycleDay, 2, 'cycle day recalculated (7 Oct = day 2)');
}

group('Prompt 4 · TEST F  History');
{
  const h = logs('2026-09-05', '2026-10-06', '2026-11-04');
  eq(completedCycles(h).map((c) => c.length), [31, 29], 'completed cycles 31 and 29 days');
  eq(h.length, 3, 'all three records kept');
  const e = est(B(28, 5), h, '2026-11-10');
  eq([e.lengthSource, e.cycleLengthUsed], ['history', 30], 'two real cycles → predictions use her history (30)');
  eq(est(B(35, 5), h, '2026-11-10').cycleLengthUsed, 30, 'baseline setting does not overwrite observed history');
  eq(marked(2026, 10, h, e, '2026-11-10', 'isPredictedPeriod').filter((d) => d < 4), [], 'no stale November prediction before the logged 4 Nov');
}

group('Prompt 4 · Year boundary');
{
  const r = applyPeriodLog(logs('2026-12-10'), '2027-01-08', '2027-01-08');
  eq(r.result, { kind: 'added', completedCycle: 29 }, '10 Dec → 8 Jan = 29 days');
}

group('Prompt 5 · Current cycle: logged 3 Oct, 28 days, 5-day period');
{
  const l = logs('2026-10-03');
  const e = est(B(28, 5), l, '2026-10-17');
  const oct = buildCalendarMonth(2026, 9, l, e, [], '2026-10-17');
  const cd = (d: number) => oct.find((c) => c.isCurrentMonth && c.day === d)!.cycleDay;
  eq([cd(3), cd(4), cd(16), cd(17), cd(30)], [1, 2, 14, 15, 28], 'Oct 3 = CD1 … Oct 17 = CD15 … Oct 30 = CD28');
  eq(cd(31), 29, 'Oct 31 is CD29 until a period is actually logged');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isPeriod'), [3], 'only 3 Oct is confirmed');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isPredictedPeriod'), [4, 5, 6, 7, 31], '4–7 Oct estimated, 31 Oct predicted');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isFertile'), [12, 13, 14, 15, 16, 17], 'fertile 12–17 Oct (no 18th)');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isOvulation'), [17], 'estimated ovulation 17 Oct');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isToday'), [17], 'today marked from the local date given');
  const h = getHomeSummary(viva(B(28, 5), l), '2026-10-17');
  eq([h.cycleDay, h.nextPeriodText, h.ovulationText], [cd(17), 'Expected 31 Oct 2026', '17 Oct 2026'], 'Home agrees with Calendar');
}

group('Prompt 5 · Logged end date is shown as confirmed (29 Dec – 2 Jan)');
{
  const l: PeriodLog[] = [{ start: '2026-12-29', end: '2027-01-02' }];
  const e = est(B(28, 5), l, '2027-01-05');
  eq(marked(2026, 11, l, e, '2027-01-05', 'isPeriod'), [29, 30, 31], 'December 29–31 confirmed');
  eq(marked(2027, 0, l, e, '2027-01-05', 'isPeriod'), [1, 2], 'January 1–2 confirmed: one continuous event');
  eq(cycleDayOn(l, '2027-01-01', '2027-01-05'), 4, 'cycle day carries across New Year (1 Jan = CD4)');
}

group('Prompt 5 · Navigating months never resets the cycle');
{
  const l = logs('2026-10-03');
  const e = est(B(28, 5), l, '2026-10-17');
  const nov = buildCalendarMonth(2026, 10, l, e, [], '2026-10-17');
  eq(nov.find((c) => c.isCurrentMonth && c.day === 1)!.cycleDay, 30, '1 Nov is CD30, not CD1');
  eq(marked(2026, 7, l, e, '2026-10-17', 'isPeriod'), [], 'August: no invented history before the first log');
  eq(buildCalendarMonth(2026, 7, l, e, [], '2026-10-17').every((c) => c.cycleDay === null), true, 'August: no cycle days before the first log');
  eq(marked(2026, 10, l, e, '2026-10-17', 'isPredictedPeriod').slice(0, 3), [1, 2, 3], 'November: predicted 1–3 (end of 31 Oct period)');
  eq(marked(2026, 10, l, e, '2026-10-17', 'isPeriod'), [], 'November: nothing confirmed in the future');
}

group('Prompt 5 · Months, years and leap years');
{
  const months: [number, number][] = [[2026, 7], [2026, 8], [2026, 9], [2026, 10], [2026, 11], [2027, 0], [2027, 1], [2028, 1], [2028, 2]];
  const sizes = months.map(([y, m]) => buildCalendarMonth(y, m, [], null, [], '2026-10-17').filter((c) => c.isCurrentMonth).length);
  eq(sizes, [31, 30, 31, 30, 31, 31, 28, 29, 31], 'Aug–Dec 2026, Jan–Feb 2027, Feb–Mar 2028 have the right number of days');
  const grids = months.map(([y, m]) => buildCalendarMonth(y, m, [], null, [], '2026-10-17'));
  eq(grids.every((g) => g.length % 7 === 0), true, 'every month grid is whole weeks');
  const lf = logs('2028-02-10');
  const ef = est(B(28, 5), lf, '2028-02-20');
  eq(ef.estimatedNextPeriod, '2028-03-09', 'Feb 2028 (leap) → next period 9 Mar');
  eq(cycleDayOn(lf, '2028-02-29', '2028-02-20'), 20, '29 Feb 2028 exists and is CD20');
  eq(cycleDayOn(lf, '2028-03-01', '2028-02-20'), 21, '1 Mar 2028 = CD21');
  eq(cycleDayOn(logs('2027-02-10'), '2027-03-01', '2027-02-20'), 20, '1 Mar 2027 = CD20 (no 29 Feb)');
}

group('Prompt 5 · Late, early and missed periods on the Calendar');
{
  const late = logs('2026-09-05', '2026-10-06');
  const eL = est(B(28, 5), late, '2026-10-08');
  eq(marked(2026, 9, late, eL, '2026-10-08', 'isPeriod'), [6], 'late: 6 Oct confirmed');
  eq(marked(2026, 9, late, eL, '2026-10-08', 'isPredictedPeriod').filter((d) => d < 6), [], 'late: no 3–5 Oct prediction left');
  eq(cycleDayOn(late, '2026-10-08', '2026-10-08'), 3, 'late: 8 Oct = CD3');
  const early = logs('2026-09-05', '2026-09-30');
  const eE = est(B(28, 5), early, '2026-10-02');
  eq(marked(2026, 9, early, eE, '2026-10-02', 'isPredictedPeriod').filter((d) => d <= 7), [1, 2, 3, 4], 'early: Oct shows only the 30 Sep period (1–4 estimated), no old 3–7 prediction');
  eq(eE.estimatedNextPeriod, '2026-10-28', 'early: next predicted from 30 Sep');
  const missed = logs('2026-10-03');
  const eM = est(B(28, 5), missed, '2026-11-02');
  eq(marked(2026, 9, missed, eM, '2026-11-02', 'isPeriod'), [3], 'missed: 31 Oct is NOT confirmed');
  eq(marked(2026, 9, missed, eM, '2026-11-02', 'isPredictedPeriod').includes(31), true, '31 Oct stays a prediction');
  eq(eM.currentCycleStart, '2026-10-03', 'cycle stays anchored to 3 Oct');
  eq(cycleDayOn(missed, '2026-11-02', '2026-11-02'), 31, '2 Nov = CD31 (no automatic reset)');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed === 0 ? 0 : 1;
