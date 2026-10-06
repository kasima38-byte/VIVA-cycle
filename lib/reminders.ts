// VIVA Cycle — what reminders to schedule (pure logic, no phone APIs: testable)
// Cycle reminders come ONLY from the engine's estimates and are worded as
// estimates. Nothing is planned while a period is late (dates are unknown).

import { addDays, calculateCycle, diffDays, DateStr, predictCycles } from './cycleEngine';
import type { VivaState } from './vivaStore';

export type ReminderKey =
  | 'period' | 'ovulation' | 'fertile' | 'summary'
  | 'medication' | 'water' | 'activity' | 'selfcare' | 'tips';

export const REMINDER_KEYS: ReminderKey[] = [
  'period', 'ovulation', 'fertile', 'summary', 'medication', 'water', 'activity', 'selfcare', 'tips',
];

export type ReminderTrigger =
  | { kind: 'date'; date: DateStr; hour: number; minute: number }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'monthly'; day: number; hour: number; minute: number };

export type PlannedReminder = {
  id: string;
  key: ReminderKey;
  title: string;
  body: string;
  trigger: ReminderTrigger;
  url: string; // screen to open when tapped
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (d: DateStr) => Number(d.slice(8, 10)) + ' ' + MONTHS[Number(d.slice(5, 7)) - 1];

const CYCLE_HOUR = 9; // cycle reminders arrive at 9:00 local time

export const TIPS = [
  'Log the first day of each period. It helps VIVA learn your real cycle length.',
  'Fertility estimates in VIVA are calendar-based. Your body may vary from cycle to cycle.',
  'Entered a period date by mistake? Fix it in Profile → Period history.',
  'Daily tracking of mood and energy can help you notice patterns over time.',
  'Cycle length is counted from one period start to the next, not the number of bleeding days.',
  'If your cycles change a lot or your period is very late, consider talking to a health worker.',
  'You can update your usual cycle length or your goal any time in Cycle Settings.',
  'Insights become more useful once you have logged a few complete cycles.',
];

/** Everything that should be scheduled right now, given her saved data and switches. */
export function planReminders(state: Pick<VivaState, 'baseline' | 'periods' | 'goal' | 'reminders'>, today: DateStr): PlannedReminder[] {
  const on = (k: ReminderKey) => !!state.reminders[k];
  const out: PlannedReminder[] = [];
  const at = (date: DateStr, hour = CYCLE_HOUR): ReminderTrigger => ({ kind: 'date', date, hour, minute: 0 });
  const future = (date: DateStr) => diffDays(date, today) > 0; // from tomorrow on (today's 9:00 may have passed)

  // ---- Cycle reminders: next 3 estimated cycles; none while late ----
  const est = calculateCycle(state.baseline, state.periods, today);
  if (est && !est.isLate) {
    predictCycles(est, 3).forEach((c, i) => {
      if (on('period')) {
        const d = addDays(c.periodStart, -2);
        if (future(d))
          out.push({
            id: 'period-' + i, key: 'period', url: '/(tabs)/calendar', trigger: at(d),
            title: 'Your period may start in about 2 days',
            body: 'Based on your cycle, your next period is estimated around ' + short(c.periodStart) + '. Timing can vary.',
          });
      }
      if (on('fertile')) {
        const d = addDays(c.fertileStart, -1);
        if (future(d))
          out.push({
            id: 'fertile-' + i, key: 'fertile', url: '/fertility', trigger: at(d),
            title: 'Estimated fertile window starts tomorrow',
            body:
              state.goal === 'avoid'
                ? 'Pregnancy may be possible from ' + short(c.fertileStart) + ' to ' + short(c.fertileEnd) + '. A calendar estimate is not contraception.'
                : 'Your estimated fertile window is ' + short(c.fertileStart) + ' – ' + short(c.fertileEnd) + '. This is a calendar-based estimate.',
          });
      }
      if (on('ovulation')) {
        const d = addDays(c.ovulation, -1);
        if (future(d))
          out.push({
            id: 'ovulation-' + i, key: 'ovulation', url: '/fertility', trigger: at(d),
            title: 'Estimated ovulation tomorrow',
            body:
              'Your estimated ovulation is ' + short(c.ovulation) + '. This is a calendar estimate, not a confirmed event.' +
              (state.goal === 'avoid' ? ' A calendar estimate is not contraception.' : ''),
          });
      }
    });
  }

  // ---- Monthly summary: 1st of each month ----
  if (on('summary'))
    out.push({
      id: 'summary', key: 'summary', url: '/(tabs)/insights', trigger: { kind: 'monthly', day: 1, hour: 9, minute: 0 },
      title: 'Your monthly cycle summary', body: 'See your cycle patterns in Insights.',
    });

  // ---- Lifestyle reminders: daily ----
  if (on('medication'))
    out.push({ id: 'medication', key: 'medication', url: '/(tabs)', trigger: { kind: 'daily', hour: 8, minute: 0 },
      title: 'Medication reminder', body: 'Time to take your medication.' });
  if (on('water'))
    [10, 13, 16].forEach((h) =>
      out.push({ id: 'water-' + h, key: 'water', url: '/(tabs)', trigger: { kind: 'daily', hour: h, minute: 0 },
        title: 'Water reminder', body: 'Time for a glass of water.' }));
  if (on('activity'))
    out.push({ id: 'activity', key: 'activity', url: '/(tabs)', trigger: { kind: 'daily', hour: 17, minute: 30 },
      title: 'Activity reminder', body: 'A short walk or some stretching can help you feel good.' });
  if (on('selfcare'))
    out.push({ id: 'selfcare', key: 'selfcare', url: '/(tabs)', trigger: { kind: 'daily', hour: 20, minute: 30 },
      title: 'Self-care reminder', body: 'Take a few minutes for yourself today.' });

  // ---- Tips: one each Monday for the next 8 weeks ----
  if (on('tips')) {
    const daysToMonday = ((8 - new Date(today + 'T12:00:00Z').getUTCDay()) % 7) || 7;
    TIPS.forEach((tip, i) =>
      out.push({ id: 'tip-' + i, key: 'tips', url: '/(tabs)', trigger: at(addDays(today, daysToMonday + i * 7), 10),
        title: 'VIVA tip', body: tip }));
  }

  return out;
}
