// Cervical mucus - Prompt 7 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/mucusTracking.test.cjs
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

const ROOT = path.join(__dirname, '..');
function freshApp() {
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(path.join(ROOT, 'lib')) || k.startsWith(path.join(ROOT, 'constants'))) delete require.cache[k];
  }
  return {
    store: require('../lib/vivaStore'),
    svc: require('../lib/dailyTrackingService'),
    period: require('../lib/periodService'),
    flow: require('../lib/flowService'),
    sym: require('../lib/symptomService'),
    mucus: require('../lib/mucusService'),
    list: require('../lib/cervicalMucus'),
    pt: require('../lib/periodTracking'),
    mt: require('../lib/mucusTracking'),
    engine: require('../lib/cycleEngine'),
    model: require('../lib/dailyTracking'),
    dates: require('../constants/dateUtils'),
  };
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, mucus, list, model } = app;
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const other = D(-1), P = D(-5), P2 = D(-6);
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'cervicalMucus');

  console.log('CENTRAL LIST');
  check('IDs: dry, sticky, creamy, watery, egg_white, other', eq(list.MUCUS_OBSERVATIONS.map((o) => o.id), ['dry', 'sticky', 'creamy', 'watery', 'egg_white', 'other']));
  check('every option has a short description', list.MUCUS_OBSERVATIONS.every((o) => o.description.length > 10 && o.description.length < 60));
  check('earlier ID "eggWhite" is read as "egg_white"', model.normalizeRecord(D(-30), { cervicalMucus: 'eggWhite' }).cervicalMucus === 'egg_white');

  console.log('TEST 1 - untracked date');
  check('Not tracked (not Dry)', rec(today).cervicalMucus === null && card(today) === 'Not tracked', rec(today));

  console.log('TEST 2 / 3 - Creamy');
  check('saved', (await mucus.saveMucus(today, 'creamy')) === 'saved');
  check('card shows "Creamy"', card(today) === 'Creamy', card(today));
  check('reopening shows Creamy selected', mucus.getMucus(today).value === 'creamy');

  console.log('TEST 4 - Creamy -> Watery');
  check('saved', (await mucus.saveMucus(today, 'watery')) === 'saved');
  check('card shows "Watery"', card(today) === 'Watery', card(today));
  check('same value again writes nothing', (await mucus.saveMucus(today, 'watery')) === 'unchanged');

  console.log('TEST 5 / 6 - other dates do not inherit it');
  check('another date is still Not tracked', rec(other).cervicalMucus === null);
  check('original date still Watery', rec(today).cervicalMucus === 'watery');

  console.log('TEST 8 - Other + optional note');
  check('saved with note', (await mucus.saveMucus(D(-2), 'other', '  Thicker than usual  ')) === 'saved');
  check('observation and note kept (trimmed)', eq(mucus.getMucus(D(-2)), { value: 'other', note: 'Thicker than usual' }), mucus.getMucus(D(-2)));
  check('card shows "Other" and never the note', card(D(-2)) === 'Other' && !model.fieldFullText(rec(D(-2)), 'cervicalMucus').includes('Thicker'));
  check('note is optional', (await mucus.saveMucus(D(-3), 'other')) === 'saved' && mucus.getMucus(D(-3)).note === null);
  await mucus.saveMucus(D(-4), 'other', 'x'.repeat(300));
  check('note limited to ' + list.MUCUS_NOTE_MAX + ' characters', mucus.getMucus(D(-4)).note.length === list.MUCUS_NOTE_MAX);
  await mucus.saveMucus(D(-4), 'creamy', 'should be dropped');
  check('note is dropped when the observation is not Other', eq(mucus.getMucus(D(-4)), { value: 'creamy', note: null }), mucus.getMucus(D(-4)));

  console.log('VALIDATION');
  check('unknown value refused', (await mucus.saveMucus(today, 'EGG_WHITE')) === 'invalid');
  check('future date refused', (await mucus.saveMucus(D(1), 'dry')) === 'future');
  check('no record created for the future date', !app.store.getVivaState().dailyLogs[D(1)]);

  console.log('TEST 9 - all six coexist');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps']);
  await svc.updateDailyRecord(P, { mood: 'good', energy: 70 });
  await mucus.saveMucus(P, 'watery');
  const r9 = rec(P);
  check('period, flow, symptoms, mood, energy, mucus all kept',
    period.getPeriodInfo(P).status === 'period' && r9.flow === 'heavy' && eq(r9.symptoms, ['cramps']) && r9.mood === 'good' && r9.energy === 70 && r9.cervicalMucus === 'watery', r9);

  console.log('TEST 10 / 11 + others - other changes never touch it');
  await period.markPeriodDay(P2);
  await period.removePeriodDay(P2);
  check('after changing period: Watery', rec(P).cervicalMucus === 'watery');
  await flow.saveFlow(P, 'light');
  check('after changing flow: Watery', rec(P).cervicalMucus === 'watery');
  await sym.saveSymptoms(P, ['cramps', 'bloating']);
  await svc.updateDailyRecord(P, { mood: 'great', energy: 30 });
  check('after changing symptoms, mood and energy: Watery', rec(P).cervicalMucus === 'watery');
  check('Daily Tracking Save cannot change it', (await svc.updateDailyRecord(P, { cervicalMucus: 'dry' })) === 'unchanged' && rec(P).cervicalMucus === 'watery');

  console.log('TEST 13 - no fertility conclusions');
  const st = () => app.store.getVivaState();
  const estimate = () => { try { return JSON.stringify(app.engine.calculateCycle(st().baseline, st().periods, today)); } catch (e) { return 'error: ' + e.message; } };
  const before = estimate();
  await mucus.saveMucus(D(-7), 'egg_white');
  check('cycle estimate identical after recording Egg-white', estimate() === before);
  const words = /fertil|ovulat/i;
  const texts = list.MUCUS_OBSERVATIONS.map((o) => o.label + ' ' + o.description).join(' ')
    + fs.readFileSync(path.join(ROOT, 'components/MucusSheet.tsx'), 'utf8')
    + fs.readFileSync(path.join(ROOT, 'app/daily-tracking.tsx'), 'utf8');
  check('no "fertile" or "ovulating" wording in the observations, the sheet or Daily Tracking', !words.test(texts));

  console.log('CALENDAR + INSIGHTS DATA');
  try {
    const cal = require('../constants/calendarModel');
    const dt = app.dates.keyToLocalDate(P);
    const cells = cal.buildCalendarMonth(dt.getFullYear(), dt.getMonth(), st().periods, null, [], today, app.pt.bleedingMarks(st().dailyLogs), { mucus: app.mt.mucusByDate(st().dailyLogs) });
    const cell = cells.find((c) => c.dateKey === P);
    check('calendar day carries the observation, nothing marked fertile', cell && cell.cervicalMucus === 'watery' && cell.isFertile === false, cell);
  } catch (e) {
    check('calendar model loads', false, String(e));
  }
  check('counts per observation', eq(mucus.getMucusCounts(), { dry: 0, sticky: 0, creamy: 1, watery: 2, egg_white: 1, other: 2 }), mucus.getMucusCounts());
  check('sequence in date order', mucus.getMucusSequence().map((s) => s.date).join() === Object.keys(app.mt.mucusByDate(st().dailyLogs)).sort().join());
  check('per-cycle summary', mucus.getCycleMucusSummaries().length === 1 && mucus.getCycleMucusSummaries()[0].counts.watery === 2);

  console.log('TEST 12 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  check('observations and note survived', app.mucus.getMucus(today).value === 'watery' && eq(app.mucus.getMucus(D(-2)), { value: 'other', note: 'Thicker than usual' }) && app.mucus.getMucus(P).value === 'watery');

  console.log('TEST 7 - clear');
  check('cleared', (await app.mucus.saveMucus(today, null)) === 'saved');
  check('card shows "Not tracked" (not Dry)', app.mucus.getMucus(today).value === null && app.model.fieldSummary(app.svc.readDailyRecord(today), 'cervicalMucus') === 'Not tracked');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
