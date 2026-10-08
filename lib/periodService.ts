// VIVA Cycle - Period service
// The ONLY way screens record or change bleeding days.
//   UI -> this file -> lib/vivaStore.ts (the `period` field of each day's record)
// Episodes, day numbers, cycle starts and lengths are calculated in lib/periodTracking.ts.
// Only the `period` field is ever changed here: mood, energy, symptoms etc. are untouched.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import {
  PeriodChanges, PeriodDayInfo, PeriodEpisode, PeriodLengthEntry, PeriodLengthStats,
  bleedingDates, episodesFromLogs, periodInfoOn, periodLengthHistory, periodLengthStats, rangeDates,
} from './periodTracking';
import { applyPeriodChanges, getVivaState } from './vivaStore';

export type PeriodResult =
  | 'saved'      // written to the phone
  | 'unchanged'  // nothing to change
  | 'future'     // bleeding can only be recorded for today or earlier
  | 'invalid'    // not a real date, or end before start
  | 'tooLong'    // range longer than MAX_PERIOD_RANGE_DAYS
  | 'lastOne'    // would remove her only recorded period (edit its dates instead)
  | 'failed';    // the phone could not save

export const MAX_PERIOD_RANGE_DAYS = 15;

export function getPeriodInfo(date: string): PeriodDayInfo {
  return periodInfoOn(getVivaState().dailyLogs, date);
}

export function getPeriodEpisodes(): PeriodEpisode[] {
  return episodesFromLogs(getVivaState().dailyLogs);
}

/** For Insights: recorded period lengths (bleeding days), oldest first. */
export function getPeriodLengthHistory(): PeriodLengthEntry[] {
  return periodLengthHistory(getVivaState().dailyLogs);
}

/** For Insights: average / shortest / longest / recent recorded period length. */
export function getPeriodLengthStats(): PeriodLengthStats {
  return periodLengthStats(getPeriodLengthHistory());
}

async function apply(changes: PeriodChanges): Promise<PeriodResult> {
  const logs = getVivaState().dailyLogs;
  const effective: PeriodChanges = {};
  for (const [d, v] of Object.entries(changes)) {
    if ((logs[d]?.period ?? null) !== v) effective[d] = v;
  }
  if (Object.keys(effective).length === 0) return 'unchanged';

  // Same rule as Period History: her only recorded period can't be removed
  const after = new Set(bleedingDates(logs));
  for (const [d, v] of Object.entries(effective)) {
    if (v === 'yes') after.add(d);
    else after.delete(d);
  }
  if (after.size === 0) return 'lastOne';

  return (await applyPeriodChanges(effective)) ? 'saved' : 'failed';
}

/** Mark one day as a bleeding day. */
export async function markPeriodDay(date: string): Promise<PeriodResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (date > getToday()) return 'future';
  return apply({ [date]: 'yes' });
}

/** Undo a period answer for one day: it becomes UNTRACKED (never "no period"). */
export async function removePeriodDay(date: string): Promise<PeriodResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (getPeriodInfo(date).status === 'untracked') return 'unchanged';
  return apply({ [date]: null });
}

/** Record start..end as bleeding days.
 *  With `replacing` (any date inside an existing episode), that episode is replaced:
 *  its days outside the new range become untracked, so no stale period days remain. */
export async function savePeriodRange(start: string, end: string, replacing?: string): Promise<PeriodResult> {
  if (!isValidDateKey(start) || !isValidDateKey(end) || end < start) return 'invalid';
  if (end > getToday()) return 'future';
  const days = rangeDates(start, end);
  if (days.length > MAX_PERIOD_RANGE_DAYS) return 'tooLong';

  const changes: PeriodChanges = {};
  if (replacing) {
    getPeriodInfo(replacing).episode?.dates.forEach((d) => {
      changes[d] = null;
    });
  }
  days.forEach((d) => {
    changes[d] = 'yes';
  });
  return apply(changes);
}

/** Calendar tap: a recorded bleeding day is removed; any other day becomes a bleeding day.
 *  Uses the same rules as everywhere else (no future days, her only period can't be removed).
 *  recordedDays = bleeding days now recorded in that period (after adding), for the confirmation. */
export async function togglePeriodDay(
  date: string
): Promise<{ result: PeriodResult; action: 'added' | 'removed'; recordedDays: number | null }> {
  const wasBleeding = getPeriodInfo(date).status === 'period';
  const result = wasBleeding ? await removePeriodDay(date) : await markPeriodDay(date);
  const after = getPeriodInfo(date);
  return { result, action: wasBleeding ? 'removed' : 'added', recordedDays: after.episode?.recordedDays ?? null };
}
