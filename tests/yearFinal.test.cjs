// FINAL - Year Overview integration (Prompt 10)
// Run: npx --yes tsx tests/yearFinal.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const memory = new Map();
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); }, getAllKeys: async () => [...memory.keys()],
};
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: fakeStorage } };
console.warn = () => {};

const ROOT = path.join(__dirname, '..');
function freshApp() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(path.join(ROOT, 'lib')) || k.startsWith(path.join(ROOT, 'constants'))) delete require.cache[k];
  }
  return {
    store: require('../lib/vivaStore'),
    period: require('../lib/periodService'),
    pt: require('../lib/periodTracking'),
    yp: require('../lib/yearPeriods'),
    yo: require('../lib/yearOverview'),
    nav: require('../lib/calendarNavigation'),
    cal: require('../constants/calendarModel'),
    engine: require('../lib/cycleEngine'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const sorted = (set) => [...set].sort((a, b) => a - b).join(',');
function dow(y, m, d) { const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]; if (m < 3) y -= 1; return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7; }

async function main() {
  memory.clear();
  let app = await load();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const Y = Number(today.slice(0, 4));
  const marksFor = (year, periods, est, logs) => app.yp.yearCalendarMarks(year, periods, est, app.pt.bleedingMarks(logs || {}), today);
  const same = (year, periods, est, logs, months) => months.every((m, i) => {
    const cells = app.cal.buildCalendarMonth(year, i, periods, est, [], today, app.pt.bleedingMarks(logs || {})).filter((c) => c.isCurrentMonth);
    const pick = (f) => sorted(new Set(cells.filter(f).map((c) => Number(c.dateKey.slice(8, 10)))));
    return cells.every((c) => Number(c.dateKey.slice(0, 4)) === year)
      && pick((c) => c.isPeriod) === sorted(m.period) && pick((c) => c.isPredictedPeriod && !c.isPeriod) === sorted(m.predicted)
      && pick((c) => c.isFertile || c.isOvulation) === sorted(m.fertile) && pick((c) => c.isOvulation) === sorted(m.ovulation);
  });

  console.log('1 - CALENDAR -> YEAR OVERVIEW -> MONTH -> CALENDAR');
  const calState = { year: Y, monthIndex: 9 };
  const nav0 = app.nav; // keep the instance the Calendar stand-in listens to (later restarts load fresh copies)
  const unsub = nav0.subscribePendingMonth(() => { const p = nav0.takePendingMonth(); if (p) Object.assign(calState, p); });
  const calScreen = read('app/(tabs)/calendar.tsx');
  check('the month pill opens the Year Overview for the shown year', calScreen.includes("onLabelPress={() => router.push(('/year-overview?year=' + year) as Href)}"));
  for (const m of [0, 1, 2, 5, 8, 11]) {
    calState.monthIndex = (m + 4) % 12;
    nav0.setPendingMonth(2026, m);
    check('tap ' + NAMES[m] + ' -> Calendar shows ' + NAMES[m] + ' 2026', calState.year === 2026 && calState.monthIndex === m, calState);
  }

  console.log('2 - ALL 12 MINI-CALENDARS');
  for (const yr of [2025, 2026, 2027, 2028]) {
    const months = app.yo.buildYearOverview(yr);
    const ok = months.length === 12 && months.every((mm, i) => {
      const nums = mm.weeks.flat().filter((d) => d !== null);
      return mm.name === NAMES[i] && mm.year === yr && mm.monthIndex === i && nums.length === mm.days
        && nums.every((d, k) => d === k + 1) && mm.weeks.flat().indexOf(1) === (dow(yr, i + 1, 1) + 6) % 7;
    });
    check(yr + ': 12 months, right names, lengths, weekday alignment and year', ok);
  }
  const yoScreen = read('app/year-overview.tsx');
  const mini = read('components/MiniMonthCalendar.tsx');
  check('every month is its own tappable card with its own month index', (yoScreen.match(/<MiniMonthCalendar/g) || []).length === 1 && yoScreen.includes('MONTH_NAMES.map((_, monthIndex) =>') && mini.includes('onPress ? () => onPress(monthIndex) : undefined'));
  check('no hard-coded dates in the Year Overview', !/['"]20\d\d-\d\d-\d\d['"]/.test(yoScreen + mini + read('lib/yearOverview.ts') + read('lib/yearPeriods.ts')));

  console.log('3 - SAME CYCLE STATE AS THE DETAILED CALENDAR');
  await app.period.savePeriodRange('2026-01-29', '2026-02-02');
  app.store.logPeriod(D(-10)); await settle();
  let st = app.store.getVivaState();
  let est = app.engine.calculateCycle(st.baseline, st.periods, today);
  check('every month of ' + (Y - 1) + ', ' + Y + ' and ' + (Y + 1) + ': actual, predicted, fertile and ovulation all match', [Y - 1, Y, Y + 1].every((yr) => same(yr, st.periods, est, st.dailyLogs, marksFor(yr, st.periods, est, st.dailyLogs))));

  console.log('4 - MONTH BOUNDARIES');
  const y26 = marksFor(2026, st.periods, est, st.dailyLogs);
  check('period crossing January -> February: Jan 29-31 and Feb 1-2', sorted(y26[0].period) === '29,30,31' && sorted(y26[1].period) === '1,2');
  // Predictions only reach as far ahead as the engine projects them, so use the boundaries it does reach
  const findCross = (kind) => {
    for (let k = 1; k <= 60; k++) {
      const periods = [{ start: D(-k) }];
      const e = app.engine.calculateCycle({ cycleLength: 28, periodLength: 5, regularity: 'regular' }, periods, today);
      const list = [];
      for (const yr of [Y, Y + 1, Y + 2]) marksFor(yr, periods, e).forEach((m, i) => list.push({ yr, i, m }));
      for (let j = 0; j < list.length - 1; j++) {
        const a = list[j], b = list[j + 1];
        if (a.m[kind].has(app.yo.daysInMonth(a.yr, a.i)) && b.m[kind].has(1)) {
          const ok = same(a.yr, periods, e, {}, marksFor(a.yr, periods, e)) && same(b.yr, periods, e, {}, marksFor(b.yr, periods, e));
          return { ok, label: NAMES[a.i] + ' ' + a.yr + ' -> ' + NAMES[b.i] + ' ' + b.yr };
        }
      }
    }
    return { ok: false, label: 'none found' };
  };
  const pc = findCross('predicted'), fc = findCross('fertile');
  check('predicted period crossing a month boundary (' + pc.label + ') lands in both months and matches the Calendar', pc.ok, pc.label);
  check('fertile window crossing a month boundary (' + fc.label + ') lands in both months and matches the Calendar', fc.ok, fc.label);
  {
    const periods = [{ start: D(-10) }];
    const e = app.engine.calculateCycle({ cycleLength: 28, periodLength: 5, regularity: 'regular' }, periods, today);
    let lastPred = null;
    for (const yr of [Y, Y + 1, Y + 2]) marksFor(yr, periods, e).forEach((m, i) => { if (m.predicted.size) lastPred = yr + '-' + String(i + 1).padStart(2, '0') + '-' + String(Math.max(...m.predicted)).padStart(2, '0'); });
    console.log('  INFO  furthest predicted period day (28-day cycle, period started 10 days ago): ' + lastPred);
  }

  console.log('5 - YEAR BOUNDARIES');
  const dec = marksFor(2026, st.periods, est, st.dailyLogs)[11];
  const jan = marksFor(2027, st.periods, est, st.dailyLogs)[0];
  check('December 2026 and January 2027 each match the Calendar in their own year', same(2026, st.periods, est, st.dailyLogs, marksFor(2026, st.periods, est, st.dailyLogs)) && same(2027, st.periods, est, st.dailyLogs, marksFor(2027, st.periods, est, st.dailyLogs)));
  check('nothing from 2026 leaks into 2025 or 2027 (the Jan 29 period is in 2026 only)', marksFor(2025, st.periods, est, st.dailyLogs)[0].period.size === 0 && marksFor(2027, st.periods, est, st.dailyLogs)[0].period.size === 0 && dec !== jan);

  console.log('6 - LEAP YEARS');
  const f26 = app.yo.buildMiniMonth(2026, 1), f28 = app.yo.buildMiniMonth(2028, 1);
  check('Feb 2026 = 28 days starting Sunday; Feb 2028 = 29 days starting Tuesday', f26.days === 28 && f26.weeks.flat().indexOf(1) === 6 && f28.days === 29 && f28.weeks.flat().indexOf(1) === 1);

  console.log('7 - LIVE SYNC');
  await app.period.togglePeriodDay(D(-9));
  st = app.store.getVivaState();
  const dk = D(-9);
  check('a newly logged day appears in its mini-calendar', marksFor(Number(dk.slice(0, 4)), st.periods, est, st.dailyLogs)[Number(dk.slice(5, 7)) - 1].period.has(Number(dk.slice(8, 10))));
  const before = JSON.stringify(marksFor(Y, st.periods, app.engine.calculateCycle(st.baseline, st.periods, today), st.dailyLogs).map((m) => sorted(m.predicted)));
  await app.period.togglePeriodDay(D(-11));
  st = app.store.getVivaState();
  const after = JSON.stringify(marksFor(Y, st.periods, app.engine.calculateCycle(st.baseline, st.periods, today), st.dailyLogs).map((m) => sorted(m.predicted)));
  check('moving Day 1 moves the predictions', before !== after);
  app = await load();
  check('reopening shows the latest data', app.period.getPeriodInfo(D(-11)).dayNumber === 1);

  console.log('8 - NAVIGATION STATE');
  let yr = Y;
  for (let i = Y; i < 2028; i++) yr = app.yo.stepYear(yr, 1);
  nav0.setPendingMonth(yr, 7);
  check('move to 2028, tap August -> August 2028 (not ' + Y + ', not the current month)', calState.year === 2028 && calState.monthIndex === 7, calState);
  unsub();
  check('previous / next month, Today and day taps still wired on the Calendar', calScreen.includes('onPrevMonth={goPrevMonth}') && calScreen.includes('onNextMonth={goNextMonth}') && calScreen.includes('onToday={goToday}') && calScreen.includes('onDayPress={(k) => void onDayPress(k)}'));
  check('previous / next year wired on the Year Overview', yoScreen.includes('setYear((y) => stepYear(y, -1))') && yoScreen.includes('setYear((y) => stepYear(y, 1))'));

  console.log('9 - NO DUPLICATE LOGIC');
  const yearCode = yoScreen + mini + read('lib/yearOverview.ts') + read('lib/yearPeriods.ts') + read('lib/calendarNavigation.ts');
  check('no storage of its own', !/AsyncStorage|setItem|getItem/.test(yearCode));
  check('no prediction, fertility or ovulation maths of its own', !/cycleLength\s*[-+*]|-\s*14\b|ovulationDay\s*=|fertileStart|addDays\(/.test(yearCode));
  check('one estimate (calculateCycle) and one month model (buildCalendarMonth), both shared with the Calendar', (yoScreen.match(/calculateCycle\(/g) || []).length === 1 && read('lib/yearPeriods.ts').includes('buildCalendarMonth(year, monthIndex, periods, estimate, [], today, marks)'));

  console.log('10 - NO REGRESSIONS IN THE DETAILED CALENDAR');
  const base = execSync('git log --format=%H --grep="Year Overview screen" -n 1', { cwd: ROOT }).toString().trim();
  if (!base) { check('found the commit where the Year Overview started', false); }
  else {
    const changed = execSync('git diff --name-only ' + base + '^ HEAD -- constants/calendarModel.ts components/CycleCalendar.tsx components/CalendarDay.tsx lib/cycleEngine.ts lib/periodService.ts lib/periodTracking.ts', { cwd: ROOT }).toString().trim();
    check('calendar model, day cells, grid, cycle engine and period logging untouched since before the Year Overview', changed === '', changed);
    const removed = execSync('git diff -U0 ' + base + '^ HEAD -- "app/(tabs)/calendar.tsx"', { cwd: ROOT }).toString().split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1).trim());
    const allowed = ["import { router } from 'expo-router';", "import { useEffect, useMemo, useRef, useState } from 'react';"];
    check('Calendar screen: nothing removed except two import lines that were extended', removed.every((l) => allowed.includes(l)), removed);
    const selRemoved = execSync('git diff -U0 ' + base + '^ HEAD -- components/MonthSelector.tsx', { cwd: ROOT }).toString().split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1).trim());
    check('MonthSelector: only the pill wrapper changed (arrows and Today untouched)', selRemoved.every((l) => /^<View style=\{styles\.pill\}>$|^<\/View>$|^onToday: \(\) => void;$|^export default function MonthSelector/.test(l)), selRemoved);
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
