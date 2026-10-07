// VIVA Cycle - Medications service
// The ONLY way screens change medications. Only the `medications` list of a day changes.
// Each entry keeps its ID, so editing never duplicates. Values are never logged.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import {
  MEDICATION_LIMITS, MedicationEntry, medicationFrequency, newMedicationId, normalizeMedicationEntry, normalizeTime,
} from './medications';
import { getVivaState, saveDailyLog } from './vivaStore';

export type MedicationResult =
  | 'saved'        // written to the phone
  | 'unchanged'    // same as what is saved
  | 'future'       // can only be recorded for today or earlier
  | 'invalid'      // not a real date, or a time that isn't "HH:MM"
  | 'missingName'  // a medication name is required
  | 'notFound'     // no entry with that ID on this date
  | 'tooMany'      // more than the daily limit
  | 'failed';      // the phone could not save

export type MedicationInput = {
  name: string;
  dose?: string | null;
  unit?: string | null;
  time?: string | null;
  note?: string | null;
};

export function getMedications(date: string): MedicationEntry[] {
  return getVivaState().dailyLogs[date]?.medications ?? [];
}

function checkDate(date: string): MedicationResult | null {
  if (!isValidDateKey(date)) return 'invalid';
  if (date > getToday()) return 'future';
  return null;
}

function toEntry(id: string, input: MedicationInput): MedicationEntry | 'missingName' | 'invalid' {
  if (input.time && normalizeTime(input.time) === null) return 'invalid';
  return normalizeMedicationEntry({ ...input, id }, id) ?? 'missingName';
}

function write(date: string, list: MedicationEntry[]): Promise<boolean> {
  // No entries left = null (Not tracked), never an empty list
  return saveDailyLog(date, { medications: list.length > 0 ? list : null });
}

export async function addMedication(
  date: string, input: MedicationInput
): Promise<{ result: MedicationResult; id: string | null }> {
  const problem = checkDate(date);
  if (problem) return { result: problem, id: null };
  const list = getMedications(date);
  if (list.length >= MEDICATION_LIMITS.entriesPerDay) return { result: 'tooMany', id: null };
  const entry = toEntry(newMedicationId(), input);
  if (typeof entry === 'string') return { result: entry, id: null };
  return { result: (await write(date, [...list, entry])) ? 'saved' : 'failed', id: entry.id };
}

export async function updateMedication(date: string, id: string, input: MedicationInput): Promise<MedicationResult> {
  const problem = checkDate(date);
  if (problem) return problem;
  const list = getMedications(date);
  const index = list.findIndex((e) => e.id === id);
  if (index < 0) return 'notFound';
  const entry = toEntry(id, input);
  if (typeof entry === 'string') return entry;
  if (JSON.stringify(list[index]) === JSON.stringify(entry)) return 'unchanged';
  return (await write(date, list.map((e) => (e.id === id ? entry : e)))) ? 'saved' : 'failed';
}

export async function deleteMedication(date: string, id: string): Promise<MedicationResult> {
  if (!isValidDateKey(date)) return 'invalid';
  const list = getMedications(date);
  if (!list.some((e) => e.id === id)) return 'notFound';
  return (await write(date, list.filter((e) => e.id !== id))) ? 'saved' : 'failed';
}

export async function clearMedications(date: string): Promise<MedicationResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (getMedications(date).length === 0) return 'unchanged';
  return (await write(date, [])) ? 'saved' : 'failed';
}

/** For optional future Insights: each medication with days and entries recorded. */
export function getMedicationFrequency(from?: string, to?: string) {
  return medicationFrequency(getVivaState().dailyLogs, from, to);
}
