// VIVA Cycle - Symptoms service
// The ONLY way screens change symptoms. Only the `symptoms` field of a day changes:
// period, flow and every other answer are never touched.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import { isKnownSymptom, normalizeSymptomIds, symptomFrequency } from './symptoms';
import { getVivaState, saveDailyLog } from './vivaStore';

export type SymptomResult =
  | 'saved'      // written to the phone
  | 'unchanged'  // same as what is saved
  | 'future'     // symptoms can only be recorded for today or earlier
  | 'invalid'    // not a real date, or an unknown symptom ID
  | 'failed';    // the phone could not save

export function getSymptoms(date: string): string[] | null {
  return getVivaState().dailyLogs[date]?.symptoms ?? null;
}

/** Save the selected symptom IDs for one day. An empty selection (or null) = not tracked. */
export async function saveSymptoms(date: string, ids: string[] | null): Promise<SymptomResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (date > getToday()) return 'future';
  let next: string[] | null = null;
  if (ids && ids.length > 0) {
    if (!ids.every(isKnownSymptom)) return 'invalid';
    next = normalizeSymptomIds(ids);
  }
  if (JSON.stringify(getSymptoms(date)) === JSON.stringify(next)) return 'unchanged';
  return (await saveDailyLog(date, { symptoms: next })) ? 'saved' : 'failed';
}

export function clearSymptoms(date: string): Promise<SymptomResult> {
  return saveSymptoms(date, null);
}

/** For Insights (data only): days each symptom was recorded. */
export function getSymptomFrequency(from?: string, to?: string): Record<string, number> {
  return symptomFrequency(getVivaState().dailyLogs, from, to);
}
