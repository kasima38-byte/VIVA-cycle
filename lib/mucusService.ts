// VIVA Cycle - Cervical mucus service
// The ONLY way screens change the observation. Only cervicalMucus (and its optional note)
// change: period, flow, symptoms, mood, energy and the rest are never touched.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import { isMucusValue, normalizeMucusNote } from './cervicalMucus';
import type { MucusValue } from './cervicalMucus';
import {
  CycleMucusSummary, MucusCounts, cycleMucusSummaries, mucusCounts, mucusSequence,
} from './mucusTracking';
import { getVivaState, saveDailyLog } from './vivaStore';

export type MucusResult =
  | 'saved'      // written to the phone
  | 'unchanged'  // same as what is saved
  | 'future'     // observations can only be recorded for today or earlier
  | 'invalid'    // not a real date or not a known observation
  | 'failed';    // the phone could not save

export function getMucus(date: string): { value: MucusValue | null; note: string | null } {
  const rec = getVivaState().dailyLogs[date];
  return { value: rec?.cervicalMucus ?? null, note: rec?.cervicalMucusNote ?? null };
}

/** Save (or clear, with null) one day's observation. The note is kept only with "other". */
export async function saveMucus(date: string, value: MucusValue | null, note?: string | null): Promise<MucusResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (value !== null && !isMucusValue(value)) return 'invalid';
  if (date > getToday()) return 'future';
  const cleanNote = value === 'other' ? normalizeMucusNote(note) : null;
  const current = getMucus(date);
  if (current.value === value && current.note === cleanNote) return 'unchanged';
  return (await saveDailyLog(date, { cervicalMucus: value, cervicalMucusNote: cleanNote })) ? 'saved' : 'failed';
}

// ---------- Data for Insights (no conclusions) ----------

export function getMucusCounts(from?: string, to?: string): MucusCounts {
  return mucusCounts(getVivaState().dailyLogs, from, to);
}

export function getMucusSequence(from?: string, to?: string): { date: string; value: MucusValue }[] {
  return mucusSequence(getVivaState().dailyLogs, from, to);
}

export function getCycleMucusSummaries(): CycleMucusSummary[] {
  return cycleMucusSummaries(getVivaState().dailyLogs);
}
