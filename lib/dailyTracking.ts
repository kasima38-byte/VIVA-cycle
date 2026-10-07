// VIVA Cycle - Daily Tracking record (the data model)
//
// One record per calendar date, keyed "YYYY-MM-DD" (see constants/dateUtils.ts).
// Every field starts as null, which means NOT TRACKED. null is never read as "No":
// "No" / "None" is always an answer she chose herself.
//
// Pure data + helpers only. No React, no storage.
// Storage: lib/dailyTrackingService.ts. Screen state: lib/useDailyTracking.ts.

import { addDays, keyToLocalDate } from '../constants/dateUtils';
import { SYMPTOMS, normalizeSymptomIds } from './symptoms';
import { MUCUS_OBSERVATIONS, normalizeMucusNote } from './cervicalMucus';
import type { MucusValue } from './cervicalMucus';
import { normalizeSexualActivity } from './sexualActivity';
import type { SexualActivity } from './sexualActivity';

// ---------- Values ----------

export type PeriodStatus = 'yes' | 'no';
export type FlowValue = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type MoodValue = 'very_low' | 'low' | 'okay' | 'good' | 'great';
export type { MucusValue }; // defined with the central list in lib/cervicalMucus.ts
export type { SexualActivity }; // defined in lib/sexualActivity.ts
/** Earlier single-word form - only read when converting older saved data. */
export type SexualActivityValue = 'none' | 'protected' | 'unprotected';

export type DailyTrackingRecord = {
  date: string;                              // "YYYY-MM-DD" - the record's only identity
  period: PeriodStatus | null;
  flow: FlowValue | null;
  symptoms: string[] | null;                 // [] = she chose "No symptoms"
  mood: MoodValue | null;
  energy: number | null;                     // 0-100
  cervicalMucus: MucusValue | null;
  cervicalMucusNote: string | null;          // optional note, only with "Unusual / Other"
  sexualActivity: SexualActivity | null;      // private: the card only ever says "Tracked"
  medications: string[] | null;              // [] = she chose "None taken"
  updatedAt: string | null;                  // ISO time of last save; null = never saved
};

export type TrackedField = Exclude<keyof DailyTrackingRecord, 'date' | 'updatedAt' | 'cervicalMucusNote'>;

export const TRACKED_FIELDS: TrackedField[] = [
  'period', 'flow', 'symptoms', 'mood', 'energy', 'cervicalMucus', 'sexualActivity', 'medications',
];

// ---------- Options (the labels she sees) ----------

export type Option<T extends string> = { value: T; label: string };

export const PERIOD_OPTIONS: Option<PeriodStatus>[] = [
  { value: 'yes', label: 'Period day' },
  { value: 'no', label: 'No period' },
];

export const FLOW_OPTIONS: Option<FlowValue>[] = [
  { value: 'none', label: 'No bleeding' },
  { value: 'spotting', label: 'Spotting' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

export const MOOD_OPTIONS: Option<MoodValue>[] = [
  { value: 'very_low', label: 'Very low' },
  { value: 'low', label: 'Low' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'great', label: 'Great' },
];

// Labels come from the central list (lib/cervicalMucus.ts)
export const MUCUS_OPTIONS: Option<MucusValue>[] = MUCUS_OBSERVATIONS.map((m) => ({ value: m.id, label: m.cardLabel }));

export const SEXUAL_ACTIVITY_OPTIONS: Option<SexualActivityValue>[] = [
  { value: 'none', label: 'No sex' },
  { value: 'protected', label: 'Protected sex' },
  { value: 'unprotected', label: 'Unprotected sex' },
];

// Labels come from the central symptom library (lib/symptoms.ts)
export const SYMPTOM_OPTIONS: Option<string>[] = SYMPTOMS.map((s) => ({ value: s.id, label: s.label }));

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

/** The one energy mapping: 0-20 Very low, 21-40 Low, 41-60 Moderate, 61-80 High, 81-100 Very high */
export function energyLabel(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  if (v <= 20) return ENERGY_LEVELS[0];
  if (v <= 40) return ENERGY_LEVELS[1];
  if (v <= 60) return ENERGY_LEVELS[2];
  if (v <= 80) return ENERGY_LEVELS[3];
  return ENERGY_LEVELS[4];
}

export const getEnergyLabel = energyLabel;

/** Neutral slider position before she touches it. Shown as "Not tracked" - never saved unless she chooses it. */
export const ENERGY_START = 50;

/** The slider snaps to steps of 5 (no jitter); the - / + buttons and screen readers move 10. */
export const ENERGY_STEP = 5;
export const ENERGY_BUTTON_STEP = 10;

export function snapEnergy(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value / ENERGY_STEP) * ENERGY_STEP));
}

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
    cervicalMucusNote: null,
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

/** Symptom IDs: no duplicates, stored in library order. */
function symptomList(v: unknown): string[] | null {
  const list = stringList(v);
  return list ? normalizeSymptomIds(list) : null;
}

/** Turns anything read from storage (including older entries that only had
 *  mood/energy/symptoms) into a complete, valid record for that date. */
export function normalizeRecord(date: string, raw: unknown): DailyTrackingRecord {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const energy =
    typeof r.energy === 'number' && Number.isFinite(r.energy)
      ? Math.round(Math.max(0, Math.min(100, r.energy)))
      : null;
  const mucus = oneOf(MUCUS_OPTIONS, r.cervicalMucus === 'eggWhite' ? 'egg_white' : r.cervicalMucus); // 'eggWhite' = earlier ID
  return {
    date,
    period: oneOf(PERIOD_OPTIONS, r.period),
    flow: oneOf(FLOW_OPTIONS, r.flow),
    symptoms: symptomList(r.symptoms),
    mood: oneOf(MOOD_OPTIONS, r.mood === 'veryLow' ? 'very_low' : r.mood), // 'veryLow' = earlier ID
    energy,
    cervicalMucus: mucus,
    cervicalMucusNote: mucus === 'other' ? normalizeMucusNote(r.cervicalMucusNote) : null,
    sexualActivity: normalizeSexualActivity(r.sexualActivity),
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
      // The card shows a count only (calm and private); names are for screen readers and the sheet
      if (!record.symptoms) return NOT_TRACKED;
      if (record.symptoms.length === 0) return 'No symptoms';
      return full
        ? record.symptoms.length + ' selected: ' + listFull(record.symptoms, SYMPTOM_OPTIONS, '')
        : record.symptoms.length + ' selected';
    case 'mood':
      return record.mood ? labelOf(MOOD_OPTIONS, record.mood) : NOT_TRACKED;
    case 'energy':
      return record.energy !== null ? energyLabel(record.energy) : NOT_TRACKED;
    case 'cervicalMucus':
      return record.cervicalMucus ? labelOf(MUCUS_OPTIONS, record.cervicalMucus) : NOT_TRACKED;
    case 'sexualActivity':
      // Private: the card and screen readers only ever say "Tracked"
      return record.sexualActivity ? 'Tracked' : NOT_TRACKED;
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
