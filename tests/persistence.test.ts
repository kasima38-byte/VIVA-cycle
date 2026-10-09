// Persistence: the REAL vivaStore + periodService, with an in-memory AsyncStorage.
// Never touches the phone's data. Run: npx -y tsx tests/persistence.test.ts
import { buildPeriodRecords, periodLengthView } from '../lib/periodLength';
const req: any = require; // Node's require (React Native types lack resolve/cache)

const mem = new Map<string, string>();
const fake = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => [...mem.keys()],
  multiGet: async (ks: string[]) => ks.map((k) => [k, mem.has(k) ? mem.get(k)! : null]),
  multiSet: async (kv: [string, string][]) => { kv.forEach(([k, v]) => mem.set(k, v)); },
  multiRemove: async (ks: string[]) => { ks.forEach((k) => mem.delete(k)); },
  clear: async () => { mem.clear(); },
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: fake } } as any;

/** Simulate an app (re)start: fresh modules, state loaded from storage. */
async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const store = require('../lib/vivaStore');
  const svc = require('../lib/periodService');
  await store.loadVivaStore();
  return { store, svc };
}
const settle = () => new Promise((r) => setTimeout(r, 50));
const TODAY = '2025-10-20';
const tapped = ['2025-07-02', '2025-07-03', '2025-07-04', '2025-08-01', '2025-08-02', '2025-08-03', '2025-08-04', '2025-09-01', '2025-09-02', '2025-09-03'];

let pass = 0, fail = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log('PASS  ' + name); pass++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + (e?.message ?? e)); fail++; }
}
function eq(a: unknown, b: unknown, what: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
const view = (logs: any) => periodLengthView(buildPeriodRecords(logs, TODAY, null), '6m', TODAY);
const bars = (v: any) => v.chart.map((c: any) => c.label + ' ' + c.value);

(async () => {
  await check('P1. Tapping days updates the store and writes to storage', async () => {
    const { store, svc } = await boot();
    store.completeSetup({ name: 'Test', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: null, periodLength: null, regularity: 'not_sure' } });
    await settle();
    for (const d of tapped) eq((await svc.togglePeriodDay(d)).result, 'saved', 'tap ' + d);
    eq(store.getVivaState().dailyLogs['2025-08-03']?.period, 'yes', 'in memory');
    if (mem.size === 0) throw new Error('nothing was written to storage');
  });

  await check('P2. After a restart the tapped days are restored and Insights matches', async () => {
    const { store, svc } = await boot();
    const logs = store.getVivaState().dailyLogs;
    eq(svc.getPeriodInfo('2025-08-03').status, 'period', 'Calendar day restored');
    eq(store.getVivaState().periods.map((p: any) => p.start), ['2025-07-01', '2025-08-01', '2025-09-01'], 'period starts');
    const v = view(logs);
    eq(bars(v), ['Jul 4', 'Aug 4', 'Sep 3'], 'bars'); eq(v.averageText, '3.7 days', 'average');
  });

  await check('P3. Removing a day persists across a restart; Insights recalculates', async () => {
    let { svc } = await boot();
    eq((await svc.togglePeriodDay('2025-08-04')).action, 'removed', 'untap');
    const { store, svc: svc2 } = await boot();
    if (svc2.getPeriodInfo('2025-08-04').status === 'period') throw new Error('Aug 4 came back after restart');
    const v = view(store.getVivaState().dailyLogs);
    eq(bars(v), ['Jul 4', 'Aug 3', 'Sep 3'], 'bars'); eq(v.averageText, '3.3 days', 'average');
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
