// Period Length checks: Calendar bleeding days -> Insights bars + Average.
// Uses made-up 2030 dates only - never real user data.
// Run: npx -y tsx tests/periodLength.test.ts
import { buildPeriodRecords, periodLengthView, PeriodRangeKey } from '../lib/periodLength';

type Logs = Record<string, { period: 'yes' | 'no' }>;
const d = (md: string) => '2030-' + md;
const days = (m: string, a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => m + '-' + String(a + i).padStart(2, '0'));
function logs(yes: string[], no: string[] = []): Logs {
  const out: Logs = {};
  yes.forEach((k) => (out[d(k)] = { period: 'yes' }));
  no.forEach((k) => (out[d(k)] = { period: 'no' }));
  return out;
}
const view = (l: Logs, range: PeriodRangeKey, today: string) =>
  periodLengthView(buildPeriodRecords(l as any, today), range, today);
const bars = (v: ReturnType<typeof view>) => v.chart.map((c) => c.label + ' ' + c.value);
const mean1 = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
const RANGES: PeriodRangeKey[] = ['cycle', '3m', '6m', '12m'];

let pass = 0, fail = 0;
function check(name: string, fn: () => void) {
  try { fn(); console.log('PASS  ' + name); pass++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + e.message); fail++; }
}
function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(what + ': expected ' + b + ', got ' + a);
}

const T = d('10-09');
const S443 = logs([...days('07', 1, 4), ...days('08', 1, 4), ...days('09', 1, 3), ...days('10', 3, 6)]);

check('A. 4 consecutive bleeding days = one 4-day episode', () => {
  const r = buildPeriodRecords(logs(days('07', 1, 4)) as any, d('07-20'));
  eq(r.length, 1, 'episodes'); eq(r[0].recordedDays, 4, 'length');
  eq(r[0].status, 'completed', 'status'); eq(r[0].countsForAverage, true, 'counts');
});

check('B. Two separate episodes are not merged', () => {
  const r = buildPeriodRecords(logs([...days('07', 1, 4), ...days('08', 1, 3)]) as any, d('08-20'));
  eq(r.map((p) => p.start + ':' + p.recordedDays), [d('07-01') + ':4', d('08-01') + ':3'], 'episodes');
});

check('C. Missing day follows existing rule (gap -> excluded, not split, not invented)', () => {
  const r = buildPeriodRecords(logs(['07-01', '07-02', '07-04']) as any, d('07-20'));
  eq(r.length, 1, 'episodes'); eq(r[0].hasGap, true, 'hasGap'); eq(r[0].countsForAverage, false, 'counts');
});

check('D1. Ongoing episode is not a completed period', () => {
  const l = logs(days('10', 3, 6));
  const r = buildPeriodRecords(l as any, T);
  eq(r[0].status, 'active', 'status'); eq(r[0].countsForAverage, false, 'counts');
  const v = view(l, 'cycle', T);
  eq(v.average, null, 'average'); eq(v.averageText, '—', 'averageText'); eq(v.chart.length, 0, 'bars');
});

check('D2. Marking the next day "no period" completes it (existing rule)', () => {
  const r = buildPeriodRecords(logs(days('10', 3, 6), ['10-07']) as any, T);
  eq(r[0].status, 'completed', 'status'); eq(r[0].recordedDays, 4, 'length');
});

check('E. Future dates never count as history', () => {
  const l = logs([...days('08', 1, 4), ...days('09', 1, 3), ...days('11', 3, 5)]);
  RANGES.forEach((rg) => {
    if (bars(view(l, rg, T)).some((b) => b.startsWith('Nov'))) throw new Error(rg + ' shows a future Nov bar');
  });
});

check('5a. 4,4,3 -> bars 4,4,3 and Average 3.7 (This Cycle / 6M / 12M)', () => {
  (['cycle', '6m', '12m'] as PeriodRangeKey[]).forEach((rg) => {
    const v = view(S443, rg, T);
    eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3'], rg + ' bars'); eq(v.averageText, '3.7 days', rg + ' average');
  });
});

check('5a. 3 Months window (from Jul 9) -> Aug 4, Sep 3, Average 3.5', () => {
  const v = view(S443, '3m', T);
  eq(bars(v), ['Aug 4', 'Sep 3'], 'bars'); eq(v.averageText, '3.5 days', 'average');
});

check('5b. 4,2 -> bars 4,2 and Average 3', () => {
  const l = logs([...days('08', 1, 4), ...days('09', 1, 2)]);
  RANGES.forEach((rg) => {
    const v = view(l, rg, T);
    eq(bars(v), ['Aug 4', 'Sep 2'], rg + ' bars'); eq(v.average, 3, rg + ' average');
  });
  console.log('      (displayed text: "' + view(l, '6m', T).averageText + '")');
});

check('Add a bleeding day (Sep 4) -> Sep bar 4, Average 4', () => {
  const v = view(logs([...days('07', 1, 4), ...days('08', 1, 4), ...days('09', 1, 4)]), '6m', T);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 4'], 'bars'); eq(v.average, 4, 'average');
});

check('Remove a bleeding day (Aug 4) -> Aug bar 3, Average 3.3', () => {
  const v = view(logs([...days('07', 1, 4), ...days('08', 1, 3), ...days('09', 1, 3)]), '6m', T);
  eq(bars(v), ['Jul 4', 'Aug 3', 'Sep 3'], 'bars'); eq(v.average, 3.3, 'average');
});

check('Bars and Average always use the same dataset (every range)', () => {
  [S443, logs([...days('08', 1, 4), ...days('09', 1, 2)])].forEach((l) =>
    RANGES.forEach((rg) => {
      const v = view(l, rg, T);
      eq(v.average, mean1(v.chart.map((c) => c.value)), rg);
    }));
});

check('F1. Settings 4: Oct 3-6 counts once Oct 7 has passed', () => {
  const r = buildPeriodRecords(logs(days('10', 3, 6)) as any, T, 4);
  eq(r[0].status, 'completed', 'status'); eq(r[0].countsForAverage, true, 'counts');
});

check('F2. Settings 5: only Day 1 logged is NOT finished early', () => {
  const r = buildPeriodRecords(logs(['10-03']) as any, d('10-05'), 5);
  eq(r[0].status, 'active', 'status');
});

check('F3. Settings 4: still in progress on the day after the last bleeding day', () => {
  const r = buildPeriodRecords(logs(days('10', 3, 6)) as any, d('10-07'), 4);
  eq(r[0].status, 'active', 'status');
});

check('F4. Oct complete -> 6 Months bars 4,4,3,4 and Average 3.8', () => {
  const v = periodLengthView(buildPeriodRecords(S443 as any, T, 4), '6m', T);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3', 'Oct 4'], 'bars'); eq(v.averageText, '3.8 days', 'average');
});

check('G. See Details lists the same completed periods as the bars (every range)', () => {
  RANGES.forEach((rg) => {
    const v = view(S443, rg, T);
    eq(v.details.filter((p) => p.countsForAverage).length, v.chart.length, rg);
  });
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
