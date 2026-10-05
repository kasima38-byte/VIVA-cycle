import { PeriodEntry } from './cycleStore';

export type Confidence = 'none' | 'low' | 'moderate' | 'good';

export type FertilityStatus =
  | 'menstruation'
  | 'lowerFertility'
  | 'fertileApproaching'
  | 'potentiallyFertile'
  | 'ovulationLikely'
  | 'ovulationMayHavePassed'
  | 'postOvulatory'
  | 'periodExpectedSoon'
  | 'unknown';

export type CycleStats = {
  cycleLengths: number[];
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  spread: number | null;
  confidence: Confidence;
};

export type CycleEstimate = {
  stats: CycleStats;
  basis: 'history' | 'assumed';
  cycleStart: string | null;
  cycleDay: number | null;
  expectedCycleLength: number;
  nextPeriod: string | null;
  daysToNextPeriod: number | null;
  periodLateDays: number;
  ovulation: string | null;
  fertileWindow: { start: string; end: string } | null;
  uncertaintyDays: number;
  status: FertilityStatus;
};

export const DEFAULT_CYCLE_LENGTH = 28;
export const LUTEAL_PHASE_DAYS = 14;
export const FERTILE_DAYS_BEFORE_OVULATION = 5;
export const MIN_CYCLES_FOR_HISTORY = 3;

function toDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toKey(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

export function addDays(key: string, days: number): string {
  const d = toDate(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

export function computeCycleStats(periods: PeriodEntry[]): CycleStats {
  const starts = periods.map((p) => p.date).sort();
  const all: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = dayDiff(starts[i - 1], starts[i]);
    if (gap >= 15 && gap <= 60) all.push(gap);
  }
  const cycleLengths = all.slice(-6);
  const count = cycleLengths.length;

  if (count === 0) {
    return { cycleLengths, count, average: null, min: null, max: null, spread: null, confidence: 'none' };
  }

  const sum = cycleLengths.reduce((a, b) => a + b, 0);
  const average = sum / count;
  const min = Math.min(...cycleLengths);
  const max = Math.max(...cycleLengths);
  const spread = max - min;

  let confidence: Confidence;
  if (spread > 7 || count < 3) confidence = 'low';
  else if (count >= 4 && spread <= 4) confidence = 'good';
  else confidence = 'moderate';

  return { cycleLengths, count, average, min, max, spread, confidence };
}

export function estimateCycle(
  periods: PeriodEntry[],
  periodLength: number,
  todayKey: string,
  typicalCycleLength: number = DEFAULT_CYCLE_LENGTH
): CycleEstimate {
  const stats = computeCycleStats(periods);
  const starts = periods.map((p) => p.date).sort();

  const empty: CycleEstimate = {
    stats,
    basis: 'assumed',
    cycleStart: null,
    cycleDay: null,
    expectedCycleLength: DEFAULT_CYCLE_LENGTH,
    nextPeriod: null,
    daysToNextPeriod: null,
    periodLateDays: 0,
    ovulation: null,
    fertileWindow: null,
    uncertaintyDays: 4,
    status: 'unknown',
  };
  if (starts.length === 0) return empty;

  const onOrBefore = starts.filter((s) => s <= todayKey);
  const cycleStart = onOrBefore.length ? onOrBefore[onOrBefore.length - 1] : starts[starts.length - 1];

  const useHistory = stats.average !== null && stats.count >= MIN_CYCLES_FOR_HISTORY;
  const basis: 'history' | 'assumed' = useHistory ? 'history' : 'assumed';
  const expectedCycleLength = useHistory ? Math.round(stats.average as number) : typicalCycleLength;

  const nextPeriod = addDays(cycleStart, expectedCycleLength);
  const ovulation = addDays(nextPeriod, -LUTEAL_PHASE_DAYS);
  const fertileWindow = {
    start: addDays(ovulation, -FERTILE_DAYS_BEFORE_OVULATION),
    end: ovulation,
  };

  const cycleDay = dayDiff(cycleStart, todayKey) + 1;
  const daysToNextPeriod = dayDiff(todayKey, nextPeriod);
  const periodLateDays = daysToNextPeriod < 0 ? -daysToNextPeriod : 0;

  const uncertaintyDays = stats.spread === null ? 4 : Math.max(2, Math.ceil(stats.spread / 2));

  const toOvulation = dayDiff(todayKey, ovulation);
  const toWindowStart = dayDiff(todayKey, fertileWindow.start);

  let status: FertilityStatus;
  if (cycleDay >= 1 && cycleDay <= periodLength) status = 'menstruation';
  else if (daysToNextPeriod <= 3) status = 'periodExpectedSoon';
  else if (toOvulation === 0 || toOvulation === 1) status = 'ovulationLikely';
  else if (toOvulation >= 2 && toOvulation <= FERTILE_DAYS_BEFORE_OVULATION) status = 'potentiallyFertile';
  else if (toWindowStart > 0 && toWindowStart <= 3) status = 'fertileApproaching';
  else if (toOvulation === -1 || toOvulation === -2) status = 'ovulationMayHavePassed';
  else if (toOvulation < -2) status = 'postOvulatory';
  else status = 'lowerFertility';

  return {
    stats,
    basis,
    cycleStart,
    cycleDay,
    expectedCycleLength,
    nextPeriod,
    daysToNextPeriod,
    periodLateDays,
    ovulation,
    fertileWindow,
    uncertaintyDays,
    status,
  };
}