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

export interface CycleEstimate {
  currentCycleStart: DateStr;
  currentCycleDay: number;
  cycleLengthUsed: number;
  periodLengthUsed: number;
  lengthSource: 'history' | 'baseline' | 'default';
  estimatedNextPeriod: DateStr;
  estimatedPeriodWindow: DateRange;
  estimatedOvulation: DateStr;
  estimatedFertileWindow: DateRange;
  isLate: boolean;   // past the estimated date with no new log
  daysLate: number;
  confidence: 'low' | 'medium' | 'high';
}

// ---------- Defaults & limits ----------

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;
const LUTEAL_DAYS = 14;          // ovulation ≈ next period − 14
const FERTILE_BEFORE = 5;        // sperm survival: window = ovulation − 5 … ovulation (6 days)
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
/** Today in the phone's local time zone */
export function todayLocal(): DateStr {
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

  return {
    currentCycleStart,
    currentCycleDay,
    cycleLengthUsed,
    periodLengthUsed,
    lengthSource,
    estimatedNextPeriod,
    estimatedPeriodWindow,
    estimatedOvulation,
    estimatedFertileWindow: { start: fertileStart, end: fertileEnd },
    isLate,
    daysLate,
    confidence,
  };
}

/** Call when setup is completed: the user's last period start becomes the first confirmed log. */
// The end date is left empty on purpose: filling it from the usual period length
// would turn an estimate into "confirmed" data. The user confirms it later.
export function createInitialLogs(lastPeriodStart: DateStr): PeriodLog[] {
  return [{ start: lastPeriodStart }];
}
