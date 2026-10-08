// VIVA Cycle - Insights service
//
//   DailyTrackingService (the only source of truth) -> this file -> lib/insights.ts -> Insights UI
//
// Reads only the records in the requested range (month index from lib/dailyTrackingService.ts)
// and keeps no copy of the data. Results are cached per saved-data version: any saved change
// gives a new version, so a stale statistic is never shown.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import { getRecordsForDateRange } from './dailyTrackingService';
import {
  CycleSummary, InsightRangeKey, Insights, buildCycleHistory, computeInsights, dailySeries, resolveRange,
} from './insights';
import { getVivaState } from './vivaStore';

const cache = new WeakMap<object, Map<string, unknown>>();

function cached<T>(key: string, make: () => T): T {
  const logs = getVivaState().dailyLogs; // a new object after every saved change
  let m = cache.get(logs);
  if (!m) {
    m = new Map();
    cache.set(logs, m);
  }
  if (!m.has(key)) m.set(key, make());
  return m.get(key) as T;
}

/** Every cycle from recorded bleeding days, oldest first. */
export function getCycleHistory(): CycleSummary[] {
  const today = getToday();
  return cached('history:' + today, () => buildCycleHistory(getVivaState().dailyLogs, today));
}

/** Insights for any two dates (inclusive). Cycles = those starting inside the range. */
export function getInsights(start: string, end: string): Insights | null {
  if (!isValidDateKey(start) || !isValidDateKey(end) || end < start) return null;
  return cached('dates:' + start + ':' + end, () =>
    computeInsights(
      getRecordsForDateRange(start, end),
      getCycleHistory().filter((c) => c.startDate >= start && c.startDate <= end),
      start,
      end
    )
  );
}

/** Insights for a named range: current cycle, previous cycle, last 3 / 6 cycles, last 12 months. */
export function getInsightsForRange(key: InsightRangeKey, today: string = getToday()): Insights {
  return cached('range:' + key + ':' + today, () => {
    const r = resolveRange(key, getCycleHistory(), today);
    if (!r.start || !r.end) return computeInsights([], [], null, null, key);
    return computeInsights(getRecordsForDateRange(r.start, r.end), r.cycles, r.start, r.end, key);
  });
}

/** Energy per day for charts. Days without a recorded value are null - never 0. */
export function getEnergySeries(start: string, end: string): { date: string; value: number | null }[] {
  if (!isValidDateKey(start) || !isValidDateKey(end) || end < start) return [];
  return dailySeries(getRecordsForDateRange(start, end), start, end, (r) => r.energy);
}
