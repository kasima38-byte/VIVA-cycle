// UX polish - Prompt 15 checks (no phone needed; the look itself needs the phone)
// Run: npx --yes tsx tests/uxPolish.test.cjs
const fs = require('fs');
const path = require('path');
const asPath = require.resolve('@react-native-async-storage/async-storage');
require.cache[asPath] = { id: asPath, filename: asPath, loaded: true, exports: { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } } };
const ROOT = path.join(__dirname, '..');
const model = require('../lib/dailyTracking');
const dates = require('../constants/dateUtils');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + '\n        got: ' + JSON.stringify(detail)); }
}

const today = dates.getToday();
const past = dates.addDays(today, -1);
const future = dates.addDays(today, 3);

console.log('DATE HEADER');
check('full date with weekday and year', /^[A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2}, \d{4}$/.test(model.formatFullDate(today)), model.formatFullDate(today));
check('Today label on today', model.dateHeader(today, today).label === 'Today');
check('no label on past dates', model.dateHeader(past, today).label === null);
check('"Future date" on future dates', model.dateHeader(future, today).label === 'Future date');

console.log('DATE-ACCURATE MESSAGES');
check('today', model.savedMessage(today, today) === "Today's data saved");
check('past date names the date', model.savedMessage(past, today) === model.formatMonthDay(past) + ' data saved', model.savedMessage(past, today));
check('future explanation', model.FUTURE_DATE_MESSAGE.startsWith('Daily tracking is for recorded observations.'));

const screen = read('app/daily-tracking.tsx');
const card = read('components/TrackingCard.tsx');
const slider = read('components/EnergySlider.tsx');
const medsSheet = read('components/MedicationsSheet.tsx');
const mucusSheet = read('components/MucusSheet.tsx');
const selector = read('components/DateSelector.tsx');

console.log('SCREEN');
check('header uses the two-level date', /dateHeader\(selectedDate, today\)/.test(screen) && /header\.full/.test(screen));
check('Today shortcut only on other dates', /relation !== 'today'/.test(screen) && />Today</.test(screen));
check('future cards explain instead of failing silently', /show\(FUTURE_DATE_MESSAGE/.test(screen) && /muted=\{!canEdit\}/.test(screen));
check('energy card shows its number', /record\.energy \+ ' — ' \+ energyLabel/.test(screen));
check('save message names the date', /savedMessage\(date, today\)/.test(screen));
check('one column on very narrow phones, readable width on tablets', /screenWidth < 340/.test(screen) && /maxWidth: 680/.test(screen));

console.log('CARDS');
check('labels wrap instead of being cut off', !/numberOfLines=\{1\}/.test(card));
check('one affordance: Add when empty, chevron when tracked', /tracked \? \(/.test(card) && />Add</.test(card));

console.log('CONTROLS');
const num = (re) => Number((slider.match(re) || [])[1]);
check('slider thumb >= 30, touch area >= 48', num(/const THUMB = (\d+)/) >= 30 && num(/const TOUCH_HEIGHT = (\d+)/) >= 48);
check('slider shows the number and the label', /percent \+ ' · ' \+ label/.test(slider));
check('date arrows are wider', /minWidth: 40/.test(selector));
check('medication dose opens a number keyboard', /keyboardType=\{Platform\.OS === 'ios' \? 'numbers-and-punctuation' : 'numeric'\}/.test(medsSheet));
check('notes allow several lines', /multiline/.test(medsSheet) && /multiline/.test(mucusSheet));

console.log('NO PRESSURE OR GAMIFICATION');
const files = ['app/daily-tracking.tsx', 'app/daily-tracking-settings.tsx', 'components/TrackingCard.tsx', 'components/PeriodSheet.tsx', 'components/FlowSheet.tsx', 'components/SymptomsSheet.tsx', 'components/MucusSheet.tsx', 'components/SexualActivitySheet.tsx', 'components/MedicationsSheet.tsx'];
const all = files.map(read).join('\n');
const bad = all.match(/streak|perfect day|you're behind|you missed|complete your day|track more|% complete|confetti|achievement/i);
check('none found', !bad, bad && bad[0]);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
