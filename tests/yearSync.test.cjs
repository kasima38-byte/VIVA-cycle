// Year Overview stays in sync with live cycle data (Prompt 8)
// Run: npx --yes tsx tests/yearSync.test.cjs
const fs = require('fs');
const path = require('path');
const memory = new Map();
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); },
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
    engine: require('../lib/cycleEngine'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const a = freshApp(); await a.store.loadVivaStore(); await settle(); return a; }
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

async function main() {
  memory.clear();
  let app = await load();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const Y = Number(today.slice(0, 4));

  // Exactly what the Year Overview screen computes from the store
  const screenMarks = (year, baselineOverride) => {
    const st = app.store.getVivaState();
    const est = app.engine.calculateCycle(baselineOverride || st.baseline, st.periods, today);
    return app.yp.yearCalendarMarks(year, st.periods, est, app.pt.bleedingMarks(st.dailyLogs), today);
  };
  const at = (dateKey, kind, baselineOverride) => screenMarks(Number(dateKey.slice(0, 4)), baselineOverride)[Number(dateKey.slice(5, 7)) - 1][kind].has(Number(dateKey.slice(8, 10)));
  const flat = (kind, baselineOverride) => [Y, Y + 1].flatMap((yr) => screenMarks(yr, baselineOverride).map((m, i) => yr + '-' + i + ':' + [...m[kind]].sort((a, b) => a - b).join(','))).join('|');

  console.log('WORKFLOW 1: LOG A NEW PERIOD DAY');
  app.store.logPeriod(D(-12)); await settle();
  await app.period.togglePeriodDay(D(-11));
  const before = app.store.getVivaState();
  check('Year Overview shows the existing days', at(D(-12), 'period') && at(D(-11), 'period'));
  await app.period.togglePeriodDay(D(-10));
  const after = app.store.getVivaState();
  check('the store hands out NEW data objects (so the screen recalculates)', after.dailyLogs !== before.dailyLogs);
  check('a newly logged day appears in the correct month', at(D(-10), 'period'));

  console.log('REMOVING / CHANGING A DAY');
  await app.period.togglePeriodDay(D(-10));
  check('a removed day loses its marker', !at(D(-10), 'period') && at(D(-11), 'period'));
  const p0 = app.store.getVivaState().periods;
  await app.period.togglePeriodDay(D(-12));
  check('removing Day 1 moves the period start (new periods object)', app.store.getVivaState().periods !== p0 && !at(D(-12), 'period') && at(D(-11), 'period'));

  console.log('CHANGED PERIOD DATA MOVES PREDICTIONS, FERTILE WINDOW AND OVULATION');
  const predA = flat('predicted'), fertA = flat('fertile'), ovuA = flat('ovulation');
  // Move Day 1 of the current period one day earlier: every prediction is counted from Day 1, so all must shift.
  // (Adding an older period alone doesn't move predictions - with one logged cycle the engine keeps the Settings length.)
  await app.period.togglePeriodDay(D(-12));
  check('Day 1 moved one day earlier', app.period.getPeriodInfo(D(-12)).dayNumber === 1);
  check('changing Day 1 updates predicted days', flat('predicted') !== predA);
  check('... and the fertile window', flat('fertile') !== fertA);
  check('... and the ovulation day', flat('ovulation') !== ovuA);

  console.log('WORKFLOW 2: CHANGE CYCLE LENGTH');
  const base = app.store.getVivaState().baseline;
  const longer = { ...base, cycleLength: (base && base.cycleLength ? base.cycleLength : 28) + 7 };
  check('a longer cycle length changes predicted days', flat('predicted', longer) !== flat('predicted'));
  check('... the fertile window', flat('fertile', longer) !== flat('fertile'));
  check('... and the ovulation day', flat('ovulation', longer) !== flat('ovulation'));
  const ovuDays = [Y, Y + 1].flatMap((yr) => screenMarks(yr, longer).flatMap((m, i) => [...m.ovulation].map((d) => ({ yr, i, d }))));
  check('each new ovulation day lands in exactly one month', ovuDays.length > 0 && new Set(ovuDays.map((o) => o.yr + '-' + o.i + '-' + o.d)).size === ovuDays.length);

  console.log('ACROSS A MONTH BOUNDARY');
  memory.clear(); app = await load();
  const firstOfThis = today.slice(0, 8) + '01';
  const firstOfPrev = app.dates.addDays(firstOfThis, -1).slice(0, 8) + '01';
  const monthEnd = app.dates.addDays(firstOfPrev, -1); // last day of the month before last
  await app.period.savePeriodRange(app.dates.addDays(monthEnd, -1), app.dates.addDays(monthEnd, 1));
  check('a period across a month boundary shows in both months', at(monthEnd, 'period') && at(app.dates.addDays(monthEnd, 1), 'period'));
  await app.period.togglePeriodDay(app.dates.addDays(monthEnd, 2));
  check('adding a day in the later month updates that month', at(app.dates.addDays(monthEnd, 2), 'period'));
  await app.period.togglePeriodDay(monthEnd);
  check('removing the last day of the earlier month updates that month', !at(monthEnd, 'period') && at(app.dates.addDays(monthEnd, -1), 'period'));

  console.log('NAVIGATING AWAY AND RETURNING');
  const snap = flat('period') + '#' + flat('predicted') + '#' + flat('fertile') + '#' + flat('ovulation');
  app = await load();
  check('reopening shows the latest information', flat('period') + '#' + flat('predicted') + '#' + flat('fertile') + '#' + flat('ovulation') === snap);

  console.log('SCREEN WIRING');
  const screen = read('app/year-overview.tsx');
  const comp = read('components/MiniMonthCalendar.tsx');
  check('reads the same store as the Calendar', screen.includes('const viva = useVivaStore();'));
  check('recalculates when bleeding days change', screen.includes('bleedingMarks(viva.dailyLogs), [viva.dailyLogs]'));
  check('recalculates when cycle settings or periods change', screen.includes('calculateCycle(viva.baseline, viva.periods, today), [viva.baseline, viva.periods, today]'));
  check('month marks follow every input', screen.includes('[year, viva.periods, est, marks, today]'));
  check('no second copy or cache of cycle data', !/AsyncStorage|let cache|new Map\(/.test(screen + read('lib/yearPeriods.ts')));
  check('only months whose own days changed are redrawn', comp.includes('export default memo(MiniMonthCalendar, sameMonth);') && comp.includes('sameSet(a.ovulationDays ?? NONE, b.ovulationDays ?? NONE)'));
  check('stable tap handlers (no forced redraws)', screen.includes('const openMonth = useCallback('));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
