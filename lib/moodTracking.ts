// VIVA Cycle - Mood data for future Insights (pure: no React, no storage)
// Mood is one user-entered value per date. Nothing here interprets or scores it for her.

import type { DailyTrackingRecord, MoodValue } from './dailyTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'mood'>>;

/** Order for averages and trends later. Internal only - never shown as a "score". */
export const MOOD_SCALE: Record<MoodValue, number> = { very_low: 1, low: 2, okay: 3, good: 4, great: 5 };

export type MoodDistribution = Record<MoodValue, number>;

/** Every recorded mood by date (untracked days are absent). */
export function moodByDate(logs: Logs): Record<string, MoodValue> {
  const out: Record<string, MoodValue> = {};
  for (const d of Object.keys(logs).sort()) {
    const m = logs[d]?.mood;
    if (m) out[d] = m;
  }
  return out;
}

/** How many days each mood was recorded between from and to (inclusive, both optional). */
export function moodDistribution(logs: Logs, from?: string, to?: string): MoodDistribution {
  const out: MoodDistribution = { very_low: 0, low: 0, okay: 0, good: 0, great: 0 };
  for (const d of Object.keys(logs)) {
    if ((from && d < from) || (to && d > to)) continue;
    const m = logs[d]?.mood;
    if (m && m in out) out[m]++;
  }
  return out;
}
