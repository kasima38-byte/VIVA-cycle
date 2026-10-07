// VIVA Cycle - Daily Tracking record (the data model)
//
// One record per calendar date, keyed "YYYY-MM-DD" (see constants/dateUtils.ts).
// Every field starts as null, which means NOT TRACKED. null is never read as "No":
// "No" / "None" is always an answer she chose herself.
//
// Pure data + helpers only. No React, no storage.
// Storage: lib/dailyTrackingService.ts. Screen state: lib/useDailyTracking.ts.

import { addDays, keyToLocalDate } from '../constants/dateUtils';

// ---------- Values ----------

export type PeriodStatus = 'yes' | 'no';
export type FlowValue = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type MoodValue = 'veryLow' | 'low' | 'okay' | 'good' | 'great';
export type MucusValue = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggWhite';
export type SexualActivityValue = 'none' | 'protected' | 'unprotected';

export type DailyTrackingRecord = {
  date: string;                              // "YYYY-MM-DD" - the record's only identity
  period: PeriodStatus | null;
  flow: FlowValue | null;
  symptoms: string[] | null;                 // [] = she chose "No symptoms"
  mood: MoodValue | null;
  energy: number | null;                     // 0-100
  cervicalMucus: MucusValue | null;
  sexualActivity: SexualActivityValue | null;
  medications: string[] | null;              // [] = she chose "None taken"
  updatedAt: string | null;                  // ISO time of last save; null = never saved
};

export type TrackedField = Exclude<keyof DailyTrackingRecord, 'date' | 'updatedAt'>;

export const TRACKED_FIELDS: TrackedField[] = [
  'period', 'flow', 'symptoms', 'mood', 'energy', 'cervicalMucus', 'sexualActivity', 'medications',
];

// ---------- Options (the labels she sees) ----------

export type Option<T extends string> = { value: T; label: string };

export const PERIOD_OPTIONS: Option<PeriodStatus>[] = [
  { value: 'yes', label: 'Period today' },
  { value: 'no', label: 'Not today' },
];

export const FLOW_OPTIONS: Option<FlowValue>[] = [
  { value: 'none', label: 'No flow' },
  { value: 'spotting', label: 'Spotting' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

export const MOOD_OPTIONS: Option<MoodValue>[] = [
  { value: 'veryLow', label: 'Very low' },
  { value: 'low', label: 'Low' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
];

export const MUCUS_OPTIONS: Option<MucusValue>[] = [
  { value: 'dry', label: 'Dry' },
  { value: 'sticky', label: 'Sticky' },
  { value: 'creamy', label: 'Creamy' },
  { value: 'watery', label: 'Watery' },
  { value: 'eggWhite', label: 'Egg white' },
];

export const SEXUAL_ACTIVITY_OPTIONS: Option<SexualActivityValue>[] = [
  { value: 'none', label: 'No sex' },
  { value: 'protected', label: 'Protected sex' },
  { value: 'unprotected', label: 'Unprotected sex' },
];

export const SYMPTOM_OPTIONS: Option<string>[] = [
  { value: 'cramps', label: 'Cramps' },
  { value: 'headache', label: 'Headache' },
  { value: 'bloating', label: 'Bloating' },
  { value: 'breastTenderness', label: 'Breast tenderness' },
  { value: 'backPain', label: 'Back pain' },
  { value: 'acne', label: 'Acne' },
  { value: 'nausea', label: 'Nausea' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'cravings', label: 'Cravings' },
  { value: 'moodSwings', label: 'Mood swings' },
];

export const MEDICATION_OPTIONS: Option<string>[] = [
  { value: 'painRelief', label: 'Pain relief' },
  { value: 'birthControl', label: 'Birth control' },
  { value: 'vitamins', label: 'Vitamins / supplements' },
  { value: 'iron', label: 'Iron' },
  { value: 'other', label: 'Other' },
];

export function labelOf<T extends string>(options: Option<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

// ---------- Energy (one scale used everywhere) ----------

export const ENERGY_LEVELS = ['Very low', 'Low', 'Moderate', 'High', 'Very high'] as const;

/** 0-19 Very low, 20-39 Low, 40-59 Moderate, 60-79 High, 80-100 Very high */
export function energyLabel(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  return ENERGY_LEVELS[Math.min(4, Math.floor(v / 20))];
}

/** Where the slider starts before she touches it (shown as untracked until she does). */
export const ENERGY_START = 50;

// ---------- Creating and cleaning records ----------

export function emptyRecord(date: string): DailyTrackingRecord {
  return {
    date,
    period: null,
    flow: null,
    symptoms: null,
    mood: null,
    energy: null,
    cervicalMucus: null,
    sexualActivity: null,
    medications: null,
    updatedAt: null,
  };
}

function oneOf<T extends string>(options: Option<T>[], v: unknown): T | null {
  return options.some((o) => o.value === v) ? (v as T) : null;
}

function stringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return Array.from(new Set(v.filter((s): s is string => typeof s === 'string' && s.length > 0)));
}

/** Turns anything read from storage (including older entries that only had
 *  mood/energy/symptoms) into a complete, valid record for that date. */
export function normalizeRecord(date: string, raw: unknown): DailyTrackingRecord {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const energy =
    typeof r.energy === 'number' && Number.isFinite(r.energy)
      ? Math.round(Math.max(0, Math.min(100, r.energy)))
      : null;
  return {
    date,
    period: oneOf(PERIOD_OPTIONS, r.period),
    flow: oneOf(FLOW_OPTIONS, r.flow),
    symptoms: stringList(r.symptoms),
    mood: oneOf(MOOD_OPTIONS, r.mood),
    energy,
    cervicalMucus: oneOf(MUCUS_OPTIONS, r.cervicalMucus),
    sexualActivity: oneOf(SEXUAL_ACTIVITY_OPTIONS, r.sexualActivity),
    medications: stringList(r.medications),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
  };
}

// ---------- Tracking state ----------

export type TrackingState = 'empty' | 'partial' | 'complete';

export function isTracked(record: DailyTrackingRecord, field: TrackedField): boolean {
  return record[field] !== null;
}

export function trackedCount(record: DailyTrackingRecord): number {
  return TRACKED_FIELDS.filter((f) => isTracked(record, f)).length;
}

export function hasAnyData(record: DailyTrackingRecord): boolean {
  return trackedCount(record) > 0;
}

export function trackingState(record: DailyTrackingRecord): TrackingState {
  const n = trackedCount(record);
  if (n === 0) return 'empty';
  return n === TRACKED_FIELDS.length ? 'complete' : 'partial';
}

function canon(v: unknown): string {
  return Array.isArray(v) ? JSON.stringify([...v].sort()) : JSON.stringify(v);
}

/** True when two records hold the same answers (ignores updatedAt and list order).
 *  Used so an unchanged day is never saved again. */
export function sameTrackedData(a: DailyTrackingRecord, b: DailyTrackingRecord): boolean {
  return TRACKED_FIELDS.every((f) => canon(a[f]) === canon(b[f]));
}

// ---------- What each card shows ----------

export const NOT_TRACKED = 'Not tracked';

function listShort(values: string[], options: Option<string>[], noneLabel: string): string {
  if (values.length === 0) return noneLabel;
  const labels = values.map((v) => labelOf(options, v));
  return labels.length <= 2 ? labels.join(', ') : labels[0] + ' + ' + (labels.length - 1) + ' more';
}

function listFull(values: string[], options: Option<string>[], noneLabel: string): string {
  return values.length === 0 ? noneLabel : values.map((v) => labelOf(options, v)).join(', ');
}

/** Short text for a card, e.g. "Not tracked", "Good", "Headache + 2 more". */
export function fieldSummary(record: DailyTrackingRecord, field: TrackedField): string {
  return fieldText(record, field, false);
}

/** Full text with nothing shortened - for screen readers and the input sheets. */
export function fieldFullText(record: DailyTrackingRecord, field: TrackedField): string {
  return fieldText(record, field, true);
}

function fieldText(record: DailyTrackingRecord, field: TrackedField, full: boolean): string {
  const list = full ? listFull : listShort;
  switch (field) {
    case 'period':
      return record.period ? labelOf(PERIOD_OPTIONS, record.period) : NOT_TRACKED;
    case 'flow':
      return record.flow ? labelOf(FLOW_OPTIONS, record.flow) : NOT_TRACKED;
    case 'symptoms':
      return record.symptoms ? list(record.symptoms, SYMPTOM_OPTIONS, 'No symptoms') : NOT_TRACKED;
    case 'mood':
      return record.mood ? labelOf(MOOD_OPTIONS, record.mood) : NOT_TRACKED;
    case 'energy':
      return record.energy !== null ? energyLabel(record.energy) : NOT_TRACKED;
    case 'cervicalMucus':
      return record.cervicalMucus ? labelOf(MUCUS_OPTIONS, record.cervicalMucus) : NOT_TRACKED;
    case 'sexualActivity':
      return record.sexualActivity ? labelOf(SEXUAL_ACTIVITY_OPTIONS, record.sexualActivity) : NOT_TRACKED;
    case 'medications':
      return record.medications ? list(record.medications, MEDICATION_OPTIONS, 'None taken') : NOT_TRACKED;
  }
}

// ---------- Dates ----------

export type DateRelation = 'today' | 'past' | 'future';

/** "YYYY-MM-DD" keys compare correctly as plain strings. */
export function dateRelation(date: string, today: string): DateRelation {
  if (date === today) return 'today';
  return date < today ? 'past' : 'future';
}

export function canLog(date: string, today: string): boolean {
  return date <= today;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Wednesday, October 7" */
export function formatLongDate(date: string): string {
  const d = keyToLocalDate(date);
  return WEEKDAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
}

/** "June 8" */
export function formatMonthDay(date: string): string {
  const d = keyToLocalDate(date);
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}

/** "Today", "Yesterday", "Tomorrow" or null for any other day. */
export function relativeDayName(date: string, today: string): string | null {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return null;
}

/** "Save Today's Data", "Save Yesterday's Data", "Save June 8's Data" */
export function saveButtonLabel(date: string, today: string): string {
  const name = relativeDayName(date, today);
  if (name === 'Today' || name === 'Yesterday') return 'Save ' + name + "'s Data";
  return 'Save ' + formatMonthDay(date) + "'s Data";
}
