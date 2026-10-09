// Android backup policy + removal of the non-working Log Out control.
// Run: npx -y tsx tests/backupAndLogout.test.ts
// Set FULL_PREBUILD=1 to also generate the whole android/ project in a temp folder and read the
// real files (slower; needs network for the Expo template).
import './support/securityFakes'; // phone security modules (Keychain, AES-GCM) for Node
const req: any = require; // Node's require
const fs = req('fs');
const path = req('path');
const os = req('os');
const { execSync } = req('child_process');
const ROOT = path.resolve(req.resolve('../package.json'), '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8') as string;

let pass = 0, fail = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try { await fn(); console.log('PASS  ' + name); pass++; }
  catch (e: any) { console.log('FAIL  ' + name + '\n      ' + (e?.message ?? e)); fail++; }
}
function ok(c: unknown, what: string) { if (!c) throw new Error(what); }
function eq(a: unknown, b: unknown, what: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(what + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref'];

function checkRulesXml(xml: string) {
  ok(!/<include/.test(xml), 'rules must not include anything');
  for (const section of ['cloud-backup', 'device-transfer']) {
    const m = xml.match(new RegExp(`<${section}>([\\s\\S]*?)</${section}>`));
    ok(m, 'missing <' + section + '>');
    const domains = [...m![1].matchAll(/<exclude domain="([a-z_]+)" path="\." \/>/g)].map((x) => x[1]).sort();
    eq(domains, [...DOMAINS].sort(), section + ' excludes every domain');
  }
}

(async () => {
  // ---------- Backup policy is explicit ----------
  await check('B1. app.json turns Android backup off and registers the no-backup plugin', () => {
    const cfg = JSON.parse(read('app.json')).expo;
    eq(cfg.android.allowBackup, false, 'android.allowBackup');
    ok(cfg.plugins.includes('./plugins/withNoBackup'), 'plugin registered');
    ok(fs.existsSync(path.join(ROOT, 'plugins/withNoBackup.js')), 'plugin file exists');
  });

  await check('B2. The rules exclude every app storage domain from cloud backup AND device transfer', () => {
    const plugin = req('../plugins/withNoBackup.js');
    eq([...plugin.DOMAINS].sort(), [...DOMAINS].sort(), 'all nine documented domains');
    checkRulesXml(plugin.rulesXml());
  });

  await check('B3. The plugin keeps allowBackup off even if a template turns it on', () => {
    const plugin = req('../plugins/withNoBackup.js');
    const manifest = { manifest: { application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }] } };
    const out = plugin.setBackupAttributes(manifest);
    eq([out.manifest.application[0].$['android:allowBackup'], out.manifest.application[0].$['android:dataExtractionRules']],
      ['false', '@xml/viva_data_extraction_rules'], 'attributes');
  });

  // ---------- Generated native config (Expo's own tooling) ----------
  await check('B4. Expo generates a manifest with allowBackup="false" and the extraction rules', () => {
    const out = execSync('npx expo config --type introspect --json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
    const cfg = JSON.parse(String(out));
    const app = cfg._internal.modResults.android.manifest.manifest.application[0].$;
    eq([app['android:allowBackup'], app['android:dataExtractionRules']], ['false', '@xml/viva_data_extraction_rules'], 'generated <application>');
  });

  await check('B5. No installed library manifest declares backup attributes that could override ours', () => {
    const out = String(execSync(
      'find node_modules -path "*/android/*" -name AndroidManifest.xml -not -path "*/test*" -print0 | ' +
      'xargs -0 grep -l "allowBackup\\|dataExtractionRules\\|fullBackupContent" || true',
      { cwd: ROOT, timeout: 120000 })).trim();
    eq(out, '', 'library manifests with backup attributes');
  });

  if (process.env.FULL_PREBUILD === '1') {
    await check('B6. (full) expo prebuild writes the real manifest and rules file', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'viva-prebuild-'));
      execSync(`tar --exclude=node_modules --exclude=.git --exclude=android --exclude=ios -cf - . | (cd "${dir}" && tar xf -)`, { cwd: ROOT, shell: '/bin/bash' });
      fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
      execSync('npx expo prebuild --platform android --no-install', { cwd: dir, env: { ...process.env, CI: '1' }, stdio: 'ignore', timeout: 600000 });
      const manifest = fs.readFileSync(path.join(dir, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
      ok(/android:allowBackup="false"/.test(manifest), 'manifest allowBackup');
      ok(/android:dataExtractionRules="@xml\/viva_data_extraction_rules"/.test(manifest), 'manifest rules');
      checkRulesXml(fs.readFileSync(path.join(dir, 'android/app/src/main/res/xml/viva_data_extraction_rules.xml'), 'utf8'));
    });
  }

  // ---------- Privacy wording matches the configured behaviour ----------
  await check('B7. Privacy & Security describes the backup policy accurately, without overclaiming', () => {
    const { YOUR_DATA } = req('../lib/privacyContent');
    const item = YOUR_DATA.items.find((i: any) => i.title === 'Backups');
    ok(item, 'Backups item');
    ok(/On Android/.test(item.body) && /Google backups/.test(item.body) && /transfers to a new phone/.test(item.body), 'Android policy');
    ok(/doesn't remove backups made before/.test(item.body), 'old backups not removed');
    ok(/On iPhone, iCloud and computer backups follow your phone settings/.test(item.body), 'iOS unchanged');
    ok(!/never (backed up|leaves|copied)|can't be copied|fully protected|guarantee/i.test(item.body), 'no absolute claims');
  });

  // ---------- Log Out ----------
  await check('L1. Profile no longer offers a Log Out that implies a session ended', () => {
    const profile = read('app/(tabs)/profile.tsx');
    ok(!/['"]Log Out['"]|>Log Out<|Log out of VIVA|confirmLogOut|log-out-outline|styles\.logout/.test(profile), 'Log Out still present');
    ok(/No Log Out: VIVA Cycle has no accounts/.test(profile), 'reason documented in the code');
  });

  await check('L2. Nothing on Profile can delete her data; deleting stays in Privacy & Security', () => {
    const profile = read('app/(tabs)/profile.tsx');
    ok(!/deleteAllUserData|deleteAllStoredData|resetVivaStore|clearTrackingData|removeItem|AsyncStorage|cancelAllReminders/.test(profile),
      'Profile must not delete anything');
    const screen = read('app/privacy-security.tsx');
    ok(/onPress=\{\(\) => void requestDeleteAll\(\)\}/.test(screen), 'Delete All still its own explicit action');
  });

  await check('L3. Profile layout otherwise unchanged (rows, stats, VIVA Pregnancy, Support)', () => {
    const profile = read('app/(tabs)/profile.tsx');
    for (const t of ['Personal Information', 'Cycle Settings', 'Notifications & Reminders', 'Period history',
      'My Health Goals', 'My Data', 'Privacy & Security', 'Help & Support', 'Share VIVA Cycle', 'VIVA Pregnancy', 'ProfileStatsCard']) {
      ok(profile.includes(t), 'missing ' + t);
    }
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
