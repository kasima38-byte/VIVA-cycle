// Calendar bleeding-day tracking (no phone needed for the data; the tap itself needs the phone)
// Run: npx --yes tsx tests/calendarBleeding.test.cjs
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
    svc: require('../lib/dailyTrackingService'),
    period: require('../lib/periodService'),
    pt: require('../lib/periodTracking'),
    ins: require('../lib/insightsService'),
    engine: require('../lib/cycleEngine'),
    cal: require('../constants/calendarModel'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function load() { const app = freshApp(); await app.store.loadVivaStore(); await settle(); return app; }

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

async function main() {
  let app = await load();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const S = D(-10), S1 = D(-9), S2 = D(-8), S3 = D(-7);
  const st = () => app.store.getVivaState();
  const cells = (dateKey) => {
    const dt = app.dates.keyToLocalDate(dateKey);
    let est = null;
    try { est = app.engine.calculateCycle(st().baseline, st().periods, today); } catch (e) { est = null; }
    return app.cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), st().periods, est, [], today, app.pt.bleedingMarks(st().dailyLogs));
  };
  const cell = (d) => cells(d).find((c) => c.dateKey === d && c.isCurrentMonth) || cells(d).find((c) => c.dateKey === d);

  console.log('5 - LOG PERIOD START IS AN ACTUAL BLEEDING DAY');
  check('Log Period accepted', app.store.logPeriod(S).kind === 'added');
  await settle();
  check('start date is a recorded bleeding day', app.period.getPeriodInfo(S).status === 'period');
  check('Calendar shows it in the solid (actual) period style', cell(S).isPeriod === true && cell(S).isPredictedPeriod === false);

  console.log('6 - TAP THE FOLLOWING DAYS');
  await app.svc.updateDailyTrackingField(S2, 'mood', 'good');
  const counts = [];
  for (const d of [S1, S2, S3]) {
    const t = await app.period.togglePeriodDay(d);
    counts.push(t.result + ':' + t.action + ':' + t.recordedDays);
  }
  check('each tap records a bleeding day (2, 3, 4 days recorded)', JSON.stringify(counts) === JSON.stringify(['saved:added:2', 'saved:added:3', 'saved:added:4']), counts);
  const info = app.period.getPeriodInfo(S3);
  check('periodStartDate = first day, bleedingDays = 4, periodLength = 4', info.episode.start === S && info.episode.recordedDays === 4 && info.dayNumber === 4);
  check('all four shown as actual period days on the Calendar', [S, S1, S2, S3].every((d) => cell(d).isPeriod));
  check('the period start used by the cycle engine is unchanged', st().periods.map((p) => p.start).includes(S));
  check('other tracking on those days is not overwritten', app.svc.readDailyRecord(S2).mood === 'good');

  console.log('7 - PREDICTED DAYS NEVER COUNT');
  const predicted = cells(S).concat(cells(D(25))).filter((c) => c.isPredictedPeriod).map((c) => c.dateKey);
  check('no predicted day is stored as bleeding', predicted.every((d) => app.period.getPeriodInfo(d).status !== 'period'), predicted);
  check('recorded length still 4', app.period.getPeriodInfo(S).episode.recordedDays === 4);

  console.log('4 - TAP A LOGGED DAY TO REMOVE IT');
  const off = await app.period.togglePeriodDay(S3);
  check('removed', off.result === 'saved' && off.action === 'removed' && app.period.getPeriodInfo(S3).status === 'untracked');
  check('Calendar updates, length now 3', cell(S3).isPeriod === false && app.period.getPeriodInfo(S).episode.recordedDays === 3);
  await app.period.togglePeriodDay(S3);
  await app.period.togglePeriodDay(S1);
  check('removing a middle day splits the period (no fake continuity)', app.period.getPeriodInfo(S).episode.recordedDays === 1 && app.period.getPeriodInfo(S2).dayNumber === 1);
  await app.period.togglePeriodDay(S1);

  console.log('FUTURE DAYS');
  const fut = await app.period.togglePeriodDay(D(3));
  check('refused, nothing stored', fut.result === 'future' && !st().dailyLogs[D(3)]);

  console.log('9 - MONTH NAVIGATION + RESTART');
  const otherMonth = app.dates.addDays(S, -40);
  await app.period.togglePeriodDay(otherMonth);
  check('markings in two different months both shown', cell(otherMonth).isPeriod && cell(S).isPeriod);
  app = await load();
  check('after restart: 4 bleeding days, start date kept', app.period.getPeriodInfo(S3).episode.recordedDays === 4 && app.period.getPeriodInfo(S).episode.start === S);
  check('Insights see the real period length', app.ins.getCycleHistory().some((c) => c.startDate === S && c.recordedPeriodDays === 4));

  console.log('YOUR ONLY PERIOD CANNOT BE TAPPED AWAY');
  memory.clear();
  app = await load();
  app.store.logPeriod(D(-5));
  await settle();
  const last = await app.period.togglePeriodDay(D(-5));
  check('refused with a clear reason', last.result === 'lastOne' && app.period.getPeriodInfo(D(-5)).status === 'period');

  console.log('SCREEN');
  const screen = fs.readFileSync(path.join(ROOT, 'app/(tabs)/calendar.tsx'), 'utf8');
  check('instruction card text', /Track your period/.test(screen) && /Tap each day you have bleeding to record your period length\./.test(screen));
  check('taps are wired to the shared period service', /onDayPress=\{\(k\) => void onDayPress\(k\)\}/.test(screen) && /togglePeriodDay\(dateKey\)/.test(screen));
  check('one tap = one change; future dates explained', /if \(tapBusy\.current\) return;/.test(screen) && /today or earlier/.test(screen));
  check('no separate "End period" button', !/End period/i.test(screen));

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
