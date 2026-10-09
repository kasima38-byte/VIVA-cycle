// Accessibility - Prompt 16 checks (no phone needed; VoiceOver/TalkBack testing still needs the phone)
// Run: npx --yes tsx tests/accessibility.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

// WCAG contrast
const theme = read('constants/theme.ts');
const hex = (name) => (theme.match(new RegExp('\\b' + name + ": '(#[0-9A-Fa-f]{6})'")) || [])[1];
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

console.log('CONTRAST (WCAG AA: 4.5 text, 3 controls)');
const backgrounds = ['white', 'screen', 'pinkVerySoft', 'pinkSoft', 'lavender'];
for (const fg of ['navy', 'textSecondary', 'magentaText']) {
  const worst = Math.min(...backgrounds.map((bg) => ratio(hex(fg), hex(bg))));
  check(fg + ' text >= 4.5 on every VIVA background (worst ' + worst.toFixed(2) + ')', worst >= 4.5);
}
check('control borders (toggleOff) >= 3 on white (' + ratio(hex('toggleOff'), hex('white')).toFixed(2) + ')', ratio(hex('toggleOff'), hex('white')) >= 3);

const files = ['app/daily-tracking.tsx', 'app/daily-tracking-settings.tsx', 'components/TrackingCard.tsx', 'components/MoodSelector.tsx',
  'components/EnergySlider.tsx', 'components/PeriodSheet.tsx', 'components/FlowSheet.tsx', 'components/SymptomsSheet.tsx',
  'components/MucusSheet.tsx', 'components/SexualActivitySheet.tsx', 'components/MedicationsSheet.tsx', 'components/DateSelector.tsx'];
const src = Object.fromEntries(files.map((f) => [f, read(f)]));
const all = Object.values(src).join('\n');
check('no small text in brand magenta (uses magentaText)', !/(?<![A-Za-z])color: colors\.magenta\b/.test(all));
check('no low-contrast grey control borders', !/borderColor: colors\.mutedGray/.test(all));

console.log('LABELS + ROLES');
for (const f of files) {
  const pressables = (src[f].match(/<Pressable\b/g) || []).length;
  const roles = (src[f].match(/accessibilityRole=/g) || []).length;
  check(f + ': every pressable has a role (' + pressables + ')', roles >= pressables, { pressables, roles });
}
const screen = src['app/daily-tracking.tsx'];
check('dates read in full with year, today and future', /formatFullDate\(key\) \+ \(key === today \? ', today'/.test(screen));
check('"Return to today"', /accessibilityLabel="Return to today"/.test(screen));
check('Save states spoken in plain language', /'Saving Daily Tracking data'/.test(screen) && /'Save failed\. Retry saving'/.test(screen) && /'Daily Tracking data saved'/.test(screen));
check('cards hint "Add …" / "Edit …"', /\(tracked \? 'Edit ' : 'Add '\)/.test(src['components/TrackingCard.tsx']));
check('clear buttons say what they clear', !/accessibilityLabel="Clear"/.test(all) && /Clear cervical mucus/.test(all) && /Clear sexual activity/.test(all));
check('delete names the medication', /'Delete ' \+ e\.name/.test(src['components/MedicationsSheet.tsx']));
check('settings rows are switches with a state', /accessibilityRole=\{core \? 'text' : 'switch'\}/.test(src['app/daily-tracking-settings.tsx']));

console.log('SHEETS: FOCUS + CLOSE');
const sheet = read('components/BottomSheet.tsx');
check('focus moves into the sheet title', /sendAccessibilityEvent\(titleRef\.current, 'focus'\)/.test(sheet) && /accessibilityRole="header"/.test(sheet));
check('screen behind is unreachable while open', /accessibilityViewIsModal/.test(sheet));
check('labelled close button', /accessibilityLabel=\{'Close ' \+ title\}/.test(sheet));
check('focus returns to the card that opened the sheet', (screen.match(/returnFocus\('/g) || []).length === 6);

console.log('REDUCED MOTION');
check('sheets do not slide', /animationType=\{reduceMotion \? 'none' : 'slide'\}/.test(sheet));
check('mood does not bounce', /if \(reduceMotion\) return;/.test(src['components/MoodSelector.tsx']));
check('toast does not fade, scrolling does not animate', /duration: reduceMotion \? 0 : 180/.test(screen) && /animated: !reduceMotion/.test(screen) && /animated: !reduceMotion/.test(src['components/DateSelector.tsx']));

console.log('TEXT SIZE');
const everything = all + sheet;
check('font scaling is never switched off', !/allowFontScaling=\{false\}/.test(everything));
check('only the fixed day circles are capped (at 130%)', (everything.match(/maxFontSizeMultiplier/g) || []).length === 2 && /maxFontSizeMultiplier=\{1\.3\}/.test(src['components/DateSelector.tsx']));
check('card labels wrap, never cut', !/numberOfLines=\{1\}/.test(src['components/TrackingCard.tsx']));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
