// VIVA Cycle — engine, calendar and Home tests (no phone needed)
// Run with:  npx tsx tests/cycleEngine.test.ts
// Other time zones:  TZ=Africa/Kampala npx tsx tests/cycleEngine.test.ts
import './support/securityFakes'; // phone security modules (Keychain, AES-GCM) for Node
import {
  addDays, applyPeriodCorrection, applyPeriodLog, applyPeriodRemoval, calculateCycle, completedCycles, cycleDayOn,
  CycleBaseline, diffDays, PeriodLog, Regularity,
} from '../lib/cycleEngine';
import { buildCalendarMonth } from '../constants/calendarModel';
import { dateToKey, isValidDateKey, keyToLocalDate } from '../constants/dateUtils';
import { getHomeSummary } from '../constants/homeData';
import { buildCycleRecords } from '../constants/insightsData';
import { calculateCycleRegularity } from '../constants/insightsCalc';
import { getProfileStats } from '../constants/profileData';
import type { VivaState } from '../lib/vivaStore';
import { planReminders, REMINDER_KEYS } from '../lib/reminders';

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
  loaded: true, loadError: false, version: 1, setupComplete: true, name: 'Sarah', dateOfBirth: null,
  baseline: b, goal: 'conceive', periods: l, dailyLogs: {}, reminders: {}, discreetNotifications: true,
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
  eq(e.estimatedOvulation, '2026-09-18', 'estimated ovulation 18 Sep (CD14)');
  eq(e.estimatedFertileWindow, { start: '2026-09-13', end: '2026-09-18' }, 'fertile window 13–18 Sep (6 days)');
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
  eq(marked(2026, 8, l, e, '2026-09-26', 'isFertile'), [13, 14, 15, 16, 17, 18], 'September: fertile 13–18');
  eq(marked(2026, 8, l, e, '2026-09-26', 'isOvulation'), [18], 'September: ovulation 18');
  eq(marked(2026, 9, l, e, '2026-09-26', 'isPredictedPeriod'), [3, 4, 5, 6, 7, 31], 'October: predicted 3–7 and 31');
}

group('Home matches the engine');
{
  const h = getHomeSummary(viva(B(28, 5), logs('2026-09-05')), '2026-09-26');
  eq(h.cycleDay, 22, 'cycle day 22');
  eq(h.nextPeriodText, 'Expected 3 Oct 2026', 'next period text');
  eq(h.fertileRange, '13 Sep – 18 Sep 2026', 'fertile range text');
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
  eq(marked(2026, 9, l, e, '2026-10-17', 'isFertile'), [11, 12, 13, 14, 15, 16], 'fertile 11–16 Oct (6 days, nothing after ovulation)');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isOvulation'), [16], 'estimated ovulation 16 Oct (CD14)');
  eq(marked(2026, 9, l, e, '2026-10-17', 'isToday'), [17], 'today marked from the local date given');
  const h = getHomeSummary(viva(B(28, 5), l), '2026-10-17');
  eq([h.cycleDay, h.nextPeriodText, h.ovulationText], [cd(17), 'Expected 31 Oct 2026', '16 Oct 2026'], 'Home agrees with Calendar');
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

group('Ovulation = cycle day (cycle length − 14)');
{
  for (const [len, day] of [[21, 7], [28, 14], [30, 16], [35, 21]] as const) {
    const l = logs('2026-10-03');
    const e = est(B(len, 5), l, '2026-10-03');
    eq(cycleDayOn(l, e.estimatedOvulation, '2026-10-03'), day, len + '-day cycle → estimated ovulation on CD' + day);
    eq(diffDays(e.estimatedNextPeriod, e.estimatedOvulation) - 1, 14, len + '-day cycle → 14-day luteal phase');
  }
}

group('Prompt 6 · Example: logged 3 Oct, 28 days, 5-day period');
{
  const l = logs('2026-10-03');
  const e = est(B(28, 5), l, '2026-10-10');
  eq(e.estimatedOvulation, '2026-10-16', 'estimated ovulation 16 Oct (CD14, agreed rule)');
  eq(e.estimatedFertileWindow, { start: '2026-10-11', end: '2026-10-16' }, 'estimated fertile window 11–16 Oct (6 days)');
  eq(e.ovulationIsVariable, false, 'regular stated cycle → single date');
  eq(e.fertileWindowStatus, 'upcoming', '10 Oct: window upcoming');
  eq(est(B(28, 5), l, '2026-10-13').fertileWindowStatus, 'current', '13 Oct: window current');
  const after = est(B(28, 5), l, '2026-10-20');
  eq(after.fertileWindowStatus, 'passed', '20 Oct: window passed');
  eq(after.estimatedOvulation, '2026-10-16', 'after the date it is still the SAME estimate (never converted to confirmed)');
  eq(after.upcomingFertileWindow, { start: '2026-11-08', end: '2026-11-13' }, 'next estimated window 8–13 Nov');
  const h = getHomeSummary(viva(B(28, 5), l), '2026-10-20');
  const text = JSON.stringify(h).toLowerCase();
  eq(/safe day|confirmed ovulation|ovulation occurred|cannot get pregnant|definitely/.test(text), false, 'no unsafe or certain wording on Home');
}

group('Prompt 6 · Variable cycle 27, 31, 28, 30');
{
  const l = logs('2026-06-01', '2026-06-28', '2026-07-29', '2026-08-26', '2026-09-25');
  eq(completedCycles(l).map((c) => c.length), [27, 31, 28, 30], 'history read correctly');
  const e = est(B(28, 5, 'regular'), l, '2026-10-01');
  eq([e.lengthSource, e.cycleLengthUsed], ['history', 29], 'uses her average: 29 days');
  eq(e.estimatedNextPeriod, '2026-10-24', 'next period 24 Oct');
  eq(e.estimatedOvulation, '2026-10-09', 'estimated ovulation 9 Oct (CD15 = 29 − 14)');
  eq(e.ovulationIsVariable, true, 'variation shown, even though she said "regular"');
  eq(e.ovulationRange, { start: '2026-10-07', end: '2026-10-11' }, 'shown as around 7–11 Oct (±2 from her own variation)');
  const h = getHomeSummary(viva(B(28, 5), l), '2026-10-01');
  eq(h.ovulationText, 'Around 7 Oct – 11 Oct 2026', 'Home shows the range');
  eq(h.confidenceNote.includes('range'), true, 'Home explains why it is a range');
}

group('Prompt 6 · Stated regularity without history');
{
  const l = logs('2026-10-03');
  eq(est(B(28, 5, 'regular'), l, '2026-10-05').ovulationIsVariable, false, 'regular → single date');
  const ir = est(B(28, 5, 'irregular'), l, '2026-10-05');
  eq([ir.ovulationIsVariable, ir.ovulationRange.start, ir.ovulationRange.end], [true, '2026-10-09', '2026-10-23'], 'irregular → around 9–23 Oct (±7)');
  eq(est(B(null, 5, 'not_sure'), l, '2026-10-05').ovulationIsVariable, true, '"Not sure" → range');
  eq(ir.estimatedFertileWindow, { start: '2026-10-11', end: '2026-10-16' }, 'fertile window itself is not widened (no extra days added)');
}

group('Prompt 6 · Outlier cycle (28, 29, 27, 45, 28) — current behaviour, documented');
{
  const l = logs('2026-03-01', '2026-03-29', '2026-04-27', '2026-05-24', '2026-07-08', '2026-08-05');
  const e = est(B(28, 5), l, '2026-08-10');
  eq(e.cycleLengthUsed, 31, 'mean is pulled up to 31 by the single 45-day cycle (no outlier handling yet)');
  eq(e.ovulationIsVariable, true, 'but the wide variation is flagged, so ovulation is shown as a range');
}

group('Prompt 6 · Goal change never changes dates');
{
  const l = logs('2026-10-03');
  const a = getHomeSummary({ ...viva(B(28, 5), l), goal: 'conceive' }, '2026-10-13');
  const b = getHomeSummary({ ...viva(B(28, 5), l), goal: 'avoid' }, '2026-10-13');
  const c = getHomeSummary({ ...viva(B(28, 5), l), goal: 'understand' }, '2026-10-13');
  const d = getHomeSummary({ ...viva(B(28, 5), l), goal: 'track' }, '2026-10-13');
  const dates = (x: typeof a) => [x.cycleDay, x.fertileRange, x.ovulationText, x.nextPeriodText];
  eq(dates(b), dates(a), 'conceive → avoid: identical dates');
  eq(dates(c), dates(a), 'understand: identical dates');
  eq(a.goalNote !== b.goalNote, true, 'guidance wording differs by goal');
  eq((b.goalNote ?? '').includes('should not be your only method of contraception'), true, 'avoid: contraception caveat');
  eq((a.goalNote ?? '').includes('never guaranteed'), true, 'conceive: no promise of pregnancy');
  eq(d.goalNote, null, 'track: no conception/contraception emphasis');
  eq(JSON.stringify(l), JSON.stringify(logs('2026-10-03')), 'confirmed periods untouched');
}

group('Prompt 6 · Avoid: caveat on every phase, never "safe"');
{
  const l = logs('2026-10-03');
  for (const day of ['2026-10-04', '2026-10-08', '2026-10-13', '2026-10-20', '2026-10-29']) {
    const g = getHomeSummary({ ...viva(B(28, 5), l), goal: 'avoid' }, day).goalNote ?? '';
    eq(g.includes('only method of contraception') && !/safe/i.test(g), true, day + ': cautious, no "safe"');
  }
}

group('Prompt 6 · New period re-anchors all fertility estimates');
{
  const before = est(B(28, 5), logs('2026-10-03'), '2026-10-06');
  const r = applyPeriodLog(logs('2026-10-03'), '2026-10-06', '2026-10-06');
  eq(r.result.kind, 'tooClose', 'logging 6 Oct three days after 3 Oct asks to correct it (Prompt 4 rule)');
  const fixed = applyPeriodCorrection(logs('2026-10-03'), '2026-10-03', '2026-10-06', '2026-10-06').logs;
  const after = est(B(28, 5), fixed, '2026-10-06');
  eq([before.estimatedOvulation, after.estimatedOvulation], ['2026-10-16', '2026-10-19'], 'ovulation 16 Oct → 19 Oct');
  eq(after.estimatedFertileWindow, { start: '2026-10-14', end: '2026-10-19' }, 'new window 14–19 Oct; no stale 16 Oct estimate');
  const nextCycle = applyPeriodLog(logs('2026-09-05'), '2026-10-06', '2026-10-06').logs;
  eq(est(B(28, 5), nextCycle, '2026-10-06').estimatedOvulation, '2026-10-19', 'late period (5 Sep → 6 Oct): ovulation recalculated from 6 Oct');
}

group('Prompt 7 · TEST A + E  Cycle length 28 → 30 (logged 6 Oct, today 15 Oct)');
{
  const l = logs('2026-10-06');
  const before = JSON.stringify(l);
  const e28 = est(B(28, 5), l, '2026-10-15');
  const e30 = est(B(30, 5), l, '2026-10-15');
  eq([e28.estimatedNextPeriod, e30.estimatedNextPeriod], ['2026-11-03', '2026-11-05'], 'next period 3 Nov → 5 Nov');
  eq([e28.estimatedOvulation, e30.estimatedOvulation], ['2026-10-19', '2026-10-21'], 'estimated ovulation follows (CD14 → CD16)');
  eq([e28.estimatedFertileWindow.start, e30.estimatedFertileWindow.start], ['2026-10-14', '2026-10-16'], 'fertile window follows');
  eq([e28.currentCycleDay, e30.currentCycleDay], [10, 10], '15 Oct stays CD10');
  eq([e28.currentCycleStart, e30.currentCycleStart], ['2026-10-06', '2026-10-06'], 'current cycle start unchanged');
  eq(JSON.stringify(l), before, 'confirmed period untouched');
}

group('Prompt 7 · TEST B  Period duration 5 → 6');
{
  const past: PeriodLog[] = [{ start: '2026-10-03', end: '2026-10-07' }, { start: '2026-10-31' }];
  const e5 = est(B(28, 5), past, '2026-11-02');
  const e6 = est(B(28, 6), past, '2026-11-02');
  eq(marked(2026, 9, past, e6, '2026-11-02', 'isPeriod').filter((d) => d < 10), [3, 4, 5, 6, 7], 'logged 3–7 Oct stays 3–7 (not 3–8)');
  eq([e5.estimatedPeriodWindow.end, e6.estimatedPeriodWindow.end], ['2026-12-02', '2026-12-03'], 'future predicted period: 5 → 6 days');
  const noEnd = logs('2026-09-05', '2026-10-03');
  const a = buildCalendarMonth(2026, 8, noEnd, est(B(28, 5), noEnd, '2026-10-05'), [], '2026-10-05');
  const b = buildCalendarMonth(2026, 8, noEnd, est(B(28, 8), noEnd, '2026-10-05'), [], '2026-10-05');
  const sep = (m: typeof a) => m.filter((c) => c.isCurrentMonth && (c.isPeriod || c.isPredictedPeriod)).map((c) => c.day);
  eq([sep(a), sep(b)], [[5], [5]], 'a PAST period without an end date is not repainted by Settings');
}

group('Prompt 7 · TEST C  Regularity regular → often irregular');
{
  const l = logs('2026-10-06');
  const r = est(B(28, 5, 'regular'), l, '2026-10-10');
  const i = est(B(28, 5, 'irregular'), l, '2026-10-10');
  eq([r.estimatedNextPeriod, i.estimatedNextPeriod], ['2026-11-03', '2026-11-03'], 'same estimated dates');
  eq([r.ovulationIsVariable, i.ovulationIsVariable], [false, true], 'irregular shows ovulation as a range');
  eq([r.nextPeriodRange.end, i.nextPeriodRange.end], ['2026-11-05', '2026-11-10'], 'wider uncertainty range');
}

group('Prompt 7 · TEST D  Goal change (both directions)');
{
  const l = logs('2026-09-05', '2026-10-06');
  const s1 = getHomeSummary({ ...viva(B(28, 5), l), goal: 'conceive' }, '2026-10-15');
  const s2 = getHomeSummary({ ...viva(B(28, 5), l), goal: 'avoid' }, '2026-10-15');
  const s3 = getHomeSummary({ ...viva(B(28, 5), l), goal: 'conceive' }, '2026-10-15');
  const core = (x: typeof s1) => [x.cycleDay, x.nextPeriodText, x.ovulationText, x.fertileRange];
  eq([core(s2), core(s3)], [core(s1), core(s1)], 'conceive → avoid → conceive: identical cycle data');
  eq(s1.goalNote === s2.goalNote, false, 'only the guidance changes');
  eq(completedCycles(l).map((c) => c.length), [31], 'history still 31 days');
}

group('Prompt 7 · TEST F + section 14/21  History never changes with Settings');
{
  const h = logs('2026-08-09', '2026-09-05', '2026-10-06', '2026-11-04');
  const snap = JSON.stringify(h);
  const recA = buildCycleRecords(h).map((r) => r.cycleLength);
  for (const len of [28, 30, 32]) est(B(len, 5), h, '2026-11-10');
  eq(JSON.stringify(h), snap, 'dates exactly the same after 28 / 30 / 32');
  eq(recA, [27, 31, 29], 'observed cycles 27, 31, 29 days (Insights records)');
  eq(buildCycleRecords(h).map((r) => r.cycleLength), recA, 'Insights records unchanged by Settings');
  const three = logs('2026-10-06', '2026-11-04', '2026-12-03');
  eq(completedCycles(three).map((c) => c.length), [29, 29], 'Oct 6 / Nov 4 / Dec 3 → 29 and 29 days');
  eq(est(B(30, 5), three, '2026-12-05').cycleLengthUsed, 29, '2+ real cycles: predictions use her 29, not the 30 setting');
  eq(getProfileStats(h), { cyclesTracked: 3, averageCycle: '29 days', averagePeriod: '–' }, 'Profile stats from real history');
}

group('Prompt 7 · Unknown baseline, then known (section 8, 20, 22)');
{
  const l = logs('2026-10-06');
  const unknown = est(B(null, 5, 'not_sure'), l, '2026-10-10');
  eq([unknown.lengthSource, unknown.cycleLengthUsed], ['default', 28], 'unknown: 28 used as a labelled fallback');
  const h = getHomeSummary(viva(B(null, 5, 'not_sure'), l), '2026-10-10');
  eq(h.confidenceNote.includes('Not sure'), true, 'Home says it is an assumption, not her value');
  const known = est(B(31, 5, 'regular'), l, '2026-10-10');
  eq([known.lengthSource, known.estimatedNextPeriod], ['baseline', '2026-11-06'], 'later entered 31 → used, next 6 Nov');
  eq(buildCycleRecords(l).length, 0, 'no fake historical cycles from onboarding LMP alone');
}

group('Prompt 8 fixes · Late period (M1, M2)');
{
  const l = logs('2026-10-03');
  const e = est(B(28, 5), l, '2026-11-10');
  eq([e.isLate, e.upcomingFertileWindow], [true, null], 'late: no next-window estimate (matches the Calendar)');
  const cal = buildCalendarMonth(2026, 10, l, e, [], '2026-11-10').filter((c) => c.isCurrentMonth && c.isFertile).length;
  eq(cal, 0, 'Calendar also shows no November window');
  const avoid = getHomeSummary({ ...viva(B(28, 5), l), goal: 'avoid' }, '2026-11-10').goalNote ?? '';
  eq([/lower/i.test(avoid), avoid.includes('pregnancy may still be possible'), avoid.includes('only method of contraception')], [false, true, true], 'avoid + late: never "lower", says pregnancy may be possible');
  const conceive = getHomeSummary({ ...viva(B(28, 5), l), goal: 'conceive' }, '2026-11-10').goalNote ?? '';
  eq([/\d+ (Nov|Dec)/.test(conceive), conceive.includes('uncertain')], [false, true], 'conceive + late: no window date, timing uncertain');
  eq(est(B(28, 5), l, '2026-10-20').upcomingFertileWindow, { start: '2026-11-08', end: '2026-11-13' }, 'not late: next window still shown');
}

group('Prompt 8 fixes · Insights uses the engine rules (M5, M6)');
{
  const gap = logs('2026-01-01', '2026-01-29', '2026-05-09', '2026-06-06');
  eq(buildCycleRecords(gap).map((r) => r.cycleLength), [28, 28], '100-day logging gap left out (engine rule 15–90)');
  const v = logs('2026-03-01', '2026-03-28', '2026-04-28', '2026-05-26', '2026-06-25', '2026-07-21');
  const ev = est(B(28, 5), v, '2026-07-25');
  eq([ev.ovulationIsVariable, calculateCycleRegularity(buildCycleRecords(v)).label], [true, 'Somewhat irregular'], '27/31/28/30/26: Insights no longer says "regular" while Home shows a range');
  const r = logs('2026-03-01', '2026-03-29', '2026-04-26', '2026-05-24');
  eq([est(B(28, 5), r, '2026-05-30').ovulationIsVariable, calculateCycleRegularity(buildCycleRecords(r)).label], [false, 'Regular'], '28/28/28: both say regular');
}

group('Period history · edit and delete (M3)');
{
  const h = logs('2026-09-05', '2026-10-06', '2026-11-04');
  const moved = applyPeriodCorrection(h, '2026-10-06', '2026-10-25', '2026-11-10');
  eq(moved.result, { kind: 'tooClose', existing: '2026-11-04', daysApart: 10 }, 'editing 6 Oct → 25 Oct is refused (too close to 4 Nov); nothing replaced');
  eq(moved.logs.map((l) => l.start), ['2026-09-05', '2026-10-06', '2026-11-04'], 'history untouched after a refused edit');
  const ok = applyPeriodCorrection(h, '2026-10-06', '2026-10-09', '2026-11-10');
  eq([ok.result.kind, ok.logs.map((l) => l.start)], ['replaced', ['2026-09-05', '2026-10-09', '2026-11-04']], 'edit 6 Oct → 9 Oct');
  eq(completedCycles(ok.logs).map((c) => c.length), [34, 26], 'cycle lengths follow the edit');
  const del = applyPeriodRemoval(h, '2026-10-06');
  eq([del.result.kind, del.logs.map((l) => l.start)], ['removed', ['2026-09-05', '2026-11-04']], 'delete 6 Oct; others untouched');
  eq(est(B(28, 5), del.logs, '2026-11-10').currentCycleStart, '2026-11-04', 'current cycle unchanged after deleting an old one');
  const delLatest = applyPeriodRemoval(h, '2026-11-04');
  eq(est(B(28, 5), delLatest.logs, '2026-11-10').currentCycleStart, '2026-10-06', 'deleting the latest re-anchors to the previous one');
  eq(applyPeriodRemoval(logs('2026-10-06'), '2026-10-06').result.kind, 'lastOne', 'the only period cannot be deleted');
  eq(applyPeriodRemoval(h, '2026-12-01').result.kind, 'notFound', 'unknown date: nothing happens');
}

group('Reminders · planned from the engine, worded as estimates');
{
  const base = (rem: Record<string, boolean>, goal: any = 'track', l = logs('2026-10-03')) =>
    ({ baseline: B(28, 5), periods: l, goal, reminders: rem });
  eq(planReminders(base({}), '2026-10-10').length, 0, 'all switches off → nothing scheduled');
  const p = planReminders(base({ period: true }), '2026-10-10');
  eq(p.map((r) => r.trigger), [
    { kind: 'date', date: '2026-10-29', hour: 9, minute: 0 },
    { kind: 'date', date: '2026-11-26', hour: 9, minute: 0 },
    { kind: 'date', date: '2026-12-24', hour: 9, minute: 0 },
  ], 'period: 2 days before each of the next 3 estimated periods (31 Oct, 28 Nov, 26 Dec)');
  const f = planReminders(base({ fertile: true, ovulation: true }), '2026-10-10');
  eq(f.filter((r) => r.key === 'fertile').map((r) => (r.trigger as any).date), ['2026-11-07', '2026-12-05'],
    'fertile: day before each window (this cycle\'s 11 Oct already passed)');
  eq(f.filter((r) => r.key === 'ovulation').map((r) => (r.trigger as any).date), ['2026-10-15', '2026-11-12', '2026-12-10'],
    'ovulation: day before each estimated ovulation (16 Oct, 13 Nov, 11 Dec)');
  const avoid = planReminders(base({ fertile: true, ovulation: true }, 'avoid'), '2026-10-10');
  eq(avoid.every((r) => r.body.includes('not contraception') && !/safe/i.test(r.title + r.body)), true, 'avoid: every cycle reminder says not contraception, never "safe"');
  eq(f.filter((r) => r.key === 'ovulation').every((r) => r.body.includes('not a confirmed event')), true, 'ovulation reminders say estimate, not confirmed');
  const all = planReminders(base(Object.fromEntries(REMINDER_KEYS.map((k) => [k, true]))), '2026-10-10');
  eq(all.filter((r) => r.trigger.kind === 'date').every((r) => (r.trigger as any).date > '2026-10-10'), true, 'nothing scheduled in the past');
  eq(new Set(all.map((r) => r.id)).size, all.length, 'no duplicate reminders');
  eq(all.length <= 60, true, 'stays under the iOS limit of 64 scheduled notifications (' + all.length + ')');
  eq(all.filter((r) => r.key === 'water').length, 3, 'water: 3 times a day');
  eq(all.filter((r) => r.key === 'tips').map((r) => new Date((r.trigger as any).date + 'T12:00:00Z').getUTCDay()), [1, 1, 1, 1, 1, 1, 1, 1], 'tips: 8, each on a Monday');
  const late = planReminders(base({ period: true, fertile: true, ovulation: true }), '2026-11-10');
  eq(late.length, 0, 'period late → no cycle reminders (dates unknown)');
  const after = planReminders(base({ period: true }, 'track', logs('2026-10-03', '2026-11-08')), '2026-11-10');
  eq((after[0].trigger as any).date, '2026-12-04', 'after logging 8 Nov, reminders follow the new cycle (6 Dec period)');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed === 0 ? 0 : 1;
