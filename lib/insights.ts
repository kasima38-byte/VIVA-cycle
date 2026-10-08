// VIVA Cycle - Insights calculations (pure: no React, no storage)
//
//   RECORDED DATA -> VALIDATION -> CALCULATION -> DATA SUFFICIENCY CHECK -> NEUTRAL INSIGHT
//
// Untracked days are never counted as zero or as "none". Percentages use recorded days only.
// Every section reports how much data it is based on. This layer describes what she recorded -
// it does not draw conclusions about her body.

import { addDays, diffDays, isPlausibleCycleLength } from './cycleEngine';
import type { MucusValue } from './cervicalMucus';
import { DailyTrackingRecord, FlowValue, MOOD_OPTIONS, MoodValue, energyLabel, labelOf } from './dailyTracking';
import { MOOD_SCALE } from './moodTracking';
import { MIN_RECORDED_FOR_STATS, cycleStartEpisodes, episodesFromLogs } from './periodTracking';
import { normalizeSymptomIds } from './symptoms';
import { buildPeriodRecords } from './periodLength';

// ---------- Central thresholds (adjust here only) ----------

export const INSIGHT_THRESHOLDS = {
  minObservations: 3,      // recorded days before an average or ranking counts as "sufficient"
  cyclesForSufficient: 3,  // completed cycles before cycle averages count as "sufficient"
  trendMinPoints: 3,       // values needed before describing a direction
  trendChange: 0.05,       // a 5% difference between the earlier and later half counts as a direction
  maxSeriesDays: 3700,     // longest daily series returned (about 10 years)
};

export type DataStatus = 'insufficient' | 'limited' | 'sufficient';

export function statusFor(count: number, sufficientAt: number = INSIGHT_THRESHOLDS.minObservations): DataStatus {
  if (count <= 0) return 'insufficient';
  return count >= sufficientAt ? 'sufficient' : 'limited';
}

/** "Based on 6 recorded mood days" */
export function basisText(n: number, singular: string, pluralForm: string = singular + 's'): string {
  return 'Based on ' + n + ' ' + (n === 1 ? singular : pluralForm);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** "28.5 days" / "1 day" / "Not enough data" */
export function daysText(n: number | null): string {
  if (n === null) return 'Not enough data';
  return n + (n === 1 ? ' day' : ' days');
}

// ---------- Cycle history ----------

export type CycleCompleteness = 'complete' | 'in_progress' | 'uncertain';

export type CycleSummary = {
  id: string;
  startDate: string;
  endDate: string | null;        // day before the next period start; null while in progress
  cycleLength: number | null;    // start to next start - only for complete cycles
  recordedPeriodDays: number;    // bleeding days recorded in the period that starts this cycle
  periodLength: number | null;   // only when that period is finished and has >= 2 recorded days
  periodLabel: string;           // "4 bleeding days recorded"
  completeness: CycleCompleteness;
};

type Logs = Record<string, DailyTrackingRecord>;

/** Every cycle from the recorded bleeding days, oldest first.
 *  "uncertain" = longer than the engine's plausible limit (most likely a missed log). */
export function buildCycleHistory(logs: Logs, today: string): CycleSummary[] {
  const starts = cycleStartEpisodes(episodesFromLogs(logs));
  // Period length comes from the ONE calculation path (lib/periodLength.ts)
  const periods = buildPeriodRecords(logs, today);
  return starts.map((ep, i) => {
    const next = starts[i + 1];
    const length = next ? diffDays(next.start, ep.start) : null;
    const completeness: CycleCompleteness =
      length === null ? 'in_progress' : isPlausibleCycleLength(length) ? 'complete' : 'uncertain';
    return {
      id: 'cycle_' + ep.start,
      startDate: ep.start,
      endDate: next ? addDays(next.start, -1) : null,
      cycleLength: completeness === 'complete' ? length : null,
      recordedPeriodDays: ep.recordedDays,
      periodLength: periods[i] && periods[i].countsForAverage ? periods[i].periodLength : null,
      periodLabel: ep.recordedDays === 1 ? '1 bleeding day recorded' : ep.recordedDays + ' bleeding days recorded',
      completeness,
    };
  });
}

// ---------- Ranges ----------

export type InsightRangeKey = 'current_cycle' | 'previous_cycle' | 'last_3_cycles' | 'last_6_cycles' | 'last_12_months';

export const INSIGHT_RANGES: { key: InsightRangeKey; label: string }[] = [
  { key: 'current_cycle', label: 'Current cycle' },
  { key: 'previous_cycle', label: 'Previous cycle' },
  { key: 'last_3_cycles', label: 'Last 3 cycles' },
  { key: 'last_6_cycles', label: 'Last 6 cycles' },
  { key: 'last_12_months', label: 'Last 12 months' },
];

export type ResolvedRange = { key: InsightRangeKey; start: string | null; end: string | null; cycles: CycleSummary[] };

/** Turn a range choice into dates. "Last N cycles" = the N most recent finished cycles. */
export function resolveRange(key: InsightRangeKey, history: CycleSummary[], today: string): ResolvedRange {
  const none: ResolvedRange = { key, start: null, end: null, cycles: [] };
  const current = history[history.length - 1];
  const finished = history.filter((c) => c.endDate !== null);
  switch (key) {
    case 'current_cycle':
      return current && current.endDate === null ? { key, start: current.startDate, end: today, cycles: [current] } : none;
    case 'previous_cycle': {
      const p = finished[finished.length - 1];
      return p ? { key, start: p.startDate, end: p.endDate, cycles: [p] } : none;
    }
    case 'last_3_cycles':
    case 'last_6_cycles': {
      const list = finished.slice(key === 'last_3_cycles' ? -3 : -6);
      return list.length > 0 ? { key, start: list[0].startDate, end: list[list.length - 1].endDate, cycles: list } : none;
    }
    case 'last_12_months': {
      const start = addDays(today, -364);
      return { key, start, end: today, cycles: history.filter((c) => c.startDate >= start && c.startDate <= today) };
    }
  }
}

// ---------- Trends (neutral wording only) ----------

export type Trend = 'increasing' | 'decreasing' | 'stable' | 'insufficient';

export function trendOf(values: number[]): Trend {
  const T = INSIGHT_THRESHOLDS;
  if (values.length < T.trendMinPoints) return 'insufficient';
  const half = Math.floor(values.length / 2);
  const earlier = mean(values.slice(0, half));
  const later = mean(values.slice(values.length - half));
  if (earlier === 0) return later === 0 ? 'stable' : 'increasing';
  const change = (later - earlier) / Math.abs(earlier);
  if (change > T.trendChange) return 'increasing';
  if (change < -T.trendChange) return 'decreasing';
  return 'stable';
}

/** "Your recorded energy has increased over these cycles." - or null when there isn't enough data. */
export function trendText(what: string, trend: Trend): string | null {
  if (trend === 'increasing') return 'Your recorded ' + what + ' has increased over these cycles.';
  if (trend === 'decreasing') return 'Your recorded ' + what + ' has decreased over these cycles.';
  if (trend === 'stable') return 'Your recorded ' + what + ' has stayed about the same over these cycles.';
  return null;
}

// ---------- Daily series for charts (missing days stay null - never 0) ----------

export function dailySeries<T>(
  records: DailyTrackingRecord[], start: string, end: string, pick: (r: DailyTrackingRecord) => T | null
): { date: string; value: T | null }[] {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const out: { date: string; value: T | null }[] = [];
  for (let d = start, n = 0; d <= end && n < INSIGHT_THRESHOLDS.maxSeriesDays; d = addDays(d, 1), n++) {
    const r = byDate.get(d);
    out.push({ date: d, value: r ? pick(r) : null });
  }
  return out;
}

// ---------- All insights for one range ----------

export type BleedingLevel = 'spotting' | 'light' | 'medium' | 'heavy';
const BLEEDING_LEVELS: BleedingLevel[] = ['spotting', 'light', 'medium', 'heavy'];
const MOOD_ORDER: MoodValue[] = MOOD_OPTIONS.map((o) => o.value);

export const EMPTY_INSIGHTS_MESSAGE = 'Your insights will appear here as you track your cycle.';

export type Insights = {
  range: { key: InsightRangeKey | null; start: string | null; end: string | null };
  isEmpty: boolean;
  emptyMessage: string | null;
  trackedDays: number;
  cycles: {
    status: DataStatus;
    basis: string;
    history: CycleSummary[];
    completedCycles: number;
    averageCycleLength: number | null;
    averageCycleLengthText: string;
    shortestCycle: number | null;
    longestCycle: number | null;
    periodsMeasured: number;
    averagePeriodLength: number | null;
    averagePeriodLengthText: string;
    recordedPeriodDays: number; // bleeding days recorded inside the range
  };
  flow: {
    status: DataStatus;
    basis: string;
    recordedDays: number;
    counts: Record<FlowValue, number>;
    distribution: Record<BleedingLevel, number> | null; // % of recorded bleeding observations
  };
  symptoms: { status: DataStatus; basis: string; recordedDays: number; ranking: { id: string; days: number }[] };
  mood: {
    status: DataStatus;
    basis: string;
    recordedDays: number;
    distribution: Record<MoodValue, number>;
    average: MoodValue | null;
    averageText: string;
  };
  energy: {
    status: DataStatus;
    basis: string;
    recordedDays: number;
    average: number | null;
    averageLabel: string | null;
    highest: number | null;
    lowest: number | null;
  };
  cervicalMucus: { status: DataStatus; basis: string; recordedDays: number; counts: Record<MucusValue, number> };
  sexualActivity: { status: DataStatus; basis: string; recordedDays: number; activityDays: number; noActivityDays: number };
  medications: {
    status: DataStatus;
    basis: string;
    entries: number;
    daysWithRecords: number;
    mostRecorded: { name: string; days: number; entries: number }[];
  };
  trends: { cycleLength: Trend; periodLength: Trend; energy: Trend };
};

export function computeInsights(
  records: DailyTrackingRecord[],
  cycles: CycleSummary[],
  start: string | null,
  end: string | null,
  key: InsightRangeKey | null = null
): Insights {
  const T = INSIGHT_THRESHOLDS;

  // Cycles and periods
  const complete = cycles.filter((c) => c.completeness === 'complete');
  const lengths = complete.map((c) => c.cycleLength as number);
  const periods = cycles.filter((c) => c.periodLength !== null).map((c) => c.periodLength as number);
  const avgCycle = lengths.length > 0 ? round1(mean(lengths)) : null;
  const avgPeriod = periods.length > 0 ? round1(mean(periods)) : null;

  // Flow
  const flowCounts: Record<FlowValue, number> = { none: 0, spotting: 0, light: 0, medium: 0, heavy: 0 };
  let flowDays = 0;
  for (const r of records) {
    if (r.flow) {
      flowCounts[r.flow]++;
      flowDays++;
    }
  }
  const bleedingObs = BLEEDING_LEVELS.reduce((n, l) => n + flowCounts[l], 0);
  const distribution =
    bleedingObs > 0
      ? (Object.fromEntries(BLEEDING_LEVELS.map((l) => [l, round1((flowCounts[l] / bleedingObs) * 100)])) as Record<BleedingLevel, number>)
      : null;

  // Symptoms (ranking ties keep the library order)
  const symptomDays = new Map<string, number>();
  let symptomRecordedDays = 0;
  for (const r of records) {
    if (r.symptoms === null) continue;
    symptomRecordedDays++;
    for (const id of r.symptoms) symptomDays.set(id, (symptomDays.get(id) ?? 0) + 1);
  }
  const ranking = normalizeSymptomIds(Array.from(symptomDays.keys()))
    .map((id) => ({ id, days: symptomDays.get(id) ?? 0 }))
    .sort((a, b) => b.days - a.days);

  // Mood
  const moodDist: Record<MoodValue, number> = { very_low: 0, low: 0, okay: 0, good: 0, great: 0 };
  const moodScores: number[] = [];
  for (const r of records) {
    if (r.mood) {
      moodDist[r.mood]++;
      moodScores.push(MOOD_SCALE[r.mood]);
    }
  }
  const moodAverage =
    moodScores.length >= T.minObservations
      ? MOOD_ORDER[Math.min(5, Math.max(1, Math.round(mean(moodScores)))) - 1]
      : null;

  // Energy
  const energies = records.filter((r) => typeof r.energy === 'number').map((r) => r.energy as number);
  const energyAvg = energies.length >= T.minObservations ? Math.round(mean(energies)) : null;

  // Cervical mucus
  const mucusCounts: Record<MucusValue, number> = { dry: 0, sticky: 0, creamy: 0, watery: 0, egg_white: 0, other: 0 };
  let mucusDays = 0;
  for (const r of records) {
    if (r.cervicalMucus) {
      mucusCounts[r.cervicalMucus]++;
      mucusDays++;
    }
  }

  // Sexual activity (counts only)
  let activityDays = 0;
  let noActivityDays = 0;
  for (const r of records) {
    if (r.sexualActivity?.status === 'activity') activityDays++;
    else if (r.sexualActivity?.status === 'none') noActivityDays++;
  }

  // Medications (counts only - never why)
  const medMap = new Map<string, { name: string; days: number; entries: number }>();
  let medEntries = 0;
  let medDays = 0;
  for (const r of records) {
    if (!r.medications || r.medications.length === 0) continue;
    medDays++;
    const seenToday = new Set<string>();
    for (const m of r.medications) {
      medEntries++;
      const k = m.name.toLowerCase();
      const row = medMap.get(k) ?? { name: m.name, days: 0, entries: 0 };
      row.entries++;
      if (!seenToday.has(k)) {
        row.days++;
        seenToday.add(k);
      }
      medMap.set(k, row);
    }
  }
  const mostRecorded = Array.from(medMap.values()).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));

  // Per-cycle energy for the trend (missing days are simply not counted)
  const energyByCycle: number[] = [];
  for (const c of cycles) {
    const to = c.endDate ?? end ?? c.startDate;
    const vals = records
      .filter((r) => r.date >= c.startDate && r.date <= to && typeof r.energy === 'number')
      .map((r) => r.energy as number);
    if (vals.length > 0) energyByCycle.push(mean(vals));
  }

  const trackedDays = records.length;
  const isEmpty = trackedDays === 0 && cycles.length === 0;

  return {
    range: { key, start, end },
    isEmpty,
    emptyMessage: isEmpty ? EMPTY_INSIGHTS_MESSAGE : null,
    trackedDays,
    cycles: {
      status: statusFor(complete.length, T.cyclesForSufficient),
      basis: basisText(complete.length, 'completed cycle'),
      history: cycles,
      completedCycles: complete.length,
      averageCycleLength: avgCycle,
      averageCycleLengthText: daysText(avgCycle),
      shortestCycle: lengths.length > 0 ? Math.min(...lengths) : null,
      longestCycle: lengths.length > 0 ? Math.max(...lengths) : null,
      periodsMeasured: periods.length,
      averagePeriodLength: avgPeriod,
      averagePeriodLengthText: daysText(avgPeriod),
      recordedPeriodDays: records.filter((r) => r.period === 'yes').length,
    },
    flow: {
      status: statusFor(flowDays),
      basis: basisText(flowDays, 'recorded flow observation'),
      recordedDays: flowDays,
      counts: flowCounts,
      distribution,
    },
    symptoms: {
      status: statusFor(symptomRecordedDays),
      basis: basisText(symptomRecordedDays, 'day with symptoms recorded', 'days with symptoms recorded'),
      recordedDays: symptomRecordedDays,
      ranking,
    },
    mood: {
      status: statusFor(moodScores.length),
      basis: basisText(moodScores.length, 'recorded mood day'),
      recordedDays: moodScores.length,
      distribution: moodDist,
      average: moodAverage,
      averageText: moodAverage
        ? 'Your average recorded mood was ' + labelOf(MOOD_OPTIONS, moodAverage) + '.'
        : 'Not enough mood data yet.',
    },
    energy: {
      status: statusFor(energies.length),
      basis: basisText(energies.length, 'recorded energy day'),
      recordedDays: energies.length,
      average: energyAvg,
      averageLabel: energyAvg === null ? null : energyLabel(energyAvg),
      highest: energies.length > 0 ? Math.max(...energies) : null,
      lowest: energies.length > 0 ? Math.min(...energies) : null,
    },
    cervicalMucus: {
      status: statusFor(mucusDays),
      basis: basisText(mucusDays, 'recorded observation'),
      recordedDays: mucusDays,
      counts: mucusCounts,
    },
    sexualActivity: {
      status: statusFor(activityDays + noActivityDays),
      basis: basisText(activityDays + noActivityDays, 'recorded day'),
      recordedDays: activityDays + noActivityDays,
      activityDays,
      noActivityDays,
    },
    medications: {
      status: statusFor(medEntries),
      basis: basisText(medEntries, 'medication entry', 'medication entries'),
      entries: medEntries,
      daysWithRecords: medDays,
      mostRecorded,
    },
    trends: {
      cycleLength: trendOf(lengths),
      periodLength: trendOf(periods),
      energy: trendOf(energyByCycle),
    },
  };
}
