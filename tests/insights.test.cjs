// Insights calculation layer - Prompt 13 tests (no phone needed)
// Run: npx --yes tsx tests/insights.test.cjs
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
    sex: require('../lib/sexualActivityService'),
    meds: require('../lib/medicationService'),
    ins: require('../lib/insightsService'),
    calc: require('../lib/insights'),
    dates: require('../constants/dateUtils'),
  };
}
const settle = () => new Promise((r) => setTimeout(r, 30));

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  let app = freshApp();
  await app.store.loadVivaStore();
  let { svc, period, flow, sym, mucus, sex, meds, ins, calc, dates } = app;
  const today = dates.getToday();
  const D = (n) => dates.addDays(today, n);
  const set = (d, field, v) => svc.updateDailyTrackingField(d, field, v);

  console.log('EMPTY STATE');
  const empty = ins.getInsightsForRange('last_12_months');
  check('no data -> empty state with a neutral message', empty.isEmpty && empty.emptyMessage === 'Your insights will appear here as you track your cycle.');
  check('every section is insufficient', ['cycles', 'flow', 'symptoms', 'mood', 'energy', 'cervicalMucus', 'sexualActivity', 'medications'].every((k) => empty[k].status === 'insufficient'));

  console.log('TEST 2 - only one period start');
  const S3 = D(-13);
  await period.markPeriodDay(S3);
  let y = ins.getInsightsForRange('last_12_months');
  check('cycle length: Not enough data (no number invented)', y.cycles.averageCycleLength === null && y.cycles.averageCycleLengthText === 'Not enough data' && y.cycles.status === 'insufficient');
  check('one day shown as "1 bleeding day recorded", no period length', y.cycles.history[0].periodLabel === '1 bleeding day recorded' && y.cycles.averagePeriodLength === null);
  check('the cycle is in progress', y.cycles.history[0].completeness === 'in_progress');

  console.log('TEST 1 - two complete cycles (28 days / 4 bleeding days, 29 days / 5 bleeding days)');
  const S1 = D(-70), S2 = dates.addDays(S1, 28);
  await period.savePeriodRange(S1, dates.addDays(S1, 3));
  await period.savePeriodRange(S2, dates.addDays(S2, 4));
  await period.markPeriodDay(dates.addDays(S3, 1));
  check('setup: third cycle starts 29 days after the second', dates.addDays(S2, 29) === S3);
  const hist = ins.getCycleHistory();
  check('3 cycles: complete, complete, in progress', eq(hist.map((c) => c.completeness), ['complete', 'complete', 'in_progress']) && eq(hist.map((c) => c.cycleLength), [28, 29, null]));
  check('period length counted from bleeding days only (a finished period counts even before the next one)', eq(hist.map((c) => c.recordedPeriodDays), [4, 5, 2]) && eq(hist.map((c) => c.periodLength), [4, 5, 2]));
  const l3 = ins.getInsightsForRange('last_3_cycles');
  check('average cycle length 28.5 days', l3.cycles.averageCycleLength === 28.5 && l3.cycles.averageCycleLengthText === '28.5 days');
  check('average period length 4.5 days', l3.cycles.averagePeriodLength === 4.5);
  check('2 cycles = limited, with a basis line', l3.cycles.status === 'limited' && l3.cycles.basis === 'Based on 2 completed cycles');
  const prev = ins.getInsightsForRange('previous_cycle');
  check('previous cycle = the 29-day cycle', prev.range.start === S2 && prev.cycles.averageCycleLength === 29);
  const cur = ins.getInsightsForRange('current_cycle');
  check('current cycle runs to today and has no cycle length yet', cur.range.start === S3 && cur.range.end === today && cur.cycles.averageCycleLength === null);

  console.log('TEST 3 - symptom ranking');
  for (let i = 0; i < 5; i++) await sym.saveSymptoms(D(-30 + i), i < 3 ? ['cramps', 'headache'] : ['cramps']);
  const s3 = ins.getInsights(D(-30), D(-26));
  check('Cramps 5 days, then Headache 3 days', eq(s3.symptoms.ranking, [{ id: 'cramps', days: 5 }, { id: 'headache', days: 3 }]), s3.symptoms.ranking);
  check('stored as IDs (labels are for the UI)', s3.symptoms.ranking.every((r) => /^[a-zA-Z]+$/.test(r.id)));

  console.log('TEST 4 - mood distribution');
  const moods = ['good', 'good', 'good', 'good', 'good', 'great', 'great', 'great', 'low'];
  for (let i = 0; i < moods.length; i++) await set(D(-40 + i), 'mood', moods[i]);
  const m4 = ins.getInsights(D(-40), D(-32));
  check('Good 5, Great 3, Low 1', eq(m4.mood.distribution, { very_low: 0, low: 1, okay: 0, good: 5, great: 3 }), m4.mood.distribution);
  check('average shown in words, never as a number', m4.mood.average === 'good' && m4.mood.averageText === 'Your average recorded mood was Good.');
  check('basis line', m4.mood.basis === 'Based on 9 recorded mood days');
  const few = ins.getInsights(D(-40), D(-39));
  check('2 mood days: limited, "Not enough mood data yet."', few.mood.status === 'limited' && few.mood.average === null && few.mood.averageText === 'Not enough mood data yet.');

  console.log('TEST 5 - energy');
  await set(D(-50), 'energy', 60);
  await set(D(-49), 'energy', 70);
  await set(D(-48), 'energy', 80);
  const e5 = ins.getInsights(D(-50), D(-48));
  check('average 70, label High, highest 80, lowest 60', e5.energy.average === 70 && e5.energy.averageLabel === 'High' && e5.energy.highest === 80 && e5.energy.lowest === 60 && e5.energy.recordedDays === 3);

  console.log('TEST 6 - missing days are not zero');
  await set(D(-60), 'energy', 70);
  await set(D(-59), 'energy', 72);
  await set(D(-57), 'energy', 68);
  const series = ins.getEnergySeries(D(-60), D(-57)).map((p) => p.value);
  check('series 70, 72, null, 68', eq(series, [70, 72, null, 68]), series);
  check('average uses recorded days only (70, not 52.5)', ins.getInsights(D(-60), D(-57)).energy.average === 70);

  console.log('FLOW DISTRIBUTION');
  const flows = ['heavy', 'heavy', 'medium', 'medium', 'medium', 'medium', 'light', 'light', 'light', 'spotting'];
  for (let i = 0; i < flows.length; i++) await flow.saveFlow(D(-100 + i * 2), flows[i]); // every other day untracked
  const f = ins.getInsights(D(-100), D(-82));
  check('counts only recorded days', f.flow.recordedDays === 10 && f.flow.counts.heavy === 2 && f.flow.counts.medium === 4);
  check('20% / 40% / 30% / 10% of recorded observations', eq(f.flow.distribution, { spotting: 10, light: 30, medium: 40, heavy: 20 }), f.flow.distribution);

  console.log('OTHER SECTIONS - neutral counts');
  await mucus.saveMucus(D(-90), 'watery');
  await mucus.saveMucus(D(-89), 'watery');
  await mucus.saveMucus(D(-88), 'egg_white');
  await sex.saveSexualActivity(D(-90), 'activity');
  await sex.saveSexualActivity(D(-89), 'none');
  await meds.addMedication(D(-90), { name: 'Ibuprofen' });
  await meds.addMedication(D(-89), { name: 'ibuprofen' });
  await meds.addMedication(D(-89), { name: 'Iron' });
  const o = ins.getInsights(D(-90), D(-88));
  check('mucus counted, untracked never "dry"', o.cervicalMucus.counts.watery === 2 && o.cervicalMucus.counts.egg_white === 1 && o.cervicalMucus.counts.dry === 0);
  check('sexual activity: counts only', o.sexualActivity.activityDays === 1 && o.sexualActivity.noActivityDays === 1);
  check('medications: entries, days, most recorded name', o.medications.entries === 3 && o.medications.daysWithRecords === 2 && o.medications.mostRecorded[0].name === 'Ibuprofen' && o.medications.mostRecorded[0].days === 2);

  console.log('PARTIAL DATA');
  const p = ins.getInsights(D(-50), D(-48));
  check('energy available while symptoms and mucus are insufficient', p.energy.status === 'sufficient' && p.symptoms.status === 'insufficient' && p.cervicalMucus.status === 'insufficient');

  console.log('TRENDS (neutral)');
  check('direction needs 3 values', calc.trendOf([50, 60]) === 'insufficient' && calc.trendOf([50, 60, 70]) === 'increasing' && calc.trendOf([70, 60, 50]) === 'decreasing' && calc.trendOf([60, 61, 60]) === 'stable');
  check('neutral wording', calc.trendText('energy', 'increasing') === 'Your recorded energy has increased over these cycles.' && calc.trendText('energy', 'insufficient') === null);

  console.log('TEST 7 - live update, never stale');
  const a = ins.getInsights(D(-40), D(-32));
  check('same data -> same cached result', ins.getInsights(D(-40), D(-32)) === a);
  await set(D(-32), 'mood', 'great');
  const b = ins.getInsights(D(-40), D(-32));
  check('a saved change recalculates', b !== a && b.mood.distribution.great === 4 && b.mood.distribution.low === 0, b.mood.distribution);

  console.log('NO DIAGNOSTIC OR PREDICTIVE WORDING');
  const text = fs.readFileSync(path.join(ROOT, 'lib/insights.ts'), 'utf8') + fs.readFileSync(path.join(ROOT, 'lib/insightsService.ts'), 'utf8');
  const bad = text.match(/abnormal|ovulat|fertil|pregnan|\bPMS\b|anemi|infection|hormon|diagnos|disease/i);
  check('none found in the Insights layer', !bad, bad && bad[0]);

  console.log('TEST 8 - restart');
  const before = JSON.stringify(ins.getInsightsForRange('last_12_months'));
  await settle();
  app = freshApp();
  await app.store.loadVivaStore();
  check('insights rebuilt identically from saved data', JSON.stringify(app.ins.getInsightsForRange('last_12_months')) === before);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('TEST RUN CRASHED:', e); process.exit(1); });
