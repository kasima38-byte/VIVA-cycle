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
import { getVivaState, putDailyLog, removeDailyLog } from './vivaStore';

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
  };
  if (sameTrackedData(existing, toSave)) return 'unchanged';

  const ok = await putDailyLog(normalizeRecord(record.date, toSave));
  return ok ? 'saved' : 'failed';
}

/** Change some answers for one date, keeping the rest as saved. */
export async function updateDailyRecord(date: string, changes: DailyRecordChanges): Promise<SaveResult> {
  if (!isValidDateKey(date)) return 'invalid';
  return saveDailyRecord({ ...readDailyRecord(date), ...changes, date });
}

/** Remove everything saved for one date. */
export async function deleteDailyRecord(date: string): Promise<boolean> {
  if (!isValidDateKey(date)) return false;
  return removeDailyLog(date);
}
