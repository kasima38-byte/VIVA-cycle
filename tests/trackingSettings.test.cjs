// Daily Tracking Settings - Prompt 14 tests (no phone needed)
// Run: npx --yes tsx tests/trackingSettings.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const memory = new Map();
let failing = false;
const fakeStorage = {
  getItem: async (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: async (k, v) => { if (failing) throw new Error('simulated storage failure'); memory.set(k, v); },
  removeItem: async (k) => { memory.delete(k); },
  getAllKeys: async () => [...memory.keys()], // like the real AsyncStorage (Clear lists damaged copies)
};
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: fakeStorage } };
const realWarn = console.warn;
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
    sym: require('../lib/symptomService'),
    ins: require('../lib/insightsService'),
    set: require('../lib/dailyTrackingSettingsService'),
    model: require('../lib/dailyTrackingSettings'),
    dates: require('../constants/dateUtils'),
  };
}
async function load() {
  const app = freshApp();
  await app.store.loadVivaStore();
  await app.set.loadTrackingSettings();
  await new Promise((r) => setTimeout(r, 30));
  return app;
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const daily = () => JSON.stringify([...memory.entries()].filter(([k]) => k.startsWith('viva-cycle:daily:')).sort());

async function main() {
  let app = await load();
  const today = app.dates.getToday();
  const D = (n) => app.dates.addDays(today, n);
  const S = () => app.set.getSettings();
  const day = D(-3);

  console.log('TEST 1 - defaults');
  check('every category on by default', Object.values(S()).every((v) => v === true));
  check('8 categories visible', app.model.visibleFields(S()).length === 8);

  await app.period.markPeriodDay(D(-10));
  await app.svc.updateDailyTrackingField(day, 'mood', 'good');
  await app.svc.updateDailyTrackingField(day, 'energy', 70);
  await app.sym.saveSymptoms(day, ['cramps']);
  const before = daily();

  console.log('TEST 2 - disable Mood');
  check('saved', (await app.set.updateSetting('moodEnabled', false)) === 'saved');
  check('Mood hidden, 7 visible', !app.model.isFieldVisible(S(), 'mood') && app.model.visibleFields(S()).length === 7);
  check('no daily record was touched', daily() === before);

  console.log('PROGRESS COUNTS ONLY SWITCHED-ON CATEGORIES');
  const p = app.model.trackingProgress(app.svc.readDailyRecord(day), S());
  check('energy + symptoms of 7 (hidden Mood not counted)', p.count === 2 && p.total === 7 && p.state === 'partial', p);

  console.log('TEST 9 - Period cannot be switched off');
  check('refused', (await app.set.updateSetting('periodEnabled', false)) === 'notAllowed' && S().periodEnabled === true);
  check('refused even inside a batch, nothing changed', (await app.set.updateSettings({ periodEnabled: false, energyEnabled: false })) === 'notAllowed' && S().energyEnabled === true);
  check('stored "off" is ignored on load', app.model.normalizeSettings({ periodEnabled: false }).periodEnabled === true);

  console.log('VALIDATION');
  check('unknown setting refused', (await app.set.updateSetting('streaksEnabled', true)) === 'invalid');
  check('non true/false refused', (await app.set.updateSetting('flowEnabled', 'yes')) === 'invalid');

  console.log('TEST 3 - restart');
  app = await load();
  check('Mood still hidden after restart', app.set.getSettings().moodEnabled === false);

  console.log('TEST 6 - Insights keep hidden data');
  const i = app.ins.getInsights(day, day);
  check('Mood still counted in Insights', i.mood.recordedDays === 1 && i.mood.distribution.good === 1);

  console.log('TEST 8 - date isolation');
  await app.set.updateSetting('energyEnabled', false);
  for (const d of [D(-1), D(-2), day, D(-4)]) app.svc.readDailyRecord(d);
  check('Energy hidden on every date (one setting, not per day)', !app.model.isFieldVisible(app.set.getSettings(), 'energy'));
  check('no daily record was modified', daily() === before);
  check('settings never stored inside daily records', !/Enabled/.test(daily()));
  check('settings live under their own key', memory.has('viva-cycle:daily-tracking-settings'));

  console.log('SAVE FAILURE');
  failing = true;
  check('failure reported', (await app.set.updateSetting('flowEnabled', false)) === 'failed');
  check('the switch goes back', app.set.getSettings().flowEnabled === true);
  failing = false;

  console.log('TEST 7 - reset');
  await app.set.updateSetting('cervicalMucusEnabled', false);
  check('reset saved', (await app.set.resetSettings()) === 'saved');
  check('all visible again', app.model.visibleFields(app.set.getSettings()).length === 8);
  check('no historical data deleted', daily() === before);

  console.log('TEST 4 / 5 - re-enable keeps the data');
  await app.set.updateSetting('moodEnabled', false);
  await app.set.updateSetting('moodEnabled', true);
  check('Mood visible again and still Good', app.model.isFieldVisible(app.set.getSettings(), 'mood') && app.svc.readDailyRecord(day).mood === 'good');

  console.log('TEST 10 - clear data only after explicit confirmation');
  const summary = app.svc.getClearSummary();
  check('the summary is read-only', daily() === before && summary.daysAffected === 1 && summary.periodDaysKept === 1, summary);
  const historyBefore = JSON.stringify(app.ins.getCycleHistory());
  check('confirmed clear works', (await app.svc.clearAllTrackingData()) === 'saved');
  const r = app.svc.readDailyRecord(day);
  check('mood, energy and symptoms removed', r.mood === null && r.energy === null && r.symptoms === null);
  check('period days kept: cycle history unchanged', app.period.getPeriodInfo(D(-10)).status === 'period' && JSON.stringify(app.ins.getCycleHistory()) === historyBefore);
  check('Insights no longer include the cleared data', app.ins.getInsights(day, day).mood.status === 'insufficient');
  check('nothing left to clear', (await app.svc.clearAllTrackingData()) === 'unchanged');
  check('settings untouched by clearing', app.model.visibleFields(app.set.getSettings()).length === 8);

  console.log('SCREENS');
  const screen = fs.readFileSync(path.join(ROOT, 'app/daily-tracking.tsx'), 'utf8');
  const settingsScreen = fs.readFileSync(path.join(ROOT, 'app/daily-tracking-settings.tsx'), 'utf8');
  check('Daily Tracking hides switched-off categories and counts only those on', /isFieldVisible\(trackingSettings, c\.field\)/.test(screen) && /trackingProgress\(record, trackingSettings\)/.test(screen));
  check('clearing has a confirmation with Cancel and an explicit "Clear Data"', /Clear Daily Tracking Data\?/.test(settingsScreen) && /'Clear Data'/.test(settingsScreen) && />Cancel</.test(settingsScreen) && /can't be undone/.test(settingsScreen));
  check('Period is shown as Required', /Required/.test(settingsScreen));
  check('no fake Export / Backup buttons', !/onPress=\{[^}]*(export|backup)/i.test(settingsScreen));

  console.warn = realWarn;
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.warn = realWarn; console.error('TEST RUN CRASHED:', e); process.exit(1); });
