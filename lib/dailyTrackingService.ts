import { TRACKED_FIELDS } from './dailyTracking';
// VIVA Cycle - Daily Tracking service
//
// The ONLY way screens read or change Daily Tracking data:
//   UI -> lib/useDailyTracking.ts (state) -> this file (service) -> lib/vivaStore.ts (storage)
//
// Today it uses the phone's saved data. Cloud sync can be added here later
// without changing any screen (the functions are already async).

import { getToday, isValidDateKey } from '../constants/dateUtils';
import {
  DailyTrackingRecord, TrackedField, canLog, emptyRecord, normalizeRecord, sameTrackedData,
} from './dailyTracking';
import { clearTrackingDataKeepPeriods, getDamagedMonthCount, getVivaState, putDailyLog, removeDailyLog } from './vivaStore';
import { PeriodResult, removePeriodDay } from './periodService';
import { monthsBetween } from './dailyStorage';

export type SaveResult =
  | 'saved'      // written to the phone
  | 'unchanged'  // same as what is already saved: nothing written
  | 'future'     // date is after today: refused, no record created
  | 'invalid'    // not a real "YYYY-MM-DD" date
  | 'failed';    // the phone could not save (or saving is blocked after a load error)

export type DailyRecordChanges = Partial<Pick<DailyTrackingRecord, TrackedField>>;

/** Synchronous read of the saved record (or an empty, untracked one). Always a fresh copy. */
export function readDailyRecord(date: string): DailyTrackingRecord {
  const saved = getVivaState().dailyLogs[date];
  return saved ? normalizeRecord(date, saved) : emptyRecord(date);
}

/** The saved record for a date, or an empty (all "Not tracked") record. Never invents data. */
export async function getDailyRecord(date: string): Promise<DailyTrackingRecord> {
  return readDailyRecord(date);
}

/** True when that date has a saved record. */
export function hasDailyRecord(date: string): boolean {
  return Object.prototype.hasOwnProperty.call(getVivaState().dailyLogs, date);
}

/** Save a whole record for its date. Replaces what was saved before - never duplicates. */
export async function saveDailyRecord(record: DailyTrackingRecord): Promise<SaveResult> {
  if (!isValidDateKey(record.date)) return 'invalid';
  if (!canLog(record.date, getToday())) return 'future';

  const existing = readDailyRecord(record.date);
  // Period, flow and symptoms are saved by their own sheets (lib/periodService.ts,
  // lib/flowService.ts, lib/symptomService.ts): a Daily Tracking save never changes them
  const toSave = {
    ...record,
    period: existing.period,
    flow: existing.flow,
    symptoms: existing.symptoms,
    cervicalMucus: existing.cervicalMucus,         // lib/mucusService.ts
    cervicalMucusNote: existing.cervicalMucusNote,
    sexualActivity: existing.sexualActivity,       // lib/sexualActivityService.ts
    medications: existing.medications,             // lib/medicationService.ts
  };
  const clean = normalizeRecord(record.date, toSave);
  if (sameTrackedData(existing, clean)) return 'unchanged';

  const ok = await putDailyLog(clean);
  return ok ? 'saved' : 'failed';
}

/** Change some answers for one date, keeping the rest as saved. */
export async function updateDailyRecord(date: string, changes: DailyRecordChanges): Promise<SaveResult> {
  if (!isValidDateKey(date)) return 'invalid';
  const merged = normalizeRecord(date, { ...readDailyRecord(date), ...changes, date });
  // A value that validation rejected must never be reported as "saved"
  const mergedFields = merged as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(changes)) {
    if (v !== null && v !== undefined && mergedFields[k] === null) return 'invalid';
  }
  return saveDailyRecord(merged);
}

/** Remove everything saved for one date. */
export async function deleteDailyRecord(date: string): Promise<boolean> {
  if (!isValidDateKey(date)) return false;
  return removeDailyLog(date);
}

// ---------- Field-level updates ----------
// Every change follows: READ -> MERGE ONE FIELD -> VALIDATE -> PERSIST -> UPDATE UI.
// Never replace a whole record with partial data.
//
// EMPTY RULE (every field, lists included): null = not tracked.
// A day with nothing tracked is not stored at all; clearing one field never removes the others.

export type FieldValueField = Exclude<TrackedField, 'period'>;

function withoutStamp(r: DailyTrackingRecord) {
  const { updatedAt: _u, ...rest } = r;
  return rest;
}

/** Change ONE field for one date; every other field is preserved.
 *  Period days span several dates, so they go through lib/periodService.ts instead. */
export async function updateDailyTrackingField<F extends FieldValueField>(
  date: string, field: F, value: DailyTrackingRecord[F]
): Promise<SaveResult> {
  if ((field as string) === 'period') return 'invalid';
  if (!isValidDateKey(date)) return 'invalid';
  if (!canLog(date, getToday())) return 'future';
  const existing = readDailyRecord(date);
  const merged = normalizeRecord(date, { ...existing, [field]: value });
  if (value !== null && merged[field] === null) return 'invalid'; // value not accepted
  if (JSON.stringify(withoutStamp(existing)) === JSON.stringify(withoutStamp(merged))) return 'unchanged';
  return (await putDailyLog(merged)) ? 'saved' : 'failed';
}

/** Return one field to "not tracked". Other fields on that day are kept. */
export async function clearDailyRecordField(date: string, field: TrackedField): Promise<SaveResult | PeriodResult> {
  if (field === 'period') return removePeriodDay(date);
  return updateDailyTrackingField(date, field, null);
}

// Month index: date keys grouped by month. Rebuilt only when saved data changes.
const monthIndexCache = new WeakMap<object, Map<string, string[]>>();

function monthIndex(): { logs: Record<string, DailyTrackingRecord>; index: Map<string, string[]> } {
  const logs = getVivaState().dailyLogs;
  let index = monthIndexCache.get(logs);
  if (!index) {
    index = new Map();
    for (const d of Object.keys(logs)) {
      const m = d.slice(0, 7);
      const list = index.get(m) ?? [];
      list.push(d);
      index.set(m, list);
    }
    index.forEach((list) => list.sort());
    monthIndexCache.set(logs, index);
  }
  return { logs, index };
}

/** Saved records between two dates (inclusive), oldest first. Only months in range are visited. */
export function getRecordsForDateRange(start: string, end: string): DailyTrackingRecord[] {
  if (!isValidDateKey(start) || !isValidDateKey(end) || end < start) return [];
  const { logs, index } = monthIndex();
  const out: DailyTrackingRecord[] = [];
  for (const m of monthsBetween(start, end)) {
    for (const d of index.get(m) ?? []) {
      if (d >= start && d <= end) out.push(normalizeRecord(d, logs[d]));
    }
  }
  return out;
}

/** One calendar month of saved records (month 1-12), oldest first. */
export function getRecordsForMonth(year: number, month: number): DailyTrackingRecord[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const { logs, index } = monthIndex();
  const m = year + '-' + String(month).padStart(2, '0');
  return (index.get(m) ?? []).map((d) => normalizeRecord(d, logs[d]));
}

/** The most recent date with saved tracking, or null. */
export function getLatestTrackedDate(): string | null {
  const { index } = monthIndex();
  const months = Array.from(index.keys()).sort();
  const last = months[months.length - 1];
  if (!last) return null;
  const days = index.get(last) ?? [];
  return days[days.length - 1] ?? null;
}

/** A fresh, untracked record for a date. Kept in memory only - nothing is stored
 *  until she actually records something. */
export function createDailyRecord(date: string): DailyTrackingRecord | null {
  return isValidDateKey(date) ? emptyRecord(date) : null;
}

// ---------- Clear Daily Tracking data (Settings) ----------

export type ClearSummary = {
  daysAffected: number;
  periodDaysKept: number;
  /** Unreadable months set aside on the phone; clearing removes them too. */
  damagedMonths: number;
};

/** What clearing would remove - read only, nothing is changed. */
export function getClearSummary(): ClearSummary {
  let daysAffected = 0;
  let periodDaysKept = 0;
  for (const rec of Object.values(getVivaState().dailyLogs)) {
    if (TRACKED_FIELDS.some((f) => f !== 'period' && rec[f] !== null)) daysAffected++;
    if (rec.period !== null) periodDaysKept++;
  }
  return { daysAffected, periodDaysKept, damagedMonths: getDamagedMonthCount() };
}

/** Permanently remove everything recorded in Daily Tracking except period days.
 *  Call only after the user has explicitly confirmed. */
export async function clearAllTrackingData(): Promise<'saved' | 'unchanged' | 'failed'> {
  const summary = getClearSummary();
  if (summary.daysAffected === 0 && summary.damagedMonths === 0) return 'unchanged';
  return (await clearTrackingDataKeepPeriods()) ? 'saved' : 'failed';
}
