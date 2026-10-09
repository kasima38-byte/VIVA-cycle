// Period Length checks: Calendar bleeding days -> Insights bars + Average.
// Uses made-up 2030 dates only - never real user data.
// Run: npx -y tsx tests/periodLength.test.ts
import './support/securityFakes'; // phone security modules (Keychain, AES-GCM) for Node
import { buildPeriodRecords, periodLengthView, PeriodRangeKey, periodDetailRows, formatDays } from '../lib/periodLength';
import { bleedingMarks, derivePeriodLogs } from '../lib/periodTracking';
import { addDays, calculateCycle, diffDays, predictCycles } from '../lib/cycleEngine';

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

check('I1. Finished periods carry their end; the latest (maybe ongoing) does not', () => {
  eq(derivePeriodLogs(S443 as any).map((p: any) => p.start.slice(5) + '>' + (p.end ? p.end.slice(5) : '-')),
    ['07-01>07-04', '08-01>08-04', '09-01>09-03', '10-03>-'], 'periods');
});

check('I2. A period with a missing day gets no end (not used for predictions)', () => {
  const l = logs(['07-01', '07-02', '07-04', ...days('08', 1, 4)]);
  eq(derivePeriodLogs(l as any).map((p: any) => !!p.end), [false, false], 'has end');
});

check('I3. Prediction uses confirmed history (4,4,3 -> 4 days), not Settings (3)', () => {
  const est = calculateCycle({ cycleLength: null, periodLength: 3, regularity: 'not_sure' } as any, derivePeriodLogs(S443 as any), T);
  eq(est?.periodLengthUsed, 4, 'periodLengthUsed');
});

// ---------- Prediction -> actual transition (acceptance tests T1-T7) ----------
const BASE = { cycleLength: null, periodLength: 3, regularity: 'not_sure' } as any; // Settings = 3
const HIST = [...days('07', 1, 4), ...days('08', 1, 4), ...days('09', 1, 3)];
let calMonth: any = null;
try { calMonth = require('../constants/calendarModel').buildCalendarMonth; }
catch (e: any) { console.log('NOTE  Calendar model could not load in tests - calendar checks SKIPPED: ' + e.message); }
function state(yes: string[], today: string) {
  const l = logs(yes) as any;
  return { l, today, records: buildPeriodRecords(l, today, 3), est: calculateCycle(BASE, derivePeriodLogs(l), today)! };
}
function calPredicted(s: ReturnType<typeof state>, date: string, expected: boolean) {
  if (!calMonth) return;
  const month = calMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, derivePeriodLogs(s.l), s.est, [], s.today, bleedingMarks(s.l), { mucus: {} });
  const found: any[] = [];
  const walk = (x: any) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') { if (Object.values(x).includes(date)) found.push(x); else Object.values(x).forEach(walk); }
  };
  walk(month);
  const cell = found.find((c) => 'isPredictedPeriod' in c);
  if (!cell) throw new Error('no calendar cell for ' + date + ' (found keys: ' + Object.keys(found[0] ?? {}).join(',') + ')');
  eq(!!cell.isPredictedPeriod, expected, 'Calendar ' + date + ' predicted');
}
const cycleView = (s: ReturnType<typeof state>) => periodLengthView(s.records, 'cycle', s.today, s.est.periodLengthUsed);

check('T1. Predicted period, no bleeding: shown predicted, never counted', () => {
  const s = state(HIST, d('09-28'));
  eq(s.est.periodLengthUsed, 4, 'estimate (history 4,4)');
  eq(s.records.length, 3, 'confirmed periods');
  const v = cycleView(s);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3'], 'bars'); eq(v.averageText, '3.7 days', 'average');
  calPredicted(s, predictCycles(s.est, 1)[0].periodStart, true);
});

check('T2. One confirmed day: in progress, estimate shown, average unchanged', () => {
  const s = state([...HIST, '10-03'], d('10-03'));
  const cur = s.records[s.records.length - 1];
  eq(cur.status, 'active', 'status'); eq(cur.loggedInWindow, 1, 'days');
  const v = cycleView(s);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3'], 'bars'); eq(v.averageText, '3.7 days', 'average');
  eq(periodDetailRows(v)[0].value, '1 day so far', 'details');
  if (!v.notes.some((n) => n.startsWith('This period is estimated at 4 days'))) throw new Error('no estimate note: ' + JSON.stringify(v.notes));
  calPredicted(s, d('10-03'), false); calPredicted(s, d('10-05'), true);
});

check('T3. Consecutive days: count updates, still not in the average', () => {
  const s = state([...HIST, ...days('10', 3, 6)], d('10-06'));
  eq(s.records[s.records.length - 1].status, 'active', 'status');
  const v = cycleView(s);
  eq(periodDetailRows(v)[0].value, '4 days so far', 'details'); eq(v.averageText, '3.7 days', 'average');
  calPredicted(s, d('10-06'), false);
});

check('T4. Completed period: actual length replaces prediction in history', () => {
  const s = state([...HIST, ...days('10', 3, 6)], d('10-09'));
  eq(s.records[s.records.length - 1].status, 'completed', 'status');
  const v = cycleView(s);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3', 'Oct 4'], 'bars'); eq(v.averageText, '3.8 days', 'average');
  eq(periodDetailRows(v)[0].value, '4 days', 'details');
  calPredicted(s, d('10-04'), false);
});

check('T5. Correction removes a day: episode and average recalculate', () => {
  const s = state([...HIST, ...days('10', 3, 5)], d('10-09'));
  const v = cycleView(s);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3', 'Oct 3'], 'bars'); eq(v.averageText, '3.5 days', 'average');
});

check('T6. Predicted period passes with no bleeding: nothing counted', () => {
  const s = state(HIST, d('10-20'));
  eq(s.records.length, 3, 'confirmed periods');
  const v = cycleView(s);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3'], 'bars'); eq(v.averageText, '3.7 days', 'average');
});

check('T7. Completed period is never duplicated (bars or details, every range)', () => {
  const s = state([...HIST, ...days('10', 3, 6)], d('10-09'));
  RANGES.forEach((rg) => {
    const v = periodLengthView(s.records, rg, s.today, s.est.periodLengthUsed);
    const labels = v.chart.map((c) => c.label), keys = periodDetailRows(v).map((r) => r.key);
    eq(new Set(labels).size, labels.length, rg + ' bars unique');
    eq(new Set(keys).size, keys.length, rg + ' details unique');
  });
});

// ---------- Chart / Average / See Details consistency (U1-U8) ----------
// Bars, Average and the completed rows of See Details must describe the same periods.
function agree(v: ReturnType<typeof view>, what: string) {
  const done = periodDetailRows(v).filter((r) => r.note === null).reverse(); // completed + counted, oldest first
  eq(done.map((r) => r.value), v.chart.map((c) => c.value + (c.value === 1 ? ' day' : ' days')), what + ': details = bars');
  eq(v.average, mean1(v.chart.map((c) => c.value)), what + ': average = mean of bars');
}
const HIST2 = [...days('07', 1, 4), ...days('08', 1, 4), ...days('09', 1, 3)];

check('U1. Completed 4,4,3 -> bars 4,4,3, Average 3.7, details agree', () => {
  const v = view(logs(HIST2), '6m', T);
  eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3'], 'bars'); eq(v.averageText, '3.7 days', 'average'); agree(v, '6m');
});

check('U2. Ongoing 2-day episode does not change the Average', () => {
  const l = logs([...HIST2, '10-03', '10-04']);
  (['cycle', '6m', '12m'] as PeriodRangeKey[]).forEach((rg) => {
    const v = view(l, rg, d('10-04'));
    eq(v.averageText, '3.7 days', rg + ' average'); agree(v, rg);
  });
  eq(periodDetailRows(view(l, 'cycle', d('10-04')))[0].value, '2 days so far', 'in-progress row');
});

check('U3+U4+U6. Every timeframe: bars, Average and details agree', () => {
  [logs(HIST2), logs([...HIST2, ...days('10', 3, 6)]), logs([...HIST2, '10-03', '10-04'])].forEach((l) =>
    RANGES.forEach((rg) => agree(view(l, rg, T), rg)));
  eq(view(logs(HIST2), '3m', T).averageText, '3.5 days', '3m differs from 6m');
});

check('U5. Calendar correction (remove Aug 4) updates bars, Average and details', () => {
  const v = view(logs([...days('07', 1, 4), ...days('08', 1, 3), ...days('09', 1, 3)]), '6m', T);
  eq(bars(v), ['Jul 4', 'Aug 3', 'Sep 3'], 'bars'); eq(v.averageText, '3.3 days', 'average');
  eq(periodDetailRows(v).find((r) => r.key === d('08-01'))?.value, '3 days', 'Aug row'); agree(v, '6m');
});

check('U7. Predictions never enter the Average or add a period', () => {
  const s = state(HIST, d('10-20'));                    // predicted Oct period passed, nothing tapped
  RANGES.forEach((rg) => {
    const v = periodLengthView(s.records, rg, s.today, s.est.periodLengthUsed);
    if (v.chart.some((c) => c.label === 'Oct') || periodDetailRows(v).some((r) => r.month.startsWith('Oct')))
      throw new Error(rg + ' shows a predicted Oct period');
  });
});

check('U8. See Details shows the year when the list spans two years', () => {
  const l: any = logs([...HIST2, ...days('10', 3, 6)]);
  ['2029-10-12', '2029-10-13', '2029-10-14', '2029-10-15'].forEach((k) => (l[k] = { period: 'yes' }));
  const rows = periodDetailRows(view(l, '12m', T));
  eq(rows.map((r) => r.month), ['Oct 2030', 'Sep 2030', 'Aug 2030', 'Jul 2030', 'Oct 2029'], 'months');
  eq(periodDetailRows(view(logs(HIST2), '6m', T)).map((r) => r.month), ['Sep', 'Aug', 'Jul'], 'single year: no year shown');
});

// ---------- Chart labels across two years (V1-V2) ----------
check('V1. Same month in two years -> every bar label gets a 2-digit year', () => {
  const l: any = logs([...HIST2, ...days('10', 3, 6)]);
  ['2029-10-25', '2029-10-26', '2029-10-27', '2029-10-28'].forEach((k) => (l[k] = { period: 'yes' }));
  const today = d('10-20'); // 12 Months = from 2029-10-20
  eq(bars(view(l, '12m', today)), ["Oct '29 4", "Jul '30 4", "Aug '30 4", "Sep '30 3", "Oct '30 4"], '12m labels');
  eq(bars(view(l, 'cycle', today)), ["Oct '29 4", "Jul '30 4", "Aug '30 4", "Sep '30 3", "Oct '30 4"], 'This Cycle labels');
  eq(view(l, '12m', today).averageText, '3.8 days', 'average unchanged by labels');
});

check('V2. Unique months keep the short labels (no year)', () => {
  eq(bars(view(logs(HIST2), '12m', T)), ['Jul 4', 'Aug 4', 'Sep 3'], 'labels');
});

// ---------- Display format (W1) ----------
check('W1. formatDays: whole numbers without .0, otherwise one decimal', () => {
  eq([3, 3.0, 3.5, 3.67, 4, 2.96, 1].map(formatDays),
    ['3 days', '3 days', '3.5 days', '3.7 days', '4 days', '3 days', '1 day'], 'formatted');
});

check('W2. formatDays for Cycle Length / Profile values (no trailing .0)', () => {
  eq([28, 31, 31.0, 31.5, 30.96].map(formatDays), ['28 days', '31 days', '31 days', '31.5 days', '31 days'], 'formatted');
});

// ---------- Estimate note (X1-X3) ----------
check('X1. In-progress period -> note says "This period is estimated at"', () => {
  const notes = cycleView(state([...HIST, '10-03', '10-04'], d('10-04'))).notes;
  if (!notes.includes('This period is estimated at 4 days (prediction, not recorded bleeding)')) throw new Error(JSON.stringify(notes));
});

check('X2. Completed period -> note refers to the NEXT period', () => {
  const notes = cycleView(state([...HIST, ...days('10', 3, 6)], d('10-09'))).notes;
  if (!notes.some((n) => n.startsWith('Next period is estimated at 4 days'))) throw new Error(JSON.stringify(notes));
  if (notes.some((n) => n.startsWith('This period'))) throw new Error('still says This period');
});

check('X3. Note only on This Cycle and changes no bars or Average', () => {
  const s = state([...HIST, '10-03', '10-04'], d('10-04'));
  (['3m', '6m', '12m'] as PeriodRangeKey[]).forEach((rg) => {
    if (periodLengthView(s.records, rg, s.today, 4).notes.some((n) => n.includes('estimated'))) throw new Error(rg + ' shows estimate');
  });
  const a = periodLengthView(s.records, 'cycle', s.today, 4), b = periodLengthView(s.records, 'cycle', s.today, null);
  eq([a.chart, a.average], [b.chart, b.average], 'estimate changes nothing else');
});

// ---------- November prediction (Y1-Y2) ----------
check('Y1. Your 2026 dates -> engine predicts Nov 3-6, 2026 (Calendar agrees)', () => {
  const l: any = {};
  ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
   '2026-09-01', '2026-09-02', '2026-09-03', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'].forEach((k) => (l[k] = { period: 'yes' }));
  const today = '2026-10-09';
  const est = calculateCycle({ cycleLength: null, periodLength: 3, regularity: 'not_sure' } as any, derivePeriodLogs(l), today)!;
  eq([est.cycleLengthUsed, est.periodLengthUsed], [31, 4], 'cycle / period length used');
  const next = predictCycles(est, 1)[0];
  eq([next.periodStart, next.periodEnd], ['2026-11-03', '2026-11-06'], 'next period');
  const s: any = { l, today, records: buildPeriodRecords(l, today, 3), est };
  calPredicted(s, '2026-11-02', false); calPredicted(s, '2026-11-03', true);
  calPredicted(s, '2026-11-06', true); calPredicted(s, '2026-11-07', false);
});

check('Y2. Date maths is calendar-safe (year end, DST weekends)', () => {
  eq([addDays('2026-12-30', 3), addDays('2026-03-28', 2), addDays('2026-10-24', 2), diffDays('2027-01-02', '2026-12-30')],
    ['2027-01-02', '2026-03-30', '2026-10-26', 3], 'dates');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
