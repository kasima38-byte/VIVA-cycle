// Dates - Prompt 17. Run under several time zones, e.g.:
//   TZ=Pacific/Kiritimati npx --yes tsx tests/dateHandling.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, getAllKeys: async () => [] } } };
const ROOT = path.join(__dirname, '..');
const dates = require('../constants/dateUtils');
const engine = require('../lib/cycleEngine');
const storage = require('../lib/dailyStorage');
const model = require('../lib/dailyTracking');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
console.log('Time zone: ' + (process.env.TZ || 'system') + ' (UTC offset ' + -new Date(2026, 9, 8).getTimezoneOffset() / 60 + 'h)');

console.log('BOUNDARIES');
for (const add of [dates.addDays, engine.addDays]) {
  check('year: Dec 31 -> Jan 1', add('2026-12-31', 1) === '2027-01-01' && add('2027-01-01', -1) === '2026-12-31');
  check('month: Jan 31 -> Feb 1', add('2026-01-31', 1) === '2026-02-01');
  check('leap: Feb 28 -> Feb 29 (2028), -> Mar 1 (2027)', add('2028-02-28', 1) === '2028-02-29' && add('2027-02-28', 1) === '2027-03-01');
}
check('impossible dates rejected', !dates.isValidDateKey('2027-02-29') && dates.isValidDateKey('2028-02-29') && !dates.isValidDateKey('2026-13-01') && !dates.isValidDateKey('2026-04-31'));
check('day difference across a year', dates.dayDiff('2025-12-31', '2026-01-01') === 1);
check('months across a year', eq(storage.monthsBetween('2025-11-15', '2026-02-01'), ['2025-11', '2025-12', '2026-01', '2026-02']));
check('full date keeps the right year', model.formatFullDate('2026-12-31').endsWith('December 31, 2026') && model.formatFullDate('2027-01-01').endsWith('January 1, 2027'));

console.log('LOCAL CALENDAR DATE (never UTC)');
check('one second after midnight stays the same date', dates.dateToKey(new Date(2026, 9, 8, 0, 0, 1)) === '2026-10-08');
check('one second before midnight stays the same date', dates.dateToKey(new Date(2026, 9, 8, 23, 59, 59)) === '2026-10-08');
check('midnight starts the next date', dates.dateToKey(new Date(2026, 9, 9, 0, 0, 0)) === '2026-10-09');
check('a stored key opens on its own day', dates.keyToLocalDate('2026-10-08').getDate() === 8 && dates.keyToLocalDate('2026-10-08').getMonth() === 9);
let bad = [];
for (let i = 0, d = '2026-01-01'; i < 365; i++, d = dates.addDays(d, 1)) {
  if (dates.dateToKey(dates.keyToLocalDate(d)) !== d) bad.push(d);
}
check('every day of 2026 survives key -> date -> key (incl. daylight saving days)', bad.length === 0, bad);
check('"today" is the local date', engine.todayLocal() === dates.dateToKey(new Date()));
const lib = fs.readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.ts')).map((f) => fs.readFileSync(path.join(ROOT, 'lib', f), 'utf8')).join('\n');
// cycleEngine's fromUTC() slices an ISO string built from a Date.UTC() timestamp - pure UTC day
// arithmetic, proven correct by the boundary checks above in every time zone. Anything else is flagged.
const libChecked = lib.replace("return new Date(ms).toISOString().slice(0, 10);", '');
check('no date keys made from local times via UTC timestamps', !/toISOString\(\)\s*\.\s*(slice|substring|substr|split)/.test(libChecked));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
