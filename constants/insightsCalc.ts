import { CycleRecord } from './insightsData';

export type RangeKey = 'cycle' | '3m' | '6m' | '12m';

export const CYCLE_RANGE = { min: 21, max: 35 };
export const PERIOD_RANGE = { min: 2, max: 7 };

// How many cycles each range looks at.
// "This Cycle" still shows the last 6 in the charts so bars have context.
export function selectRecords(all: CycleRecord[], range: RangeKey): CycleRecord[] {
  const count = range === '3m' ? 3 : range === '6m' ? 6 : range === '12m' ? 12 : 6;
  return all.slice(-count);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function formatAverage(value: number | null): string {
  if (value === null) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function isWithin(value: number | null, range: { min: number; max: number }): boolean {
  return value !== null && value >= range.min && value <= range.max;
}

export function calculateVariation(records: CycleRecord[]): number | null {
  if (records.length < 2) return null;
  const lengths = records.map((r) => r.cycleLength);
  const avg = average(lengths) as number;
  return Math.round(Math.max(...lengths.map((l) => Math.abs(l - avg))));
}

export function calculateCycleRegularity(records: CycleRecord[]): {
  label: string;
  variation: number | null;
} {
  const variation = calculateVariation(records);
  if (variation === null) return { label: 'Not enough data', variation };
  if (variation <= 3) return { label: 'Regular', variation };
  if (variation <= 7) return { label: 'Somewhat irregular', variation };
  return { label: 'Irregular', variation };
}

export function calculateCommonSymptoms(records: CycleRecord[], top = 3): string[] {
  const counts: Record<string, number> = {};
  records.forEach((r) =>
    r.symptoms.forEach((s) => {
      counts[s] = (counts[s] || 0) + 1;
    })
  );
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1));
}

const MOOD_SCORE: Record<string, number> = { veryLow: 1, low: 2, okay: 3, good: 4, great: 5 };

export function calculateMoodPattern(records: CycleRecord[]): string {
  const scores = records.flatMap((r) => r.moods.map((m) => MOOD_SCORE[m] ?? 3));
  if (scores.length < 3) return 'Not enough data';
  const avg = average(scores) as number;
  if (avg >= 3.7) return 'Mostly positive';
  if (avg <= 2.3) return 'Mostly low';
  return 'Mixed';
}

export function calculateTypicalFertileWindow(records: CycleRecord[]): string {
  const avg = average(records.map((r) => r.fertileWindowLength));
  if (avg === null) return 'Not enough data';
  return `Typically ${Math.round(avg)} days`;
}

export function generatePersonalInsight(records: CycleRecord[]): string | null {
  if (records.length < 3) return null;
  const { label } = calculateCycleRegularity(records);
  if (label !== 'Regular') return null;
  return `Your cycles have been consistent for the last ${records.length} months. This can help you plan ahead with more confidence.`;
}