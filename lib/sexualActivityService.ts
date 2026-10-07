// VIVA Cycle - Sexual activity service (private)
// The ONLY way screens change this entry. Only `sexualActivity` changes: nothing else on
// the day is touched, and nothing is inferred from it. Values are never logged.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import {
  ProtectionStatus, SexualActivity, SexualActivityStatus,
  buildSexualActivity, isActivityStatus, isProtection, sexualActivityCounts, sexualActivityDates,
} from './sexualActivity';
import { getVivaState, saveDailyLog } from './vivaStore';

export type SexualActivityResult =
  | 'saved'      // written to the phone
  | 'unchanged'  // same as what is saved
  | 'future'     // can only be recorded for today or earlier
  | 'invalid'    // not a real date or not a known value
  | 'failed';    // the phone could not save

export function getSexualActivity(date: string): SexualActivity | null {
  return getVivaState().dailyLogs[date]?.sexualActivity ?? null;
}

/** Save (or clear, with status null) one day's entry. Protection is optional and kept only with activity. */
export async function saveSexualActivity(
  date: string, status: SexualActivityStatus | null, protection: ProtectionStatus | null = null
): Promise<SexualActivityResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (status !== null && !isActivityStatus(status)) return 'invalid';
  if (protection !== null && !isProtection(protection)) return 'invalid';
  if (date > getToday()) return 'future';
  const current = getSexualActivity(date);
  const next = buildSexualActivity(status, status === 'activity' ? protection : null, current);
  if (JSON.stringify(current) === JSON.stringify(next)) return 'unchanged';
  return (await saveDailyLog(date, { sexualActivity: next })) ? 'saved' : 'failed';
}

// ---------- Data for optional future Insights (no conclusions) ----------

export function getSexualActivityDates(from?: string, to?: string): string[] {
  return sexualActivityDates(getVivaState().dailyLogs, from, to);
}

export function getSexualActivityCounts(from?: string, to?: string) {
  return sexualActivityCounts(getVivaState().dailyLogs, from, to);
}
