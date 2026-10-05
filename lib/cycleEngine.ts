// VIVA Cycle — cycle engine
// Pure TypeScript, no dependencies. Every screen reads estimates from here.
//
// CORE RULE: only user-confirmed data is ever stored (setup answers + period logs).
// Estimates are recalculated on demand and never saved, so a prediction can
// never turn into a confirmed event just because its date has passed.

// ---------- Types ----------

export type Regularity = 'regular' | 'somewhat_irregular' | 'irregular' | 'not_sure';
export type Goal = 'understand' | 'track' | 'conceive' | 'avoid';

/** Dates are always 'YYYY-MM-DD' strings to avoid timezone bugs. */
export type DateStr = string;

export interface CycleBaseline {
  cycleLength: number | null;   // null = "Not sure"
  periodLength: number | null;  // null = "Not sure"
  regularity: Regularity;
}

export interface UserSetup {
  name: string;
  baseline: CycleBaseline;
  goal: Goal;
}

/** A confirmed period. The setup "last period start" is saved as the first one. */
export interface PeriodLog {
  start: DateStr;
  end?: DateStr; // optional until the user marks the period as ended
}

export interface DateRange {
  start: DateStr;
  end: DateStr;
}

export type FertilityStatus =
  | 'menstruation'
  | 'lowerFertility'
  | 'fertileApproaching'
  | 'potentiallyFertile'
  | 'ovulationLikely'
  | 'ovulationMayHavePassed'
  | 'postOvulatory'
  | 'periodExpectedSoon';

/** One predicted cycle, for drawing the calendar. All values are ESTIMATES. */
export interface PredictedCycle {
  periodStart: DateStr;
  periodEnd: DateStr;
  ovulation: DateStr;
  fertileStart: DateStr;
  fertileEnd: DateStr;
}

export interface CycleEstimate {
  currentCycleStart: DateStr;
  currentCycleDay: number;
  cycleLengthUsed: number;
  periodLengthUsed: number;
  lengthSource: 'history' | 'baseline' | 'default';
  estimatedNextPeriod: DateStr;
  /** Predicted bleeding days: next period start → start + period length − 1 */
  estimatedPeriodWindow: DateRange;
  /** Uncertainty range for the next period START (± regularity margin) */
  nextPeriodRange: DateRange;
  daysToNextPeriod: number;   // negative when late
  estimatedOvulation: DateStr;
  estimatedFertileWindow: DateRange;
  isLate: boolean;   // past the estimated date with no new log
  daysLate: number;
  confidence: 'low' | 'medium' | 'high';
  status: FertilityStatus;
}

// ---------- Defaults & limits ----------

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;
export const LUTEAL_DAYS = 14;          // ovulation ≈ next period − 14
export const FERTILE_BEFORE = 5;        // sperm survival: window = ovulation − 5 … ovulation (6 days)
const MAX_HISTORY_CYCLES = 6;
const VALID_CYCLE = { min: 15, max: 90 };   // outside this = likely a missed/duplicate log
const VALID_PERIOD = { min: 1, max: 14 };

const MARGIN_BY_REGULARITY: Record<Regularity, number> = {
  regular: 2,
  somewhat_irregular: 4,
  not_sure: 5,
  irregular: 7,
};

// ---------- Date helpers ----------

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

function toUTC(d: DateStr): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}
function fromUTC(ms: number): DateStr {
  return new Date(ms).toISOString().slice(0, 10);
}
export function addDays(d: DateStr, n: number): DateStr {
  return fromUTC(toUTC(d) + n * DAY_MS);
}
/** a − b in whole days */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}
// Developer switch: set to e.g. '2026-10-10' to pretend today is that date
// (useful for testing late periods). Keep null for normal use.
const DEV_TODAY: DateStr | null = null;

/** Today in the phone's local time zone (or DEV_TODAY when testing) */
export function todayLocal(): DateStr {
  if (DEV_TODAY) return DEV_TODAY;
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// ---------- Setup validation ----------

export function validateSetup(
  setup: UserSetup,
  lastPeriodStart: DateStr,
  today: DateStr = todayLocal()
): string[] {
  const errors: string[] = [];
  if (!setup.name.trim()) errors.push('Please enter your name.');
  const ago = diffDays(today, lastPeriodStart);
  if (ago < 0) errors.push('Your last period start can’t be in the future.');
  if (ago > 120) errors.push('That date is over 4 months ago. Please check it, or choose the closest date you remember.');
  const { cycleLength, periodLength } = setup.baseline;
  if (cycleLength !== null && (cycleLength < VALID_CYCLE.min || cycleLength > VALID_CYCLE.max))
    errors.push(`Cycle length should be between ${VALID_CYCLE.min} and ${VALID_CYCLE.max} days.`);
  if (periodLength !== null && (periodLength < VALID_PERIOD.min || periodLength > VALID_PERIOD.max))
    errors.push(`Period length should be between ${VALID_PERIOD.min} and ${VALID_PERIOD.max} days.`);
  return errors;
}

// ---------- History (priority 2) ----------

function sortedStarts(logs: PeriodLog[], today: DateStr): DateStr[] {
  const unique = Array.from(new Set(logs.map(l => l.start)));
  return unique.filter(d => diffDays(today, d) >= 0).sort(); // ignore future-dated logs
}

function historyCycleLengths(starts: DateStr[]): number[] {
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i], starts[i - 1]);
    if (len >= VALID_CYCLE.min && len <= VALID_CYCLE.max) lengths.push(len);
  }
  return lengths.slice(-MAX_HISTORY_CYCLES);
}

function historyPeriodLengths(logs: PeriodLog[]): number[] {
  return logs
    .filter(l => l.end)
    .map(l => diffDays(l.end!, l.start) + 1)
    .filter(n => n >= VALID_PERIOD.min && n <= VALID_PERIOD.max)
    .slice(-MAX_HISTORY_CYCLES);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdDev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
};

// ---------- Main calculation ----------

/**
 * Data priority:
 *  1. Confirmed period logs  → decide the current cycle start (always)
 *  2. Historical cycle data  → cycle/period length once ≥2 full cycles exist
 *  3. Baseline settings      → fallback lengths
 *  4. Predictions            → OUTPUT only, never fed back in
 */
export function calculateCycle(
  baseline: CycleBaseline,
  logs: PeriodLog[],
  today: DateStr = todayLocal()
): CycleEstimate | null {
  const starts = sortedStarts(logs, today);
  if (starts.length === 0) return null; // setup not finished

  // 1. Current cycle = most recent CONFIRMED period start
  const currentCycleStart = starts[starts.length - 1];
  const currentCycleDay = diffDays(today, currentCycleStart) + 1;

  // 2/3. Cycle length
  const cycleHist = historyCycleLengths(starts);
  let cycleLengthUsed: number;
  let lengthSource: CycleEstimate['lengthSource'];
  let margin: number;

  if (cycleHist.length >= 2) {
    cycleLengthUsed = Math.round(mean(cycleHist));
    lengthSource = 'history';
    margin = Math.min(7, Math.max(1, Math.ceil(stdDev(cycleHist))));
  } else if (baseline.cycleLength !== null) {
    cycleLengthUsed = baseline.cycleLength;
    lengthSource = 'baseline';
    margin = MARGIN_BY_REGULARITY[baseline.regularity];
  } else {
    cycleLengthUsed = DEFAULT_CYCLE;
    lengthSource = 'default';
    margin = Math.max(5, MARGIN_BY_REGULARITY[baseline.regularity]);
  }

  // Period length
  const periodHist = historyPeriodLengths(logs);
  const periodLengthUsed =
    periodHist.length >= 2
      ? Math.round(mean(periodHist))
      : baseline.periodLength ?? DEFAULT_PERIOD;

  // 4. Predictions (output only)
  const estimatedNextPeriod = addDays(currentCycleStart, cycleLengthUsed);
  const estimatedPeriodWindow: DateRange = {
    start: estimatedNextPeriod,
    end: addDays(estimatedNextPeriod, periodLengthUsed - 1),
  };
  const nextPeriodRange: DateRange = {
    start: addDays(estimatedNextPeriod, -margin),
    end: addDays(estimatedNextPeriod, margin),
  };

  const estimatedOvulation = addDays(estimatedNextPeriod, -LUTEAL_DAYS);
  // VIVA rule: estimated fertile window = 5 days before estimated ovulation
  // through estimated ovulation day (6 days). Not clipped to the period:
  // in short cycles the window may overlap bleeding days, and hiding that
  // would understate fertility.
  const fertileStart = addDays(estimatedOvulation, -FERTILE_BEFORE);
  const fertileEnd = estimatedOvulation;

  // Late period: estimate has passed, no new confirmed log.
  // The cycle is NOT rolled forward — the day count simply keeps going.
  const daysLate = Math.max(0, diffDays(today, estimatedNextPeriod));
  const isLate = daysLate > 0;

  // Confidence
  let confidence: CycleEstimate['confidence'];
  if (lengthSource === 'history' && cycleHist.length >= 3 && margin <= 2) confidence = 'high';
  else if (lengthSource === 'history' || (lengthSource === 'baseline' && baseline.regularity === 'regular'))
    confidence = 'medium';
  else confidence = 'low';

  const daysToNextPeriod = diffDays(estimatedNextPeriod, today);
  const toOvulation = diffDays(estimatedOvulation, today);
  const toWindowStart = diffDays(fertileStart, today);
  const currentLog = logs.find(l => l.start === currentCycleStart);
  const bleedingDays = currentLog?.end ? diffDays(currentLog.end, currentCycleStart) + 1 : periodLengthUsed;

  let status: FertilityStatus;
  if (currentCycleDay <= bleedingDays) status = 'menstruation';
  else if (daysToNextPeriod <= 3) status = 'periodExpectedSoon';
  else if (toOvulation === 0 || toOvulation === 1) status = 'ovulationLikely';
  else if (toOvulation >= 2 && toOvulation <= FERTILE_BEFORE) status = 'potentiallyFertile';
  else if (toWindowStart > 0 && toWindowStart <= 3) status = 'fertileApproaching';
  else if (toOvulation === -1 || toOvulation === -2) status = 'ovulationMayHavePassed';
  else if (toOvulation < -2) status = 'postOvulatory';
  else status = 'lowerFertility';

  return {
    currentCycleStart,
    currentCycleDay,
    cycleLengthUsed,
    periodLengthUsed,
    lengthSource,
    estimatedNextPeriod,
    estimatedPeriodWindow,
    nextPeriodRange,
    daysToNextPeriod,
    estimatedOvulation,
    estimatedFertileWindow: { start: fertileStart, end: fertileEnd },
    isLate,
    daysLate,
    confidence,
    status,
  };
}

/**
 * Predicted cycles from the current confirmed start: cycle 0 is the period
 * that ends the current cycle, then the ones after it. Estimates only.
 */
export function predictCycles(est: CycleEstimate, count: number): PredictedCycle[] {
  const out: PredictedCycle[] = [];
  for (let k = 1; k <= count; k++) {
    const periodStart = addDays(est.currentCycleStart, k * est.cycleLengthUsed);
    const ovulation = addDays(periodStart, -LUTEAL_DAYS);
    out.push({
      periodStart,
      periodEnd: addDays(periodStart, est.periodLengthUsed - 1),
      ovulation,
      fertileStart: addDays(ovulation, -FERTILE_BEFORE),
      fertileEnd: ovulation,
    });
  }
  return out;
}

/** Call when setup is completed: the user's last period start becomes the first confirmed log. */
// The end date is left empty on purpose: filling it from the usual period length
// would turn an estimate into "confirmed" data. The user confirms it later.
export function createInitialLogs(lastPeriodStart: DateStr): PeriodLog[] {
  return [{ start: lastPeriodStart }];
}

// ---------- Confirmed period history (Prompt 4) ----------

/** Starts closer together than this are treated as a mistake, not a new cycle (same limit the engine uses for valid cycles). */
export const MIN_DAYS_BETWEEN_PERIODS = VALID_CYCLE.min;

export function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromUTC(toUTC(d)) === d; // rejects 30 Feb, month 13, etc.
}

export interface CompletedCycle {
  start: DateStr;      // confirmed period start
  nextStart: DateStr;  // the following confirmed start
  length: number;      // nextStart − start (NOT bleeding days)
}

/** Every finished cycle, oldest first. Observed facts — the baseline never overwrites them. */
export function completedCycles(logs: PeriodLog[]): CompletedCycle[] {
  const starts = Array.from(new Set(logs.map(l => l.start))).sort();
  const out: CompletedCycle[] = [];
  for (let i = 1; i < starts.length; i++) {
    out.push({ start: starts[i - 1], nextStart: starts[i], length: diffDays(starts[i], starts[i - 1]) });
  }
  return out;
}

export type PeriodLogResult =
  | { kind: 'added'; completedCycle: number | null }  // length of the cycle this start just ended
  | { kind: 'replaced'; replaced: DateStr }
  | { kind: 'duplicate' }
  | { kind: 'future' }
  | { kind: 'invalid' }
  | { kind: 'tooClose'; existing: DateStr; daysApart: number };

const sortLogs = (logs: PeriodLog[]) => [...logs].sort((a, b) => a.start.localeCompare(b.start));

function checkStart(
  logs: PeriodLog[], date: DateStr, today: DateStr, ignore?: DateStr
): PeriodLogResult | null {
  if (!isValidDate(date)) return { kind: 'invalid' };
  if (diffDays(date, today) > 0) return { kind: 'future' };
  const others = logs.filter(l => l.start !== ignore);
  if (others.some(l => l.start === date)) return { kind: 'duplicate' };
  const near = others
    .map(l => ({ start: l.start, gap: Math.abs(diffDays(date, l.start)) }))
    .filter(x => x.gap < MIN_DAYS_BETWEEN_PERIODS)
    .sort((a, b) => a.gap - b.gap)[0];
  if (near) return { kind: 'tooClose', existing: near.start, daysApart: near.gap };
  return null; // OK
}

/**
 * Log an ACTUAL period start. Returns the new history (unchanged unless added).
 * Never creates duplicates; never touches other confirmed records.
 */
export function applyPeriodLog(
  logs: PeriodLog[], date: DateStr, today: DateStr = todayLocal()
): { result: PeriodLogResult; logs: PeriodLog[] } {
  const problem = checkStart(logs, date, today);
  if (problem) return { result: problem, logs };
  const next = sortLogs([...logs, { start: date }]);
  const i = next.findIndex(l => l.start === date);
  const completedCycle = i > 0 ? diffDays(date, next[i - 1].start) : null;
  return { result: { kind: 'added', completedCycle }, logs: next };
}

/** Correct a wrongly entered start: the old date is removed, the new one takes its place. */
export function applyPeriodCorrection(
  logs: PeriodLog[], oldStart: DateStr, newStart: DateStr, today: DateStr = todayLocal()
): { result: PeriodLogResult; logs: PeriodLog[] } {
  if (!logs.some(l => l.start === oldStart)) return { result: { kind: 'invalid' }, logs };
  const problem = checkStart(logs, newStart, today, oldStart);
  if (problem) return { result: problem, logs };
  const next = sortLogs([...logs.filter(l => l.start !== oldStart), { start: newStart }]);
  return { result: { kind: 'replaced', replaced: oldStart }, logs: next };
}

/**
 * Cycle day for ANY date, counted from the latest CONFIRMED period start on or
 * before it. Predictions never restart the count; null before the first log.
 */
export function cycleDayOn(logs: PeriodLog[], date: DateStr, today: DateStr = todayLocal()): number | null {
  const starts = sortedStarts(logs, today).filter(s => diffDays(date, s) >= 0);
  if (starts.length === 0) return null;
  return diffDays(date, starts[starts.length - 1]) + 1;
}
