// VIVA Cycle - Energy data for future Insights (pure: no React, no storage)
// Energy is a user-entered 0-100 number per date. Nothing here interprets it medically.

import type { DailyTrackingRecord } from './dailyTracking';
import { ENERGY_LEVELS, energyLabel } from './dailyTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'energy'>>;

function inRange(d: string, from?: string, to?: string): boolean {
  return !(from && d < from) && !(to && d > to);
}

/** Every recorded energy value by date (untracked days are absent). */
export function energyByDate(logs: Logs, from?: string, to?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of Object.keys(logs).sort()) {
    const e = logs[d]?.energy;
    if (typeof e === 'number' && inRange(d, from, to)) out[d] = e;
  }
  return out;
}

export type EnergyStats = {
  count: number;
  average: number | null;
  highest: number | null;
  highestDate: string | null;
  lowest: number | null;
  lowestDate: string | null;
};

export function energyStats(logs: Logs, from?: string, to?: string): EnergyStats {
  const entries = Object.entries(energyByDate(logs, from, to));
  if (entries.length === 0) {
    return { count: 0, average: null, highest: null, highestDate: null, lowest: null, lowestDate: null };
  }
  let hi = entries[0];
  let lo = entries[0];
  let sum = 0;
  for (const e of entries) {
    sum += e[1];
    if (e[1] > hi[1]) hi = e;
    if (e[1] < lo[1]) lo = e;
  }
  return {
    count: entries.length,
    average: Math.round((sum / entries.length) * 10) / 10,
    highest: hi[1],
    highestDate: hi[0],
    lowest: lo[1],
    lowestDate: lo[0],
  };
}

/** How many days fell in each level ("Very low" ... "Very high"). */
export function energyLevelCounts(logs: Logs, from?: string, to?: string): Record<string, number> {
  const out: Record<string, number> = {};
  ENERGY_LEVELS.forEach((l) => {
    out[l] = 0;
  });
  for (const v of Object.values(energyByDate(logs, from, to))) out[energyLabel(v)]++;
  return out;
}
