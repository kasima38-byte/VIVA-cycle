// VIVA Cycle - Cervical mucus data for the calendar and future Insights (pure)
// Structured observations only. No conclusions are calculated here.

import { addDays } from './cycleEngine';
import type { MucusValue } from './cervicalMucus';
import type { DailyTrackingRecord } from './dailyTracking';
import { cycleStartEpisodes, episodesFromLogs } from './periodTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'cervicalMucus' | 'period'>>;

export type MucusCounts = Record<MucusValue, number>;

function inRange(d: string, from?: string, to?: string): boolean {
  return !(from && d < from) && !(to && d > to);
}

/** Every recorded observation by date (untracked days are absent). */
export function mucusByDate(logs: Logs, from?: string, to?: string): Record<string, MucusValue> {
  const out: Record<string, MucusValue> = {};
  for (const d of Object.keys(logs).sort()) {
    const m = logs[d]?.cervicalMucus;
    if (m && inRange(d, from, to)) out[d] = m;
  }
  return out;
}

/** Observations in date order - for pattern analysis later. */
export function mucusSequence(logs: Logs, from?: string, to?: string): { date: string; value: MucusValue }[] {
  return Object.entries(mucusByDate(logs, from, to)).map(([date, value]) => ({ date, value }));
}

export function mucusCounts(logs: Logs, from?: string, to?: string): MucusCounts {
  const out: MucusCounts = { dry: 0, sticky: 0, creamy: 0, watery: 0, egg_white: 0, other: 0 };
  for (const v of Object.values(mucusByDate(logs, from, to))) out[v]++;
  return out;
}

export type CycleMucusSummary = {
  cycleStart: string;
  nextStart: string | null;  // null for the current cycle
  sequence: { date: string; value: MucusValue }[];
  counts: MucusCounts;
};

/** Observations per cycle, oldest first - for comparing cycles later. */
export function cycleMucusSummaries(logs: Logs): CycleMucusSummary[] {
  const starts = cycleStartEpisodes(episodesFromLogs(logs)).map((e) => e.start);
  return starts.map((s, i) => {
    const next = starts[i + 1] ?? null;
    const to = next ? addDays(next, -1) : undefined;
    return { cycleStart: s, nextStart: next, sequence: mucusSequence(logs, s, to), counts: mucusCounts(logs, s, to) };
  });
}
