// Run with:  npx tsx tests/cycleEngine.test.ts
// Optionally with a different time zone:  TZ=Africa/Kampala npx tsx tests/cycleEngine.test.ts
import { getBaseline } from '../constants/baseline';
import {
  calculateCycleDay,
  estimateCycle,
} from '../constants/cycleEngine';
import { getCycleLog, logPeriodStart } from '../constants/cycleStore';
import { addDays, dateToKey, dayDiff, isValidDateKey, keyToLocalDate } from '../constants/dateUtils';
import { addPeriod, completedCycleLengths, PeriodEntry } from '../constants/periodHistory';
import { getHomeSummary } from '../constants/homeData';
import { getSettings, updateSettings } from '../constants/settingsStore';

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

function group(name: string) {
  console.log('\n' + name);
}

const confirmed = (dates: string[]): PeriodEntry[] => dates.map((date) => ({ date, source: 'confirmed' as const }));

console.log('Time zone: ' + (process.env.TZ ?? 'system default'));

group('TEST 1  LMP 5 Sep, 28-day cycle, 5-day period');
{
  const e = estimateCycle(confirmed(['2026-09-05']), 5, '2026-09-20', 28);
  eq(e.nextPeriod, '2026-10-03', 'next period is 3 Oct');
  eq(e.ovulation, '2026-09-19', 'estimated ovulation is 19 Sep');
  eq(e.fertileWindow, { start: '2026-09-14', end: '2026-09-19' }, 'fertile window is 14-19 Sep');
  eq(e.predictedPeriod, { start: '2026-10-03', end: '2026-10-07' }, 'predicted period is 3-7 Oct');
}

group('TEST 2  completed cycle lengths');
{
  const periods = confirmed(['2026-08-09', '2026-09-05', '2026-10-03', '2026-10-31', '2026-11-28', '2026-12-26']);
  eq(completedCycleLengths(periods), [27, 28, 28, 28, 28], 'lengths are 27, 28, 28, 28, 28');
  const e = estimateCycle(periods, 5, '2026-12-30', 30);
  eq(e.lengthSource, 'history', '6 confirmed periods: history wins over the usual length');
  eq(e.expectedCycleLength, 28, 'expected cycle length is 28 (average of history)');
}

group('TEST 3  cycle day');
{
  const e = estimateCycle(confirmed(['2026-10-03']), 5, '2026-10-17', 28);
  eq(e.cycleDay, 15, '3 Oct = CD1, so 17 Oct = CD15');
  eq(calculateCycleDay('2026-09-05', '2026-09-05'), 1, '5 Sep is CD1');
  eq(calculateCycleDay('2026-09-05', '2026-09-07'), 3, '7 Sep is CD3');
}

group('TEST 4  predicted 3-7 Oct, user logs 6 Oct');
{
  const before = confirmed(['2026-09-05']);
  const predicted = estimateCycle(before, 5, '2026-10-01', 28).predictedPeriod;
  eq(predicted, { start: '2026-10-03', end: '2026-10-07' }, 'prediction was 3-7 Oct');
  const after = addPeriod(before, '2026-10-06', { flowIntensity: 'medium' });
  eq(after.outcome, 'added', 'logging 6 Oct is a new confirmed period');
  eq(after.periods.map((p) => p.date), ['2026-09-05', '2026-10-06'], 'history is 5 Sep and 6 Oct only');
  eq(after.periods.some((p) => p.date === '2026-10-03'), false, 'the predicted 3 Oct was never stored');
  const e = estimateCycle(after.periods, 5, '2026-10-06', 28);
  eq(e.cycleStart, '2026-10-06', '6 Oct becomes the cycle anchor');
  eq(e.cycleDay, 1, '6 Oct is CD1');
  eq(e.nextPeriod, '2026-11-03', 'next prediction restarts from 6 Oct');
}

group('TEST 5  predicted period passes, nothing logged');
{
  const history = confirmed(['2026-09-05']);
  const e = estimateCycle(history, 5, '2026-10-12', 28);
  eq(history.length, 1, 'no confirmed period was created');
  eq(e.cycleStart, '2026-09-05', 'cycle anchor is still the last CONFIRMED period');
  eq(e.periodLateDays, 9, 'the period is reported as 9 days late');
  eq(e.cycleDay, 38, 'cycle day keeps counting from 5 Sep');
}

group('TEST 6  settings change does not touch history');
{
  const history = confirmed(['2026-09-05', '2026-10-03', '2026-10-31']);
  const snapshot = JSON.stringify(history);
  const at28 = estimateCycle(history, 5, '2026-11-05', 28);
  const at30 = estimateCycle(history, 5, '2026-11-05', 30);
  eq(JSON.stringify(history), snapshot, 'history is unchanged by running estimates');
  eq(at28.nextPeriod, '2026-11-28', 'usual 28: next period 28 Nov');
  eq(at30.nextPeriod, '2026-11-30', 'usual 30: next period 30 Nov (future prediction changes)');
  eq(completedCycleLengths(history), [28, 28], 'completed cycle lengths stay 28, 28');
}

group('Unknown cycle length is not forced');
{
  const e = estimateCycle(confirmed(['2026-09-05']), 5, '2026-09-20', null);
  eq(e.lengthSource, 'default', 'unknown length is reported as a default, not as the user\'s value');
  eq(e.basis, 'assumed', 'basis is assumed');
  eq(e.expectedCycleLength, 28, 'a 28-day default is used for the estimate');
  const none = estimateCycle([], 5, '2026-09-20', 30);
  eq(none.status, 'unknown', 'no confirmed periods: status is unknown');
  eq(none.nextPeriod, null, 'no confirmed periods: no prediction');
}

group('Duplicate period records');
{
  let periods = confirmed(['2026-08-09', '2026-09-05']);
  const same = addPeriod(periods, '2026-09-05', { flowIntensity: 'heavy' });
  eq(same.outcome, 'updated', 'logging the same day again updates it');
  eq(same.periods.length, 2, '...and still 2 records');
  eq(same.periods[1].flowIntensity, 'heavy', '...with the new flow saved');
  periods = same.periods;
  const near = addPeriod(periods, '2026-09-08');
  eq(near.outcome, 'merged', 'a start 3 days later is merged, not duplicated');
  eq(near.periods.map((p) => p.date), ['2026-08-09', '2026-09-05'], '...and the earlier start wins');
  const earlier = addPeriod(periods, '2026-09-03');
  eq(earlier.periods.map((p) => p.date), ['2026-08-09', '2026-09-03'], 'logging an earlier true start moves it back');
  eq(earlier.periods[1].flowIntensity, 'heavy', '...and keeps the details already saved');
}

group('Store: logging does not rewrite history');
{
  const start = getCycleLog().periods.map((p) => p.date);
  eq(start, ['2026-08-09', '2026-09-05'], 'store starts with the 2 demo confirmed periods');
  eq(logPeriodStart('2026-10-06', 'medium'), 'added', 'logging 6 Oct is added');
  eq(logPeriodStart('2026-10-06', 'heavy'), 'updated', 'logging 6 Oct again is an update');
  eq(logPeriodStart('2026-10-04'), 'merged', 'logging 4 Oct merges into the same period');
  eq(getCycleLog().periods.map((p) => p.date), ['2026-08-09', '2026-09-05', '2026-10-04'], 'history has 3 records, no duplicates');
  eq(getCycleLog().periods.every((p) => p.source === 'confirmed'), true, 'every record is marked confirmed');
}

group('Baseline and settings');
{
  const b = getBaseline();
  eq(b.lastPeriodStartDate, '2026-10-04', 'last period start is the latest confirmed period');
  eq(b.usualCycleLength, null, 'usual cycle length is unknown by default');
  const historyBefore = JSON.stringify(getCycleLog().periods);
  updateSettings({ cycleLength: 30, periodLength: 6, cycleRegularity: 'irregular' });
  eq(getBaseline().usualCycleLength, 30, 'baseline picks up the new usual length');
  eq(getSettings().cycleLength, 30, 'settings store holds the new value');
  eq(JSON.stringify(getCycleLog().periods), historyBefore, 'history is identical after the settings change');
  updateSettings({ cycleLength: null, periodLength: 5, cycleRegularity: 'unknown' });
}

group('Home summary reads the engine');
{
  const s = getHomeSummary();
  eq(s.hasData, true, 'home has data');
  eq(s.confidenceNote.includes('null'), false, 'no "null" leaks into the wording');
  eq(typeof s.cycleDay, 'number', 'cycle day is a number');
}

group('Dates: boundaries, leap years, time zones');
{
  eq(addDays('2026-12-30', 5), '2027-01-04', 'year boundary');
  eq(addDays('2026-01-30', 3), '2026-02-02', 'month boundary');
  eq(addDays('2028-02-27', 2), '2028-02-29', 'leap year: 27 Feb + 2 = 29 Feb 2028');
  eq(addDays('2027-02-27', 2), '2027-03-01', 'non-leap year: 27 Feb + 2 = 1 Mar');
  eq(dayDiff('2028-02-28', '2028-03-01'), 2, 'leap year day difference');
  eq(dayDiff('2026-10-03', '2026-10-03'), 0, 'same day is 0');
  eq(addDays('2026-10-03', 0), '2026-10-03', '3 Oct stays 3 Oct');
  eq(dateToKey(new Date(2026, 9, 3)), '2026-10-03', 'local 3 Oct midnight is 2026-10-03');
  eq(dateToKey(keyToLocalDate('2026-10-03')), '2026-10-03', 'key -> Date -> key round trip');
  eq(dateToKey(new Date(2026, 9, 3, 23, 59)), '2026-10-03', 'local 23:59 is still 3 Oct');
  eq(isValidDateKey('2026-02-30'), false, '30 Feb is rejected');
  eq(isValidDateKey('2026-13-01'), false, 'month 13 is rejected');
  const legacy = new Date(2026, 8, 17).toISOString().slice(0, 10);
  console.log('  info  the old toISOString() style gives "' + legacy + '" for local 17 Sep in this time zone');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed === 0 ? 0 : 1;
