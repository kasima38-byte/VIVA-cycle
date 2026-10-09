// Biometric unlock: REAL App Lock + biometric logic and gate; a pretend phone for the system's
// Face ID / fingerprint prompt (we can't run the real prompt in Node). Never touches the phone.
// Run: npx -y tsx tests/biometricUnlock.test.ts
import { bio, keychain, plain, resetSecurity, secureFaults } from './support/securityFakes';
const req: any = require; // Node's require
const fs = req('fs');
const path = req('path');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

const mem = new Map<string, string>();
let storageReads = 0;
const storage = {
  getItem: async (k: string) => { storageReads++; return mem.has(k) ? mem.get(k)! : null; },
  setItem: async (k: string, v: string) => { mem.set(k, v); },
  removeItem: async (k: string) => { mem.delete(k); },
  getAllKeys: async () => { storageReads++; return [...mem.keys()]; },
};
const asPath = req.resolve('@react-native-async-storage/async-storage');
req.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: storage } };
const notifPath = req.resolve('expo-notifications');
req.cache[notifPath] = { id: notifPath, filename: notifPath, loaded: true, exports: { __esModule: true,
  setNotificationHandler: () => {}, getPermissionsAsync: async () => ({ granted: false }),
  cancelAllScheduledNotificationsAsync: async () => {}, dismissAllNotificationsAsync: async () => {},
  getAllScheduledNotificationsAsync: async () => [], addNotificationResponseReceivedListener: () => ({ remove() {} }),
  SchedulableTriggerInputTypes: {}, AndroidImportance: {} } };
const Platform = { OS: 'ios' };
const rnPath = req.resolve('react-native');
req.cache[rnPath] = { id: rnPath, filename: rnPath, loaded: true, exports: { Platform } };

const warnings: string[] = [];
console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); };

async function boot() {
  Object.keys(req.cache)
    .filter((k) => !k.includes('node_modules') && (k.includes('/lib/') || k.includes('/constants/')))
    .forEach((k) => delete req.cache[k]);
  const app = {
    lock: req('../lib/appLock'),
    bio: req('../lib/biometricUnlock'),
    session: req('../lib/appLockSession'),
    text: req('../lib/appLockText'),
    store: req('../lib/vivaStore'),
  };
  await app.store.loadVivaStore();
  return app;
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function reset() {
  await settle();
  mem.clear();
  resetSecurity();
  Platform.OS = 'ios';
  warnings.length = 0;
}
const PIN = '482915';
const PREF = 'viva-cycle.biometric-unlock';
const attempts = () => (keychain.get('viva-cycle.app-lock-attempts') ? JSON.parse(keychain.get('viva-cycle.app-lock-attempts')!) : null);
const contents = () => JSON.stringify([...mem.entries()].sort().map(([k, v]) => [k, plain(v, k)]));
const fail = (error: string) => ({ success: false, error });

/** A phone with App Lock on and one saved period, freshly started. */
async function lockedPhoneWithRecords() {
  let app = await boot();
  app.store.completeSetup({ name: 'Amina', dateOfBirth: null, lastPeriodStart: '2025-07-01',
    baseline: { cycleLength: 28, periodLength: 5, regularity: 'regular' }, goal: null });
  await settle();
  await app.store.saveDailyLog('2025-07-02', { period: 'yes', mood: 'low' });
  await settle();
  app = await boot(); // a normal restart first (it writes its usual backup copy)
  await settle();
  eqOk(await app.lock.setupPin(PIN, PIN), 'saved');
  await settle();
  app = await boot();
  await app.session.initAppLock();
  return app;
}
function eqOk(a: unknown, b: unknown) { if (a !== b) throw new Error('setup: expected ' + b + ', got ' + a); }

let passed = 0, failed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try { await fn(); console.log('PASS  ' + name); passed++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + (e?.message ?? e)); failed++; }
}
function ok(c: unknown, what: string) { if (!c) throw new Error(what); }
function eq(a: unknown, b: unknown, what: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

(async () => {
  await check('B1. Available and enrolled: Face ID (iPhone installed app), Touch ID, Android fingerprint', async () => {
    await reset();
    const app = await boot();
    eq(await app.bio.getBiometricStatus(), { kind: 'available', method: 'faceId' }, 'iPhone with Face ID');
    bio.types = [1];
    eq(await app.bio.getBiometricStatus(), { kind: 'available', method: 'touchId' }, 'iPhone with Touch ID');
    Platform.OS = 'android';
    eq(await app.bio.getBiometricStatus(), { kind: 'available', method: 'fingerprint' }, 'Android fingerprint');
    bio.types = [1, 2, 3];
    eq(await app.bio.getBiometricStatus(), { kind: 'available', method: 'biometrics' }, 'Android with several');
    eq(app.text.biometricName('faceId'), 'Face ID', 'name');
  });

  await check('B2. Unavailable / not enrolled / weak only / Expo Go Face ID / errors are never offered', async () => {
    await reset();
    const app = await boot();
    bio.hardware = false;
    eq((await app.bio.getBiometricStatus()).kind, 'noHardware', 'no sensor');
    bio.hardware = true; bio.level = 1;
    eq((await app.bio.getBiometricStatus()).kind, 'notEnrolled', 'sensor, nothing enrolled');
    Platform.OS = 'android'; bio.level = 2;
    eq((await app.bio.getBiometricStatus()).kind, 'notEnrolled', 'Android weak (2D camera face) only is not accepted');
    Platform.OS = 'ios'; bio.level = 3; bio.executionEnvironment = 'storeClient';
    eq((await app.bio.getBiometricStatus()).kind, 'needsInstalledApp', 'Face ID in Expo Go');
    bio.types = [1];
    eq((await app.bio.getBiometricStatus()).kind, 'available', 'Touch ID works in Expo Go');
    bio.throwAll = true;
    eq((await app.bio.getBiometricStatus()).kind, 'error', 'library error');
    eq(await app.bio.biometricForLockScreen(), null, 'nothing offered on lock screen');
    eq(bio.prompts.length, 0, 'checking support never shows a prompt');
  });

  await check('B3. Checking support reads no records and shows no prompt', async () => {
    await reset();
    const app = await lockedPhoneWithRecords();
    storageReads = 0;
    await app.bio.getBiometricStatus();
    await app.bio.biometricForLockScreen();
    eq(storageReads, 0, 'record storage reads');
    eq(bio.prompts.length, 0, 'prompts');
    const src = read('lib/biometricUnlock.ts');
    ok(!/vivaStore|dailyStorage|secureStorage|async-storage/.test(src), 'biometric module does not import record storage');
  });

  await check('B4. Never on by itself: not after setting up App Lock, not after checking support', async () => {
    await reset();
    const app = await lockedPhoneWithRecords();
    await app.bio.getBiometricStatus();
    ok(!keychain.has(PREF), 'no preference stored');
    eq(await app.bio.isBiometricUnlockOn(), false, 'off');
    eq(await app.session.unlockWithBiometrics('x'), 'notOffered', 'lock screen offers nothing');
    eq(bio.prompts.length, 0, 'no prompt');
    eq(app.session.getAppLockState().gate, 'locked', 'still locked');
  });

  await check('B5. Turning on needs App Lock on, her right PIN, then a successful system prompt', async () => {
    await reset();
    const app = await lockedPhoneWithRecords();
    eq(await app.bio.enableBiometricUnlock(PIN, 'Confirm'), { ok: true }, 'enabled');
    eq(keychain.get(PREF), 'on', 'only her choice is stored');
    eq(bio.prompts.length, 1, 'one system prompt');
    const o = bio.prompts[0];
    eq([o.disableDeviceFallback, o.biometricsSecurityLevel, o.cancelLabel, o.fallbackLabel], [true, 'strong', 'Use PIN', ''],
      'phone passcode is not a fallback; strong biometrics only; "Use PIN" to cancel');
    // Only the word 'on' is kept: no biometric data, no PIN
    const everything = JSON.stringify([...keychain.entries()]);
    ok(!everything.includes(PIN), 'PIN not stored');
  });

  await check('B6. Turning on is refused (nothing stored) for: wrong PIN, cancel, failure, lockout, unavailable, App Lock off', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    const r1 = await app.bio.enableBiometricUnlock('111111', 'x');
    eq([r1.ok, r1.reason, bio.prompts.length], [false, 'wrong', 0], 'wrong PIN: no prompt shown');
    eq(attempts().failures, 1, 'wrong PIN counted towards the waits');
    for (const [answer, reason] of [[fail('user_cancel'), 'notConfirmed'], [fail('authentication_failed'), 'notConfirmed'],
      [fail('lockout'), 'lockout'], [fail('not_available'), 'unavailable'], [fail('missing_usage_description'), 'unavailable']] as const) {
      bio.answers = [answer];
      const r = await app.bio.enableBiometricUnlock(PIN, 'x');
      eq([r.ok, r.reason], [false, reason], 'answer ' + answer.error);
      ok(!keychain.has(PREF), 'not stored after ' + answer.error);
    }
    bio.level = 1;
    eq((await app.bio.enableBiometricUnlock(PIN, 'x')).reason, 'unavailable', 'not enrolled');
    bio.level = 3;
    eq(await app.lock.disableLock(PIN), { ok: true }, 'lock off');
    eq((await app.bio.enableBiometricUnlock(PIN, 'x')).reason, 'lockOff', 'needs App Lock');
    ok(!keychain.has(PREF), 'never stored');
    // Secure storage silently not saving: reported as not saved
    eq(await app.lock.setupPin(PIN, PIN), 'saved', 'lock on again');
    secureFaults.dropWrites = true;
    eq((await app.bio.enableBiometricUnlock(PIN, 'x')).reason, 'saveFailed', 'not saved is reported');
  });

  await check('B7. Successful biometric unlock opens the app; protected screens stay hidden until then', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    await app.bio.enableBiometricUnlock(PIN, 'x');
    app = await boot(); // next launch
    await app.session.initAppLock();
    eq(app.session.getAppLockState().gate, 'locked', 'starts locked');
    eq(app.session.rootView(app.session.getAppLockState().gate), 'lock', 'only the lock screen renders');
    eq(await app.bio.biometricForLockScreen(), 'faceId', 'Face ID offered');
    let opened = '';
    app.session.openWhenUnlocked('/today', (u: string) => (opened = u));
    eq(opened, '', 'reminder link waits');
    bio.answers = [{ success: true }];
    eq(await app.session.unlockWithBiometrics('Unlock VIVA Cycle'), 'success', 'recognised');
    eq(app.session.rootView(app.session.getAppLockState().gate), 'app', 'app shown');
    await settle();
    eq(opened, '/today', 'link opened only after unlocking');
  });

  await check('B8. Cancel / failure / lockout / unavailable keep it locked, and the PIN still opens it', async () => {
    for (const answer of [fail('user_cancel'), fail('system_cancel'), fail('user_fallback'), fail('authentication_failed'),
      fail('lockout'), fail('not_available'), fail('unknown'), 'throw']) {
      await reset();
      let app = await lockedPhoneWithRecords();
      await app.bio.enableBiometricUnlock(PIN, 'x');
      app = await boot();
      await app.session.initAppLock();
      if (answer === 'throw') bio.throwAll = true; else bio.answers = [answer];
      const r = await app.session.unlockWithBiometrics('x');
      ok(r !== 'success', 'not success for ' + JSON.stringify(answer));
      eq(app.session.getAppLockState().gate, 'locked', 'still locked after ' + JSON.stringify(answer));
      bio.throwAll = false;
      eq(await app.session.unlockWithPin(PIN), { ok: true }, 'PIN fallback works after ' + JSON.stringify(answer));
      eq(app.session.getAppLockState().gate, 'open', 'opened by PIN');
    }
    const t = (await boot()).text;
    eq(t.biometricLockMessage('cancelled', 'Face ID'), null, 'cancel: no scolding, PIN pad');
    eq(t.biometricLockMessage('failed', 'Face ID'), "Face ID didn't recognise you. Enter your PIN.", 'failed message');
    eq(t.biometricLockMessage('lockout', 'Face ID'), 'Face ID is locked for now. Enter your PIN.', 'lockout message');
  });

  await check('B9. If Face ID / fingerprint is removed from the phone later, it is not offered; PIN works', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    await app.bio.enableBiometricUnlock(PIN, 'x');
    bio.level = 1; // she removed her face / fingerprints in phone settings
    app = await boot();
    await app.session.initAppLock();
    eq(await app.bio.biometricForLockScreen(), null, 'not offered');
    eq(await app.session.unlockWithBiometrics('x'), 'unavailable', 'no prompt');
    eq(bio.prompts.length, 1, 'only the original enable prompt');
    eq(app.session.getAppLockState().gate, 'locked', 'still locked');
    eq(await app.session.unlockWithPin(PIN), { ok: true }, 'PIN');
  });

  await check('B10. Turning biometric unlock off: PIN only from then on; nothing else changes', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    await app.bio.enableBiometricUnlock(PIN, 'x');
    eq(await app.bio.disableBiometricUnlock(), true, 'off');
    ok(!keychain.has(PREF), 'preference removed');
    eq((await app.lock.getLockStatus()).kind, 'on', 'App Lock still on');
    app = await boot();
    await app.session.initAppLock();
    eq(await app.session.unlockWithBiometrics('x'), 'notOffered', 'not offered');
    eq(app.session.getAppLockState().gate, 'locked', 'locked');
    eq(await app.session.unlockWithPin(PIN), { ok: true }, 'PIN works');
    secureFaults.del = true;
    await app.bio.enableBiometricUnlock(PIN, 'x');
    eq(await app.bio.disableBiometricUnlock(), false, 'a failed turn-off is reported, not hidden');
  });

  await check('B11. Turning App Lock off, a new PIN setup, and Delete All all clear the biometric choice', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    await app.bio.enableBiometricUnlock(PIN, 'x');
    eq(await app.lock.disableLock(PIN), { ok: true }, 'App Lock off');
    ok(!keychain.has(PREF), 'cleared with App Lock');
    keychain.set(PREF, 'on'); // even if something left it behind...
    eq(await app.lock.setupPin(PIN, PIN), 'saved', 'new lock');
    ok(!keychain.has(PREF), '...a new lock starts with biometrics off');
    await app.bio.enableBiometricUnlock(PIN, 'x');
    await app.session.forgetAppLock(); // Delete All My Data / Forgot PIN
    ok(!keychain.has(PREF), 'cleared by delete-all reset');
  });

  await check('B12. Her menstrual records are unchanged by enabling, unlocking and disabling', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    await settle();
    const before = contents();
    ok(before.includes('viva-cycle'), 'there are records to protect');
    await app.bio.enableBiometricUnlock(PIN, 'x');
    app = await boot();
    await app.session.initAppLock();
    await app.session.unlockWithBiometrics('x');
    await app.bio.disableBiometricUnlock();
    await settle();
    eq(contents(), before, 'records');
    eq(app.store.getVivaState().dailyLogs['2025-07-02'].mood, 'low', 'readable as before');
  });

  await check('B13. Nothing sensitive is logged; no network, analytics or custom face recognition', async () => {
    await reset();
    let app = await lockedPhoneWithRecords();
    bio.answers = [fail('authentication_failed')];
    await app.bio.enableBiometricUnlock(PIN, 'x');
    bio.throwAll = true;
    await app.bio.getBiometricStatus();
    await app.bio.promptBiometric('x');
    ok(!warnings.join(' ').includes(PIN), 'PIN not logged');
    ok(warnings.every((w) => w.startsWith('VIVA: ')), 'only generic messages: ' + warnings.join(' | '));
    const src = read('lib/biometricUnlock.ts') + read('components/AppLockScreen.tsx') + read('app/app-lock-pin.tsx');
    ok(!/console\.log/.test(src), 'no console.log');
    ok(!/fetch\(|XMLHttpRequest|analytics|expo-camera|vision/i.test(src), 'no network / camera / custom recognition');
  });

  await check('B14. Wiring: Privacy & Security offers it only with App Lock on; lock screen keeps the PIN pad', () => {
    const privacy = read('components/BiometricUnlockSettings.tsx');
    ok(/lockOn === true && <BiometricUnlockSettings \/>/.test(read('app/privacy-security.tsx')), 'only while App Lock is on');
    ok(/status\?\.kind === 'available' && !on/.test(privacy), 'turn-on only when available');
    ok(/mode: 'biometric'/.test(privacy) && /enableBiometricUnlock\(entered/.test(read('app/app-lock-pin.tsx')), 'turn-on goes through the PIN screen');
    const lockScreen = read('components/AppLockScreen.tsx');
    ok(/<PinPad /.test(lockScreen) && /unlockWithBiometrics/.test(lockScreen), 'PIN pad and biometric option');
    ok(!/vivaStore|dailyStorage/.test(lockScreen), 'lock screen reads no records');
    const appJson = JSON.parse(read('app.json'));
    const plugin = appJson.expo.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-local-authentication');
    ok(plugin && /Face ID/.test(plugin[1].faceIDPermission), 'Face ID message for installed builds');
    const pkg = JSON.parse(read('package.json'));
    const bundled = JSON.parse(fs.readFileSync(req.resolve('expo/bundledNativeModules.json'), 'utf8'));
    eq(pkg.dependencies['expo-local-authentication'], bundled['expo-local-authentication'], 'version matches Expo SDK');
    const t = (read('lib/appLockText.ts'));
    ok(/does not encrypt your records/.test(t) && /never sees or stores your face or fingerprint/.test(t), 'honest note');
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
})();
