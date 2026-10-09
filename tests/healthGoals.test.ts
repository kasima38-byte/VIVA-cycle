// My Health Goals: route, one canonical goal, persistence, Home visibility rule, safety.
// REAL store / Home summary / cycle engine, in-memory AsyncStorage.
// Run: npx -y tsx tests/healthGoals.test.ts
const req: any = require; // Node's require
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

const mem = new Map<string, string>();
let failSet = false;
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { if (failSet) throw new Error('simulated'); mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => [...mem.keys()],
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };
const realWarn = console.warn;
console.warn = () => {};

async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    store: req('../lib/vivaStore'),
    period: req('../lib/periodService'),
    goals: req('../lib/goals'),
    home: req('../constants/homeData'),
    my: req('../lib/myData'),
    engine: req('../lib/cycleEngine'),
  };
  await app.store.loadVivaStore();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
const TODAY = '2025-08-10'; // a few days after her last period: estimates exist, not late

async function seed(goal: string) {
  mem.clear();
  failSet = false;
  let app = await boot();
  app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal });
  await settle();
  for (const d of ['2025-07-02', '2025-07-03', '2025-08-01', '2025-08-02', '2025-08-03']) await app.period.togglePeriodDay(d);
  await app.store.saveDailyLog('2025-08-05', { mood: 'good' });
  await settle();
  app = await boot();
  return app;
}
const coreGoal = () => JSON.parse(mem.get('viva-cycle:data')!).goal;
const records = () => JSON.stringify([...mem.entries()].filter(([k]) => k.startsWith('viva-cycle:daily:')).sort());

let pass = 0, fail = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try { await fn(); console.log('PASS  ' + name); pass++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + (e?.message ?? e)); fail++; }
}
function ok(c: unknown, what: string) { if (!c) throw new Error(what); }
function eq(a: unknown, b: unknown, what: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

(async () => {
  // ---------- 1. Profile row ----------
  await check('G1. The Profile My Health Goals row routes to /my-health-goals, and the screen exists', () => {
    const profile = read('app/(tabs)/profile.tsx');
    const row = profile.split('\n').find((l) => l.includes("title: 'My Health Goals'")) ?? '';
    ok(/route: '\/my-health-goals'/.test(row), 'row: ' + row.trim());
    ok(/icon: 'flag'/.test(row) && /subtitle: 'Set and track your health goals'/.test(row), 'row design unchanged');
    ok(/export default function MyHealthGoalsScreen/.test(read('app/my-health-goals.tsx')), 'screen');
  });

  // ---------- 2. Loads from saved data ----------
  await check('G2. The selected goal comes from saved data (one setting, no local copy)', async () => {
    const app = await seed('conceive');
    eq(app.store.getVivaState().goal, 'conceive', 'loaded after restart');
    const screen = read('app/my-health-goals.tsx');
    ok(/const \{ goal \} = useVivaStore\(\);/.test(screen), 'screen reads the store');
    ok(!/useState<Goal|AsyncStorage|setItem/.test(screen), 'no separate goal state or storage');
    ok(/import \{ setGoal, useVivaStore \} from '..\/lib\/vivaStore'/.test(screen), 'saves through the store');
    ok(/setGoal\(g\.key\)/.test(read('app/cycle-settings.tsx')), 'Cycle Settings writes the same setting');
  });

  // ---------- 3. Changing it updates the canonical store ----------
  await check('G3. Changing the goal updates the store, the phone, and everything that reads it', async () => {
    const app = await seed('track');
    eq(await app.store.setGoal('avoid'), true, 'saved');
    eq([app.store.getVivaState().goal, coreGoal()], ['avoid', 'avoid'], 'memory / phone');
    const st = app.store.getVivaState();
    eq(app.home.getHomeSummary(st, TODAY).goal, 'avoid', 'Home');
    eq(app.my.getMyDataSummary(st).goal, 'avoid', 'My Data');
    eq(app.goals.goalLabel(st.goal), 'Avoid pregnancy', 'Cycle Settings label');
  });

  // ---------- 4. Survives restart ----------
  await check('G4. The new goal survives an app restart', async () => {
    let app = await seed('track');
    await app.store.setGoal('understand');
    app = await boot();
    eq(app.store.getVivaState().goal, 'understand', 'after restart');
  });

  // ---------- 5. Home visibility ----------
  await check('G5. Home shows fertile-window and ovulation estimates only for the fertility goals', async () => {
    const app = await seed('track');
    const expected: Record<string, boolean> = { conceive: true, avoid: true, track: false, understand: false };
    for (const g of Object.keys(expected)) {
      await app.store.setGoal(g);
      const h = app.home.getHomeSummary(app.store.getVivaState(), TODAY);
      eq(h.showFertilityEstimates, expected[g], 'Home estimates for ' + g);
    }
    eq(app.goals.showsFertilityEstimatesOnHome(null), true, 'not set: unchanged from before goals');
    const index = read('app/(tabs)/index.tsx');
    ok(/\{summary\.showFertilityEstimates \? \(\s*<>\s*<MiniIconRow icon="calendar" label="Estimated fertile window"[\s\S]*?label="Estimated ovulation"[\s\S]*?<\/>\s*\) : null\}/.test(index),
      'Home wraps both estimate rows in the rule');
  });

  await check('G5b. Guidance follows the goal; the conception card is hidden for "Avoid pregnancy"', async () => {
    const app = await seed('conceive');
    const note = (g: string) => { void g; return app.home.getHomeSummary(app.store.getVivaState(), TODAY).goalNote as string | null; };
    ok(/fertile window/i.test(note('conceive') ?? ''), 'conceive guidance');
    await app.store.setGoal('avoid');
    ok(/not be your only method of contraception/.test(note('avoid') ?? ''), 'avoid guidance');
    await app.store.setGoal('track');
    eq(note('track'), null, 'track: no conception/contraception emphasis');
    eq([app.goals.showsConceptionCard('avoid'), app.goals.showsConceptionCard('conceive'), app.goals.showsConceptionCard(null)],
      [false, true, true], 'conception card rule');
    ok(/showsConceptionCard\(viva\.goal\) \? \(\s*<TryingToConceiveCard/.test(read('app/fertility.tsx')), 'Fertility uses the rule');
    const pregnancyLinks = ['app/my-health-goals.tsx', 'app/(tabs)/index.tsx', 'app/fertility.tsx']
      .filter((f) => /PREGNANCY_LINK|VIVA Pregnancy/.test(read(f)));
    eq(pregnancyLinks, [], 'no new VIVA Pregnancy promotions');
    ok(/PREGNANCY_LINK/.test(read('app/(tabs)/profile.tsx')), 'Profile entry point kept');
  });

  // ---------- 6. Bleeding records untouched ----------
  await check('G6. Changing goals never changes bleeding records or cycle dates', async () => {
    const app = await seed('track');
    const before = { logs: JSON.stringify(app.store.getVivaState().dailyLogs), periods: JSON.stringify(app.store.getVivaState().periods), stored: records() };
    const est0 = JSON.stringify(app.engine.calculateCycle(app.store.getVivaState().baseline, app.store.getVivaState().periods, TODAY));
    for (const g of ['conceive', 'avoid', 'understand', 'track', 'conceive']) {
      await app.store.setGoal(g);
      const st = app.store.getVivaState();
      eq(JSON.stringify(app.engine.calculateCycle(st.baseline, st.periods, TODAY)), est0, 'cycle estimates with ' + g);
    }
    eq({ logs: JSON.stringify(app.store.getVivaState().dailyLogs), periods: JSON.stringify(app.store.getVivaState().periods), stored: records() },
      before, 'records in memory and on the phone');
  });

  // ---------- 7. Failed save ----------
  await check('G7. A failed save is not shown as saved, and the goal stays as it was', async () => {
    const app = await seed('track');
    failSet = true;
    eq(await app.store.setGoal('conceive'), false, 'reports failure');
    failSet = false;
    eq([app.store.getVivaState().goal, coreGoal()], ['track', 'track'], 'unchanged in memory and on the phone');
    const m = app.goals.goalSaveMessage(false, 'conceive');
    ok(m.kind === 'error' && !/Saved/.test(m.text) && /hasn't changed/.test(m.text), m.text);
    const ok2 = app.goals.goalSaveMessage(true, 'conceive');
    eq(ok2, { kind: 'info', text: 'Saved. Your goal is now "Try to get pregnant".' }, 'success text only when saved');
    ok(/goalSaveMessage\(await setGoal\(next\), next\)/.test(read('app/my-health-goals.tsx')), 'screen message follows the real result');
  });

  // ---------- 8. Unsupported values ----------
  await check('G8. Unsupported goal values are refused, and bad saved values load as "not set"', async () => {
    let app = await seed('track');
    const before = mem.get('viva-cycle:data');
    for (const bad of ['pregnant', 'fertility', '', 42, {}, 'CONCEIVE']) {
      eq(await app.store.setGoal(bad), false, 'refused ' + JSON.stringify(bad));
    }
    eq([app.store.getVivaState().goal, mem.get('viva-cycle:data')], ['track', before], 'nothing changed');
    const core = JSON.parse(mem.get('viva-cycle:data')!);
    core.goal = 'pregnant';
    mem.set('viva-cycle:data', JSON.stringify(core));
    app = await boot();
    const st = app.store.getVivaState();
    eq([st.loadError, st.goal, st.periods.length], [false, null, 2], 'loads safely, records intact');
    eq(app.goals.goalLabel('pregnant'), 'Not set', 'label');
    const h = app.home.getHomeSummary(st, TODAY);
    eq([h.goalNote, h.showFertilityEstimates], [null, true], 'Home with no goal');
    eq(app.my.getMyDataSummary(st).goal, null, 'My Data');
  });

  // ---------- Wording ----------
  await check('G9. Goal descriptions make no guarantees, diagnoses or medical recommendations', async () => {
    const { goals } = await boot();
    const text = goals.GOAL_OPTIONS.map((o: any) => o.label + ' ' + o.detail + ' ' + o.changes).join(' ') + read('app/my-health-goals.tsx');
    for (const bad of [/safe days?/i, /guaranteed? (to|that|you)/i, /will get pregnant/i, /can'?t get pregnant/i, /you are (pregnant|fertile|infertile)/i,
      /diagnose (your|you)/i, /you should (take|stop)/i]) ok(!bad.test(text), 'forbidden: ' + bad);
    ok(/pregnancy is never guaranteed/.test(text), 'conceive caveat');
    ok(/not contraception/.test(text), 'avoid caveat');
    ok(/can't diagnose fertility or pregnancy/.test(text), 'no diagnosis');
    eq(goals.GOALS, ['understand', 'track', 'conceive', 'avoid'], 'same goals as the data model');
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
