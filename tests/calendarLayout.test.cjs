// Calendar screen order: Calendar -> Legend -> Track your period card -> Cycle Insights
// Run: npx --yes tsx tests/calendarLayout.test.cjs
require('./support/securityFakes.ts'); // phone security modules (Keychain, AES-GCM) for Node
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'app/(tabs)/calendar.tsx'), 'utf8');
let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}
const at = (t) => s.indexOf(t);
const order = ['<MonthSelector', '<CycleCalendar', '<CalendarLegend />', '{(card || tapMessage) && (', '<CycleInsightsSection'].map(at);
check('order: month selector, calendar, legend, tracking card, Cycle Insights', order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order);
check('exactly one tracking card and one legend', s.split('{(card || tapMessage) && (').length === 2 && s.split('<CalendarLegend />').length === 2);
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
