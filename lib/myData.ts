// VIVA Cycle - My Data: the summary she sees and the file she can export (pure, testable).
//
// Everything is read from the canonical store (lib/vivaStore.ts), the SAME records Calendar,
// Insights and Profile use. Nothing is copied or cached here, and predictions never appear:
// the store only holds what she recorded (bleeding days are days she tapped).

import type { Goal, Regularity } from './cycleEngine';
import type { DailyTrackingSettings } from './dailyTrackingSettings';
import { TRACKED_FIELDS } from './dailyTracking';
import { GOAL_OPTIONS } from './goals';
import type { DailyLog, VivaState } from './vivaStore';

// Goal labels: the app's one list (lib/goals.ts), so they always match Cycle Settings
export const GOAL_LABELS = Object.fromEntries(GOAL_OPTIONS.map((o) => [o.key, o.label])) as Record<Goal, string>;
export const REGULARITY_LABELS: Record<Regularity, string> = {
  regular: 'Regular',
  somewhat_irregular: 'Somewhat irregular',
  irregular: 'Irregular',
  not_sure: 'Not sure',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-03" -> "3 Oct 2026" */
export function formatDate(d: string | null): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '–';
  return Number(d.slice(8, 10)) + ' ' + MONTHS[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);
}

type StoreData = Pick<VivaState, 'name' | 'dateOfBirth' | 'baseline' | 'goal' | 'periods' | 'dailyLogs' | 'reminders' | 'discreetNotifications'>;

/** Any Daily Tracking answer other than the period field. */
const hasTrackingAnswer = (r: DailyLog) => TRACKED_FIELDS.some((f) => f !== 'period' && r[f] !== null);

export type MyDataSummary = {
  periodsRecorded: number;        // confirmed periods (same list as Profile, Calendar and Insights)
  latestPeriodStart: string | null;
  bleedingDays: number;           // days she marked as bleeding
  usualCycleLength: number | null;
  usualPeriodLength: number | null;
  regularity: Regularity;
  goal: Goal | null;
  trackingDays: number;           // dates with any Daily Tracking answer (besides period)
  latestTrackingDate: string | null;
};

export function getMyDataSummary(s: StoreData): MyDataSummary {
  const logs = Object.values(s.dailyLogs);
  const tracking = logs.filter(hasTrackingAnswer).map((r) => r.date).sort();
  return {
    periodsRecorded: s.periods.length,
    latestPeriodStart: s.periods.length ? s.periods[s.periods.length - 1].start : null,
    bleedingDays: logs.filter((r) => r.period === 'yes').length,
    usualCycleLength: s.baseline.cycleLength,
    usualPeriodLength: s.baseline.periodLength,
    regularity: s.baseline.regularity,
    goal: s.goal,
    trackingDays: tracking.length,
    latestTrackingDate: tracking.length ? tracking[tracking.length - 1] : null,
  };
}

// ---------------- Export ----------------

export const EXPORT_FORMAT = 'viva-cycle-export';
export const EXPORT_FORMAT_VERSION = 1;

/** The export, as documented in the file itself. Only her own records and choices: no storage
 *  keys, journals, backups, damaged-copy recovery data, schema/layout fields or debug data. */
export function buildExport(s: StoreData, trackingSettings: DailyTrackingSettings, now: Date) {
  const days = Object.values(s.dailyLogs)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const out: Record<string, unknown> = { date: r.date };
      for (const f of [...TRACKED_FIELDS, 'cervicalMucusNote', 'createdAt', 'updatedAt'] as const) {
        if (r[f] !== null && r[f] !== undefined) out[f] = r[f];
      }
      return out;
    });
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    app: 'VIVA Cycle',
    exportedAt: now.toISOString(),
    about:
      'Your VIVA Cycle records. Dates are YYYY-MM-DD in your phone\'s local time. Only what you recorded or ' +
      'chose is included: predictions and estimates are not.',
    profile: { name: s.name, dateOfBirth: s.dateOfBirth },
    cycleSettings: {
      usualCycleLength: s.baseline.cycleLength,
      usualPeriodLength: s.baseline.periodLength,
      regularity: s.baseline.regularity,
      goal: s.goal,
    },
    periods: {
      about: 'Confirmed periods, worked out from the days you marked as bleeding. "end" is the last recorded bleeding day of a finished period.',
      list: s.periods.map((p) => (p.end ? { start: p.start, end: p.end } : { start: p.start })),
    },
    dailyTracking: {
      about: 'One entry per date you recorded something. "period": "yes" marks a bleeding day.',
      days,
    },
    settings: {
      reminders: { ...s.reminders },
      discreetNotifications: s.discreetNotifications,
      dailyTrackingCategoriesShown: { ...trackingSettings },
    },
  };
}

export type ExportContents = {
  periods: number;
  bleedingDays: number;
  trackingDays: number;
  sexualActivityDays: number;
  medicationDays: number;
};

export function exportContents(s: StoreData): ExportContents {
  const logs = Object.values(s.dailyLogs);
  return {
    periods: s.periods.length,
    bleedingDays: logs.filter((r) => r.period === 'yes').length,
    trackingDays: logs.filter(hasTrackingAnswer).length,
    sexualActivityDays: logs.filter((r) => r.sexualActivity !== null).length,
    medicationDays: logs.filter((r) => r.medications !== null && r.medications.length > 0).length,
  };
}

const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);

/** What the export holds, told BEFORE she shares it (counts only, no details). */
export function describeExport(c: ExportContents): { title: string; body: string } {
  const private_: string[] = [];
  if (c.sexualActivityDays) private_.push('sexual activity on ' + plural(c.sexualActivityDays, 'day'));
  if (c.medicationDays) private_.push('medications on ' + plural(c.medicationDays, 'day'));
  const lines = [
    '• Your name and date of birth',
    '• Cycle settings and goal',
    '• ' + plural(c.periods, 'period') + ' (' + plural(c.bleedingDays, 'bleeding day') + ')',
    '• Daily Tracking on ' + plural(c.trackingDays, 'day') + (private_.length ? ', including ' + private_.join(' and ') : ''),
    '• Your reminder and tracking settings',
  ];
  return {
    title: 'Export your VIVA Cycle data?',
    body:
      'This creates a file (JSON) with:\n' + lines.join('\n') + '\n\n' +
      'It may contain sensitive reproductive-health information. Anyone who gets the file can read it.\n\n' +
      "VIVA Cycle doesn't send it anywhere. Next, you choose where to save or share it, or cancel.",
  };
}

export function exportFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `viva-cycle-export-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
