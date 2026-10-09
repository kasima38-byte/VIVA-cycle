// Sexual activity - Prompt 8 tests, run in the Codespace (no phone needed)
// Run: npx --yes tsx tests/sexualActivity.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const memory = new Map();
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); }, getAllKeys: async () => [...memory.keys()],
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
    sex: require('../lib/sexualActivityService'),
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
  let { svc, period, flow, sym, mucus, sex, model } = app;
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const other = D(-1), P = D(-5), P2 = D(-6);
  const rec = (d) => svc.readDailyRecord(d);
  const card = (d) => model.fieldSummary(rec(d), 'sexualActivity');

  console.log('OLDER SAVED VALUES');
  const n = (v) => model.normalizeRecord(D(-40), { sexualActivity: v }).sexualActivity;
  check('"none" -> No activity', eq(n('none'), { status: 'none', entries: [] }));
  check('"protected" -> activity, protection used', eq(n('protected'), { status: 'activity', entries: [{ protection: 'used' }] }));
  check('"unprotected" -> activity, protection not used', eq(n('unprotected'), { status: 'activity', entries: [{ protection: 'not_used' }] }));
  check('unknown values are never stored', n('yes') === null && n({ status: 'maybe' }) === null);

  console.log('TEST 1 - untracked date');
  check('Not tracked (not "No activity")', rec(today).sexualActivity === null && card(today) === 'Not tracked');

  console.log('TEST 2 / 3 - activity');
  check('saved', (await sex.saveSexualActivity(today, 'activity')) === 'saved');
  check('card shows only "Tracked"', card(today) === 'Tracked', card(today));
  check('protection is Not recorded unless chosen', eq(sex.getSexualActivity(today), { status: 'activity', entries: [{ protection: null }] }));

  console.log('TEST 4 / 5 - protection used -> not used');
  check('used saved', (await sex.saveSexualActivity(today, 'activity', 'used')) === 'saved' && sex.getSexualActivity(today).entries[0].protection === 'used');
  check('changed to not used', (await sex.saveSexualActivity(today, 'activity', 'not_used')) === 'saved');
  check('updated, not duplicated', eq(sex.getSexualActivity(today), { status: 'activity', entries: [{ protection: 'not_used' }] }), sex.getSexualActivity(today));
  check('same entry again writes nothing', (await sex.saveSexualActivity(today, 'activity', 'not_used')) === 'unchanged');

  console.log('PRIVACY');
  check('card and screen-reader text never show protection', card(today) === 'Tracked' && model.fieldFullText(rec(today), 'sexualActivity') === 'Tracked');
  await sex.saveSexualActivity(D(-2), 'activity', 'used');
  await sex.saveSexualActivity(D(-2), 'none', 'used');
  check('"No activity" keeps no protection', eq(sex.getSexualActivity(D(-2)), { status: 'none', entries: [] }));
  check('"No activity" also shows only "Tracked"', card(D(-2)) === 'Tracked');

  console.log('TEST 7 / 8 - other dates');
  check('another date does not inherit it', rec(other).sexualActivity === null && card(other) === 'Not tracked');
  check('original date keeps it', sex.getSexualActivity(today).entries[0].protection === 'not_used');

  console.log('VALIDATION');
  check('unknown status refused', (await sex.saveSexualActivity(today, 'yes')) === 'invalid');
  check('unknown protection refused', (await sex.saveSexualActivity(today, 'activity', 'maybe')) === 'invalid');
  check('future date refused', (await sex.saveSexualActivity(D(1), 'activity')) === 'future');
  check('no record created for the future date', !app.store.getVivaState().dailyLogs[D(1)]);

  console.log('TEST 9 - all seven coexist');
  await period.markPeriodDay(P);
  await flow.saveFlow(P, 'heavy');
  await sym.saveSymptoms(P, ['cramps']);
  await svc.updateDailyRecord(P, { mood: 'good', energy: 70 });
  await mucus.saveMucus(P, 'watery');
  await sex.saveSexualActivity(P, 'activity', 'used');
  const r9 = rec(P);
  check('period, flow, symptoms, mood, energy, mucus, sexual activity all kept',
    period.getPeriodInfo(P).status === 'period' && r9.flow === 'heavy' && eq(r9.symptoms, ['cramps']) && r9.mood === 'good' && r9.energy === 70 && r9.cervicalMucus === 'watery' && r9.sexualActivity.status === 'activity', r9);

  console.log('TEST 10 / 11 + others - independence');
  const keep = JSON.stringify(rec(P).sexualActivity);
  await period.markPeriodDay(P2);
  await period.removePeriodDay(P2);
  check('after changing period: unchanged', JSON.stringify(rec(P).sexualActivity) === keep);
  await mucus.saveMucus(P, 'egg_white');
  check('after changing cervical mucus: unchanged', JSON.stringify(rec(P).sexualActivity) === keep);
  await flow.saveFlow(P, 'light');
  await sym.saveSymptoms(P, ['cramps', 'bloating']);
  await svc.updateDailyRecord(P, { mood: 'okay', energy: 30 });
  check('after changing flow, symptoms, mood, energy: unchanged', JSON.stringify(rec(P).sexualActivity) === keep);
  check('Daily Tracking Save cannot change it', (await svc.updateDailyRecord(P, { sexualActivity: null })) === 'unchanged' && JSON.stringify(rec(P).sexualActivity) === keep);
  await sex.saveSexualActivity(P, 'activity', 'not_used');
  check('changing it leaves period and mucus alone', period.getPeriodInfo(P).status === 'period' && rec(P).cervicalMucus === 'egg_white');
  await mucus.saveMucus(D(-7), 'egg_white');
  check('Egg-white mucus never creates an activity entry', rec(D(-7)).sexualActivity === null);

  console.log('TEST 13 - nothing is inferred');
  const st = () => app.store.getVivaState();
  const estimate = () => { try { return JSON.stringify(app.engine.calculateCycle(st().baseline, st().periods, today)); } catch (e) { return 'error: ' + e.message; } };
  const before = estimate();
  await sex.saveSexualActivity(D(-3), 'activity', 'not_used');
  check('cycle estimate identical after recording activity', estimate() === before);
  const text = fs.readFileSync(path.join(ROOT, 'components/SexualActivitySheet.tsx'), 'utf8') + fs.readFileSync(path.join(ROOT, 'app/daily-tracking.tsx'), 'utf8');
  check('no pregnancy, fertility, ovulation or conception wording', !/pregnan|fertil|ovulat|concei/i.test(text));

  console.log('INSIGHTS DATA (optional, no conclusions)');
  const counts = sex.getSexualActivityCounts();
  check('activity days, no-activity days, protection counts', counts.activityDays === 3 && counts.noActivityDays === 1 && counts.protection.not_used === 3, counts);
  check('activity dates in order', eq(sex.getSexualActivityDates(), [P, D(-3), today].sort()));

  console.log('TEST 12 - restart');
  app = freshApp();
  await app.store.loadVivaStore();
  check('entries survived', app.sex.getSexualActivity(today).entries[0].protection === 'not_used' && app.sex.getSexualActivity(D(-2)).status === 'none');

  console.log('TEST 6 - clear');
  check('cleared', (await app.sex.saveSexualActivity(today, null)) === 'saved');
  check('Not tracked, and no protection left behind', app.sex.getSexualActivity(today) === null && app.model.fieldSummary(app.svc.readDailyRecord(today), 'sexualActivity') === 'Not tracked');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
