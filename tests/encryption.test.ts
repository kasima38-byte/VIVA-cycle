// Encryption at rest: REAL store + encryption layer + migration, real AES-256-GCM (Node crypto),
// in-memory AsyncStorage and Keychain with switchable failures. Never touches the phone.
// Run: npx -y tsx tests/encryption.test.ts
import { keychain, resetSecurity, secureFaults } from './support/securityFakes';
const req: any = require; // Node's require
const Buffer: any = req('buffer').Buffer;
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

// ---------- Fake AsyncStorage with "fail from the n-th write" ----------
const mem = new Map<string, string>();
const faults = { failWritesFrom: -1, writes: 0, failList: false };
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => {
    if (faults.failWritesFrom >= 0 && faults.writes++ >= faults.failWritesFrom) throw new Error('simulated: app closed');
    mem.set(k, v);
  },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => { if (faults.failList) throw new Error('simulated'); return [...mem.keys()]; },
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };
const notifPath = req.resolve('expo-notifications');
req.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: { __esModule: true,
  setNotificationHandler: () => {}, getPermissionsAsync: async () => ({ granted: false }),
  cancelAllScheduledNotificationsAsync: async () => {}, dismissAllNotificationsAsync: async () => {},
  getAllScheduledNotificationsAsync: async () => [], addNotificationResponseReceivedListener: () => ({ remove() {} }),
  SchedulableTriggerInputTypes: {}, AndroidImportance: {} } };
const rnPath = req.resolve('react-native');
req.cache[rnPath] = { id: rnPath, filename: rnPath, loaded: true, exports: { Platform: { OS: 'android' } } };

const warnings: string[] = [];
const realWarn = console.warn;
console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); };

async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    store: req('../lib/vivaStore'),
    settings: req('../lib/dailyTrackingSettingsService'),
    del: req('../lib/dataDeletionService'),
    setup: req('../lib/encryptionSetup'),
    cipher: req('../lib/cipher'),
  };
  await app.store.loadVivaStore();
  await app.settings.loadTrackingSettings();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
/** Let saves still running from the previous test finish before clearing (test isolation). */
const reset = async () => {
  await settle();
  await settle();
  mem.clear();
  resetSecurity();
  Object.assign(faults, { failWritesFrom: -1, writes: 0, failList: false });
  warnings.length = 0;
};
const snapshot = () => JSON.stringify([...mem.entries()].sort());
const appKeys = () => [...mem.keys()].filter((k) => k.startsWith('viva-cycle:')).sort();
const SECRET = /Amina|cramps|not_used|Painkiller|1995-04-02|2025-0[78]-0\d/;

/** The data an older version (no encryption) left on the phone: plain-text JSON. */
async function seedPlainOldVersion() {
  await reset();
  const core = { version: 3, layout: 'monthly', dailyMonths: ['2025-07', '2025-08'], setupComplete: true, name: 'Amina',
    dateOfBirth: '1995-04-02', baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: 'avoid',
    periods: [{ start: '2025-07-01' }], reminders: { period: true }, discreetNotifications: true };
  mem.set('viva-cycle:data', JSON.stringify(core));
  mem.set('viva-cycle:data-backup', JSON.stringify(core));
  mem.set('viva-cycle:daily:2025-07', JSON.stringify({
    '2025-07-01': { date: '2025-07-01', period: 'yes', schemaVersion: 1 },
    '2025-07-02': { date: '2025-07-02', period: 'yes', symptoms: ['cramps'], schemaVersion: 1 },
    '2025-07-20': { date: '2025-07-20', sexualActivity: { status: 'activity', entries: [{ protection: 'not_used' }] }, schemaVersion: 1 },
  }));
  mem.set('viva-cycle:daily:2025-08', JSON.stringify({
    '2025-08-01': { date: '2025-08-01', period: 'yes', medications: [{ id: 'p', name: 'Painkiller' }], schemaVersion: 1 },
  }));
  mem.set('viva-cycle:daily-tracking-settings', JSON.stringify({ moodEnabled: false, schemaVersion: 1 }));
  mem.set('viva-cycle:damaged:2025-05', 'unreadable old month mentioning cramps');
  mem.set('@other-app:token', 'not ours');
}
const sameData = (st: any) =>
  JSON.stringify([st.name, st.goal, st.periods.map((p: any) => p.start), Object.keys(st.dailyLogs).sort(),
    st.dailyLogs['2025-07-02']?.symptoms, st.dailyLogs['2025-08-01']?.medications?.[0]?.name]);
const EXPECTED = JSON.stringify(['Amina', 'avoid', ['2025-07-01', '2025-08-01'], ['2025-07-01', '2025-07-02', '2025-07-20', '2025-08-01'], ['cramps'], 'Painkiller']);

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
  await check('E1. New install: every saved value is encrypted; nothing personal is readable on disk', async () => {
    await reset();
    const app = await boot();
    eq(appKeys(), [], 'starting the app writes nothing');
    app.store.completeSetup({ name: 'Amina', dateOfBirth: '1995-04-02', lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: 'avoid' });
    await settle();
    await app.store.saveDailyLog('2025-07-02', { symptoms: ['cramps'] });
    await app.settings.updateSetting('moodEnabled', false);
    ok(keychain.has('viva-cycle.data-key'), 'key in the Keychain');
    for (const k of appKeys()) ok(mem.get(k)!.startsWith('vc1:'), 'not encrypted: ' + k);
    ok(!SECRET.test(snapshot()), 'personal text readable in storage');
    const again = await boot();
    eq([again.store.getVivaState().name, again.store.getVivaState().dailyLogs['2025-07-02'].symptoms, again.settings.getSettings().moodEnabled],
      ['Amina', ['cramps'], false], 'everything reads back after a restart');
  });

  await check('E2. Upgrade from an older version: every record is encrypted, nothing lost', async () => {
    await seedPlainOldVersion();
    const app = await boot();
    const st = app.store.getVivaState();
    eq([st.loadError, sameData(st)], [false, EXPECTED], 'same data after upgrade');
    for (const k of appKeys().filter((k) => k !== 'viva-cycle:encryption')) ok(mem.get(k)!.startsWith('vc1:'), 'still plain: ' + k);
    eq(JSON.parse(mem.get('viva-cycle:encryption')!), { version: 1, state: 'done' }, 'marker');
    ok(!SECRET.test(snapshot()), 'personal text still readable');
    eq(mem.get('@other-app:token'), 'not ours', "another app's value untouched");
    eq(app.settings.getSettings().moodEnabled, false, 'settings kept');
    eq(app.store.getDamagedMonthCount(), 1, 'damaged copy kept, set aside');
  });

  await check('E3. Upgrade interrupted at EVERY write: each restart is safe and finishes the job', async () => {
    for (let n = 0; n <= 8; n++) {
      await seedPlainOldVersion();
      faults.failWritesFrom = n;
      const crashed = await boot();
      const st = crashed.store.getVivaState();
      if (st.loadError) {
        eq(await crashed.store.saveDailyLog('2025-09-01', { mood: 'good' }), false, 'saving blocked after crash ' + n);
      }
      for (const k of appKeys()) {
        const v = mem.get(k)!;
        ok(!v.startsWith('vc1:') || (await crashed.cipher.decryptValue(await (await import('../lib/dataKey')).readDataKey(), k, v)) !== undefined,
          'unreadable value after crash ' + n + ' at ' + k);
      }
      faults.failWritesFrom = -1;
      faults.writes = 0;
      const after = await boot();
      eq([after.store.getVivaState().loadError, sameData(after.store.getVivaState())], [false, EXPECTED], 'data after restart (crash at write ' + n + ')');
      for (const k of appKeys().filter((k) => k !== 'viva-cycle:encryption')) ok(mem.get(k)!.startsWith('vc1:'), 'plain after restart: ' + k + ' (crash ' + n + ')');
    }
  });

  await check('E4. Key not safely stored: nothing is encrypted, nothing is lost, saving is blocked', async () => {
    await seedPlainOldVersion();
    const before = snapshot();
    secureFaults.dropWrites = true; // the Keychain "accepts" the key but doesn't keep it
    const app = await boot();
    eq(app.store.getVivaState().loadError, true, 'not loaded as a new user');
    eq(snapshot(), before, 'every record untouched');
    eq(await app.store.saveDailyLog('2025-09-01', { mood: 'good' }), false, 'saving blocked');
    secureFaults.dropWrites = false;
    await app.store.retryLoadVivaStore();
    eq(sameData(app.store.getVivaState()), EXPECTED, 'Try again works once the Keychain does');
  });

  await check('E5. Keychain unreadable: load error, nothing written; Try again recovers', async () => {
    await reset();
    let app = await boot();
    app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    secureFaults.get = true;
    const before = snapshot();
    app = await boot();
    eq([app.store.getVivaState().loadError, app.store.getVivaState().setupComplete], [true, false], 'error, never Welcome-as-new');
    eq(snapshot(), before, 'nothing written');
    secureFaults.get = false;
    await app.store.retryLoadVivaStore();
    eq([app.store.getVivaState().loadError, app.store.getVivaState().name], [false, 'Amina'], 'recovered');
  });

  await check('E6. Encrypted records but the key is gone: never starts over, never overwrites', async () => {
    await reset();
    let app = await boot();
    app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    keychain.clear(); // e.g. Keychain item lost
    const before = snapshot();
    app = await boot();
    eq(app.store.getVivaState().loadError, true, 'load error');
    eq(keychain.size, 0, 'no new key made over her data');
    eq(snapshot(), before, 'records untouched');
    eq(await app.store.saveDailyLog('2025-09-01', { mood: 'good' }), false, 'saving blocked');
    ok(warnings.some((w) => /keyMissing/.test(w)), 'reason logged (no data)');
  });

  await check('E7. Wrong key: nothing is read as data, nothing is removed (not even the journal)', async () => {
    await reset();
    let app = await boot();
    app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    mem.set('viva-cycle:journal', await app.cipher.encryptValue(await (await import('../lib/dataKey')).readDataKey(), 'viva-cycle:journal', '{"sets":[],"removes":[]}'));
    keychain.set('viva-cycle.data-key', Buffer.from(new Uint8Array(32).fill(7)).toString('base64')); // a different key
    const before = snapshot();
    app = await boot();
    eq(app.store.getVivaState().loadError, true, 'load error');
    eq(snapshot(), before, 'nothing changed, journal kept');
  });

  await check('E8. A changed record is set aside; a changed profile falls back to the backup', async () => {
    await reset();
    let app = await boot();
    app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    await app.store.saveDailyLog('2025-08-03', { mood: 'good' });
    app = await boot(); // writes the backup copy
    const flip = (k: string) => { const v = mem.get(k)!; mem.set(k, v.slice(0, 20) + (v[20] === 'A' ? 'B' : 'A') + v.slice(21)); };
    flip('viva-cycle:daily:2025-08');
    flip('viva-cycle:data');
    app = await boot();
    const st = app.store.getVivaState();
    eq([st.loadError, st.name, st.dailyLogs['2025-07-01']?.period, st.dailyLogs['2025-08-03']], [false, 'Amina', 'yes', undefined], 'loaded from backup, changed month left out');
    ok(mem.has('viva-cycle:damaged:2025-08'), 'changed month set aside, not deleted');
  });

  await check('E9. A value moved to another key name will not decrypt there', async () => {
    await reset();
    const app = await boot();
    app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    const key = await (await import('../lib/dataKey')).readDataKey();
    const sealed = await app.cipher.encryptValue(key, 'viva-cycle:daily:2025-07', '{"x":1}');
    eq(await app.cipher.decryptValue(key, 'viva-cycle:daily:2025-07', sealed), '{"x":1}', 'right name');
    let threw = false;
    try { await app.cipher.decryptValue(key, 'viva-cycle:daily:2025-08', sealed); } catch { threw = true; }
    ok(threw, 'wrong name refused');
  });

  await check('E10. Delete All removes the key; old copies stay unreadable; a new key is used after', async () => {
    await seedPlainOldVersion();
    const app = await boot();
    const oldKey = keychain.get('viva-cycle.data-key');
    const copy = mem.get('viva-cycle:daily:2025-07')!; // e.g. a copy taken off the phone earlier
    eq((await app.del.deleteAllUserData()).dataDeleted, 'all', 'deleted');
    eq([appKeys(), keychain.has('viva-cycle.data-key')], [[], false], 'records and key gone');
    const next = await boot();
    next.store.completeSetup({ name: 'B', dateOfBirth: null, lastPeriodStart: '2025-09-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    ok(keychain.get('viva-cycle.data-key') && keychain.get('viva-cycle.data-key') !== oldKey, 'fresh key');
    let threw = false;
    try { await next.cipher.decryptValue(await (await import('../lib/dataKey')).readDataKey(), 'viva-cycle:daily:2025-07', copy); } catch { threw = true; }
    ok(threw, 'old copy unreadable with the new key');
  });

  await check('E10b. Key that will not delete: data still deleted, reported as deleted', async () => {
    await seedPlainOldVersion();
    const app = await boot();
    secureFaults.del = true;
    const r = await app.del.deleteAllUserData();
    eq([r.dataDeleted, appKeys()], ['all', []], 'records gone');
    secureFaults.del = false;
  });

  await check('E11. UTF-8 text (accents, emoji, other scripts) round-trips exactly', async () => {
    const app = await boot();
    const s = 'Ámina — naïve café ✓ 🩸💜 漢字 عربى';
    eq(app.cipher.utf8Decode(app.cipher.utf8Encode(s)), s, 'utf-8');
    eq(Buffer.from(app.cipher.utf8Encode(s)).toString('utf8'), s, 'same bytes as Node');
    const key = await (await import('../lib/dataKey')).readDataKey();
    eq(await app.cipher.decryptValue(key, 'viva-cycle:data', await app.cipher.encryptValue(key, 'viva-cycle:data', s)), s, 'encrypt/decrypt');
  });

  await check('E12. Logs never contain keys or records', async () => {
    const k = keychain.get('viva-cycle.data-key') ?? 'none';
    for (const w of warnings) ok(!SECRET.test(w) && !w.includes(k) && !/vc1:/.test(w), 'log: ' + w);
  });

  await check('E13. Configuration: this-device key, not tied to biometrics; SecureStore leaves backup rules alone', () => {
    const dk = read('lib/dataKey.ts');
    ok(/keychainAccessible: SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/.test(dk), 'this device only, when unlocked');
    ok(!/requireAuthentication\s*:/.test(dk), 'not tied to biometrics');
    const plugins = JSON.parse(read('app.json')).expo.plugins;
    ok(plugins.some((p: any) => Array.isArray(p) && p[0] === 'expo-secure-store' && p[1].configureAndroidBackup === false), 'configureAndroidBackup false');
    const bundled = req('expo/bundledNativeModules.json');
    const deps = JSON.parse(read('package.json')).dependencies;
    eq([deps['expo-crypto'], deps['expo-secure-store']], [bundled['expo-crypto'], bundled['expo-secure-store']], 'SDK-matched versions');
    for (const f of ['lib/vivaStore.ts', 'lib/dailyTrackingSettingsService.ts']) {
      ok(/import AsyncStorage from '\.\/secureStorage';/.test(read(f)) && !/@react-native-async-storage/.test(read(f)), f + ' goes through the encryption layer');
    }
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
