// App Lock (PIN): REAL PBKDF2 (@noble/hashes), REAL lock logic and gate, in-memory Keychain and
// AsyncStorage. Never touches the phone. Run: npx -y tsx tests/appLock.test.ts
import { keychain, plain, resetSecurity, secureFaults } from './support/securityFakes';
const req: any = require; // Node's require
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

const mem = new Map<string, string>();
const storage = {
  getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => [...mem.keys()],
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
req.cache[rnPath] = { id: rnPath, filename: rnPath, loaded: true, exports: { Platform: { OS: 'ios' } } };

const warnings: string[] = [];
const realWarn = console.warn;
console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); };

/** A fresh start of the app: new module instances, same Keychain and storage. */
async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    lock: req('../lib/appLock'),
    session: req('../lib/appLockSession'),
    text: req('../lib/appLockText'),
    store: req('../lib/vivaStore'),
    del: req('../lib/dataDeletionService'),
  };
  await app.store.loadVivaStore();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function reset() {
  await settle();
  mem.clear();
  resetSecurity();
  warnings.length = 0;
}
const T0 = 1_800_000_000_000; // a fixed "now" so waits can be tested exactly
const lockRecord = () => (keychain.get('viva-cycle.app-lock') ? JSON.parse(keychain.get('viva-cycle.app-lock')!) : null);
const attempts = () => (keychain.get('viva-cycle.app-lock-attempts') ? JSON.parse(keychain.get('viva-cycle.app-lock-attempts')!) : null);
const PIN = '482915';
const OTHER = '730264';
const records = () => JSON.stringify([...mem.entries()].sort());
/** Her records as the app reads them (each start rewrites the backup with a fresh IV, same content). */
const contents = () => JSON.stringify([...mem.entries()].sort().map(([k, v]) => [k, plain(v, k)]));

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
  // ---------- 1. Setup ----------
  await check('L1. Setup saves only a salted PBKDF2 verifier in secure storage, never the PIN', async () => {
    await reset();
    const app = await boot();
    eq(await app.lock.setupPin(PIN, PIN), 'saved', 'setup');
    const r = lockRecord();
    eq([r.v, r.kdf, r.iterations], [1, 'pbkdf2-sha256', 50000], 'verifier shape');
    eq([app.lock.fromBase64(r.salt).length, app.lock.fromBase64(r.hash).length], [16, 32], 'salt 16 bytes, hash 32 bytes');
    ok(!JSON.stringify([...keychain.entries()]).includes(PIN), 'PIN stored in plain text');
    ok(!records().includes(PIN), 'PIN in AsyncStorage');
    eq((await app.lock.getLockStatus()).kind, 'on', 'status');
    // A new setup gets a new salt (same PIN -> different verifier)
    await app.lock.disableLock(PIN, T0);
    await app.lock.setupPin(PIN, PIN);
    ok(lockRecord().salt !== r.salt && lockRecord().hash !== r.hash, 'unique salt per setup');
  });

  // ---------- 2. Mismatch / invalid ----------
  await check('L2. Mismatched or malformed PINs save nothing', async () => {
    await reset();
    const app = await boot();
    eq(await app.lock.setupPin(PIN, OTHER), 'mismatch', 'mismatch');
    for (const bad of ['12345', '1234567', 'abcdef', '12 345', '', '１２３４５６']) {
      eq(await app.lock.setupPin(bad, bad), 'invalid', 'invalid ' + JSON.stringify(bad));
    }
    eq([lockRecord(), (await app.lock.getLockStatus()).kind], [null, 'off'], 'still off');
  });

  // ---------- 3. Verify ----------
  await check('L3. Correct PIN opens; wrong PIN does not, and is counted', async () => {
    await reset();
    const app = await boot();
    await app.lock.setupPin(PIN, PIN);
    eq(await app.lock.verifyPin(OTHER, T0), { ok: false, reason: 'wrong', waitMs: 0 }, 'wrong');
    eq(attempts().failures, 1, 'counted');
    eq(await app.lock.verifyPin(PIN, T0 + 1), { ok: true }, 'right');
    eq(attempts().failures, 0, 'counter cleared after the right PIN');
    eq(await app.lock.verifyPin('12345', T0 + 2), { ok: false, reason: 'invalid' }, 'short input not checked or counted');
    eq(attempts().failures, 0, 'not counted');
  });

  // ---------- 4. Change ----------
  await check('L4. Changing the PIN needs the current PIN; a wrong one changes nothing', async () => {
    await reset();
    const app = await boot();
    await app.lock.setupPin(PIN, PIN);
    const before = keychain.get('viva-cycle.app-lock');
    eq((await app.lock.changePin(OTHER, '111111', '111111', T0)).reason, 'wrong', 'wrong current PIN');
    eq(keychain.get('viva-cycle.app-lock'), before, 'verifier untouched');
    eq((await app.lock.changePin(PIN, '111111', '222222', T0 + 1)).reason, 'mismatch', 'new PIN mismatch');
    eq(keychain.get('viva-cycle.app-lock'), before, 'verifier untouched');
    eq(await app.lock.changePin(PIN, '111111', '111111', T0 + 2), { ok: true, changed: true }, 'changed');
    eq((await app.lock.verifyPin(PIN, T0 + 3)).ok, false, 'old PIN no longer works');
    eq((await app.lock.verifyPin('111111', T0 + 4)).ok, true, 'new PIN works');
  });

  // ---------- 5. Disable ----------
  await check('L5. Turning App Lock off needs the PIN; a failed attempt never turns it off', async () => {
    await reset();
    const app = await boot();
    await app.lock.setupPin(PIN, PIN);
    eq((await app.lock.disableLock(OTHER, T0)).ok, false, 'wrong PIN');
    eq((await app.lock.getLockStatus()).kind, 'on', 'still on');
    secureFaults.del = true;
    eq((await app.lock.disableLock(PIN, T0 + 1)).reason, 'error', 'storage failure reported');
    secureFaults.del = false;
    eq((await app.lock.getLockStatus()).kind, 'on', 'still on after a failed removal');
    eq(await app.lock.disableLock(PIN, T0 + 2), { ok: true }, 'right PIN');
    eq([(await app.lock.getLockStatus()).kind, lockRecord(), attempts()], ['off', null, null], 'off, nothing left behind');
  });

  // ---------- 6. Persistence ----------
  await check('L6. App Lock survives a restart and the app starts locked', async () => {
    await reset();
    let app = await boot();
    await app.lock.setupPin(PIN, PIN);
    app = await boot();
    await app.session.initAppLock();
    eq([app.session.getAppLockState().gate, app.session.getAppLockState().lockOn], ['locked', true], 'starts locked');
    eq((await app.session.unlockWithPin(OTHER)).ok, false, 'wrong PIN');
    eq(app.session.getAppLockState().gate, 'locked', 'still locked');
    eq((await app.session.unlockWithPin(PIN)).ok, true, 'right PIN');
    eq(app.session.getAppLockState().gate, 'open', 'open');
  });

  // ---------- 7. Throttling ----------
  await check('L7. Waits grow after repeated wrong PINs and survive a restart', async () => {
    await reset();
    let app = await boot();
    await app.lock.setupPin(PIN, PIN);
    for (let i = 1; i <= 4; i++) eq((await app.lock.verifyPin(OTHER, T0 + i)).waitMs, 0, 'free attempt ' + i);
    eq(await app.lock.verifyPin(OTHER, T0 + 5), { ok: false, reason: 'wrong', waitMs: 30000 }, '5th wrong: 30 s');
    app = await boot(); // restart
    eq((await app.lock.verifyPin(PIN, T0 + 10)).reason, 'wait', 'even the RIGHT PIN is not checked during the wait');
    eq(attempts().failures, 5, 'a try during the wait is not counted and not checked');
    ok((await app.lock.getWaitMs(T0 + 10)) > 29000, 'lock screen sees the remaining wait after restart');
    eq((await app.lock.verifyPin(OTHER, T0 + 5 + 30000)).waitMs, 60000, '6th wrong: 1 min');
    eq((await app.lock.verifyPin(OTHER, T0 + 5 + 30000 + 60000)).waitMs, 300000, '7th wrong: 5 min');
    eq(app.lock.waitAfter(9), 3600000, 'then up to 1 hour each');
    eq(app.lock.waitAfter(50), 3600000, 'never more than 1 hour: her data is never destroyed');
    // Turning the clock back does not skip the wait
    ok((await app.lock.getWaitMs(T0 - 86400000)) >= 300000, 'clock moved back: full wait applies');
    // After the wait, the right PIN still works and clears the counter
    eq((await app.lock.verifyPin(PIN, T0 + 5 + 30000 + 60000 + 300000)).ok, true, 'opens after waiting');
    eq(attempts().failures, 0, 'cleared');
    const src = read('lib/appLock.ts');
    const fn = src.slice(src.indexOf('export async function verifyPin'), src.indexOf('export type SetupResult'));
    ok(fn.indexOf('await writeAttempts(counted);') > 0 && fn.indexOf('await writeAttempts(counted);') < fn.indexOf('await derive(pin'),
      'a try is counted BEFORE the PIN is checked');
  });

  await check('L7b. Secure storage failing never unlocks', async () => {
    await reset();
    let app = await boot();
    await app.lock.setupPin(PIN, PIN);
    app = await boot();
    secureFaults.get = true;
    await app.session.initAppLock();
    eq(app.session.getAppLockState().gate, 'unknown', 'unknown, not open');
    eq(app.session.rootView('unknown'), 'lock', 'shown as locked');
    eq((await app.session.unlockWithPin(PIN)).reason, 'error', 'cannot check');
    eq(app.session.getAppLockState().gate, 'unknown', 'still closed');
    secureFaults.get = false;
    await app.session.initAppLock();
    eq(app.session.getAppLockState().gate, 'locked', 'Try again reads the setting');
  });

  // ---------- 8. Nothing sensitive before the PIN ----------
  await check('L8. While locked, only the lock screen renders: no VIVA screen, no data, no deep link', async () => {
    const s = (await boot()).session;
    eq(['checking', 'locked', 'unknown', 'open'].map((g) => s.rootView(g)), ['loading', 'lock', 'lock', 'app'], 'gate -> view');
    const layout = read('app/_layout.tsx');
    const iLock = layout.indexOf("if (view === 'lock')");
    ok(iLock > 0 && iLock < layout.indexOf("if (view === 'loading' || !loaded"), 'lock check comes before anything else renders');
    ok(layout.indexOf('<AppLockScreen />') < layout.indexOf('<Stack'), 'lock screen returned before the app Stack');
    eq((layout.match(/<Stack/g) ?? []).length, 1, 'one place renders the app');
    const lockScreen = read('components/AppLockScreen.tsx');
    ok(!/useVivaStore|getVivaState|dailyLogs|periods|insights|calendar/i.test(lockScreen.replace(/deleteAllUserData|dataDeletion/g, '')), 'lock screen reads no records');
    ok(/setPin\(''\); \/\/ the entered digits never stay on screen/.test(lockScreen), 'PIN input cleared after each try');
    // A reminder tapped while locked waits for the PIN
    await reset();
    const app = await boot();
    await app.lock.setupPin(PIN, PIN);
    await app.session.initAppLock();
    const opened: string[] = [];
    app.session.openWhenUnlocked('/fertility', (u: string) => opened.push(u));
    eq(opened, [], 'not opened while locked');
    await app.session.unlockWithPin(PIN);
    await settle();
    eq(opened, ['/fertility'], 'opened after the PIN');
  });

  // ---------- 9. Records untouched ----------
  await check('L9. Setting up, using, changing and turning off the PIN never touches her records', async () => {
    await reset();
    let app = await boot();
    app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    await app.store.saveDailyLog('2025-07-02', { period: 'yes', mood: 'low' });
    await settle();
    app = await boot(); // a normal restart first (it writes its usual backup copy)
    await settle();
    const before = contents();
    await app.lock.setupPin(PIN, PIN);
    for (let i = 0; i < 7; i++) await app.lock.verifyPin(OTHER, T0 + i * 4000000);
    await app.lock.changePin(PIN, OTHER, OTHER, T0 + 99000000);
    await app.lock.disableLock(OTHER, T0 + 99000001);
    app = await boot();
    eq(contents(), before, 'records on the phone identical');
    eq(app.store.getVivaState().dailyLogs['2025-07-02'].mood, 'low', 'readable as before');
  });

  // ---------- Recovery / Delete All ----------
  await check('L10. Forgot PIN: no bypass; only an explicit delete-everything opens the app', async () => {
    const t = (await boot()).text;
    ok(/can't be recovered/.test(t.FORGOT_PIN_FIRST.body) && /can't be undone/.test(t.FORGOT_PIN_FIRST.body), 'honest explanation');
    const src = read('components/AppLockScreen.tsx');
    ok(/if \(!\(await ask\(FORGOT_PIN_FIRST\)\) \|\| !\(await ask\(FORGOT_PIN_FINAL\)\)\) return;/.test(src), 'two confirmations');
    ok(/if \(result\.dataDeleted === 'all'\) \{\s*await forgetAppLock\(\);/.test(src), 'opens only after everything is deleted');
    eq((src.match(/forgetAppLock\(/g) ?? []).length, 1, 'no other way to open');
    ok(!/master|bypass|backdoor/i.test(read('lib/appLock.ts').replace(/no bypass/gi, '')), 'no master PIN');
    // Delete All My Data also removes the lock (a fresh start has no PIN)
    await reset();
    const app = await boot();
    app.store.completeSetup({ name: 'A', dateOfBirth: null, lastPeriodStart: '2025-07-01',
      baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
    await settle();
    await app.lock.setupPin(PIN, PIN);
    eq((await app.del.deleteAllUserData()).dataDeleted, 'all', 'deleted');
    eq([lockRecord(), attempts(), app.session.getAppLockState().lockOn], [null, null, false], 'lock removed with the data');
  });

  await check('L11. The PIN never appears in logs, messages or screens', async () => {
    for (const w of warnings) ok(!w.includes(PIN) && !w.includes(OTHER) && !/\d{6}/.test(w), 'log: ' + w);
    const t = (await boot()).text;
    const all = JSON.stringify(t) + read('app/app-lock-pin.tsx') + read('components/PinPad.tsx');
    ok(!/console\.(log|warn)\([^)]*pin/i.test(all), 'no PIN logging');
    ok(/never shown \(dots only\)/.test(read('components/PinPad.tsx')), 'digits shown as dots only');
    eq(t.verifyMessage({ ok: false, reason: 'wrong', waitMs: 30000 }), 'Incorrect PIN. Try again in 30 seconds.', 'message');
    eq(t.verifyMessage({ ok: false, reason: 'error' }), "We couldn't check your PIN, so VIVA Cycle stays locked. Please try again.", 'error stays locked');
  });

  await check('L12. Library: @noble/hashes PBKDF2 (pure JS); App Lock settings live on Privacy & Security', () => {
    const pkg = JSON.parse(read('package.json'));
    ok(/^2\./.test(pkg.dependencies['@noble/hashes'].replace(/^[\^~]/, '')), '@noble/hashes 2.x');
    const src = read('lib/appLock.ts');
    ok(/import \{ pbkdf2Async \} from '@noble\/hashes\/pbkdf2\.js';/.test(src) && /import \{ sha256 \} from '@noble\/hashes\/sha2\.js';/.test(src), 'real imports');
    ok(/getRandomBytesAsync\(16\)/.test(src), 'random 16-byte salt from expo-crypto');
    ok(/keychainAccessible: SecureStore\.WHEN_UNLOCKED_THIS_DEVICE_ONLY/.test(src), 'secure storage, this device only');
    const privacy = read('app/privacy-security.tsx');
    ok(/<AppLockSection \/>/.test(privacy) && /pathname: '\/app-lock-pin'/.test(privacy), 'section on the existing screen');
    ok(!fs.existsSync(path.join(ROOT, 'app/app-lock-settings.tsx')), 'no duplicate settings screen');
  });

  console.warn = realWarn;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
