// VIVA Cycle - Flow / Spotting data (pure: no React, no storage)
//
// Flow describes bleeding INTENSITY on a day. It never decides period days, day numbers or
// period length: those come only from the `period` field (lib/periodTracking.ts).
// Spotting is never a period day unless she marks that day as a period herself.

import { addDays } from './cycleEngine';
import type { DailyTrackingRecord, FlowValue } from './dailyTracking';
import { cycleStartEpisodes, episodesFromLogs } from './periodTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'flow' | 'period'>>;

export type FlowCounts = Record<FlowValue, number>;

function emptyCounts(): FlowCounts {
  return { none: 0, spotting: 0, light: 0, medium: 0, heavy: 0 };
}

/** Every recorded flow value by date (untracked days are absent). */
export function flowByDate(logs: Logs): Record<string, FlowValue> {
  const out: Record<string, FlowValue> = {};
  for (const d of Object.keys(logs).sort()) {
    const f = logs[d]?.flow;
    if (f) out[d] = f;
  }
  return out;
}

export function spottingDates(logs: Logs): string[] {
  return Object.keys(logs).filter((d) => logs[d]?.flow === 'spotting').sort();
}

/** Spotting on days she did NOT mark as a period day. */
export function spottingOutsidePeriod(logs: Logs): string[] {
  return spottingDates(logs).filter((d) => logs[d]?.period !== 'yes');
}

/** How many days of each flow level were recorded between from and to (inclusive, both optional). */
export function flowCounts(logs: Logs, from?: string, to?: string): FlowCounts {
  const counts = emptyCounts();
  for (const d of Object.keys(logs)) {
    if ((from && d < from) || (to && d > to)) continue;
    const f = logs[d]?.flow;
    if (f && f in counts) counts[f]++;
  }
  return counts;
}

export type EpisodeFlow = {
  start: string;  // period start (first recorded bleeding day)
  end: string;    // last recorded bleeding day
  days: { date: string; flow: FlowValue | null }[];  // flow on each period day (null = not tracked)
};

/** Day-by-day flow across each recorded period episode, oldest first. */
export function periodFlowPatterns(logs: Logs): EpisodeFlow[] {
  return episodesFromLogs(logs).map((ep) => ({
    start: ep.start,
    end: ep.end,
    days: ep.dates.map((d) => ({ date: d, flow: logs[d]?.flow ?? null })),
  }));
}

export type CycleFlowSummary = {
  cycleStart: string;
  nextStart: string | null;  // null for the current cycle
  counts: FlowCounts;        // every flow day in the cycle, including spotting outside the period
};

/** Flow counts per cycle, oldest first - for comparing cycles later. */
export function cycleFlowSummaries(logs: Logs): CycleFlowSummary[] {
  const starts = cycleStartEpisodes(episodesFromLogs(logs)).map((e) => e.start);
  return starts.map((s, i) => {
    const next = starts[i + 1] ?? null;
    return { cycleStart: s, nextStart: next, counts: flowCounts(logs, s, next ? addDays(next, -1) : undefined) };
  });
}
