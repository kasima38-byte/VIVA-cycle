#!/usr/bin/env bash
# VIVA Cycle - Prompt 2 installer: cycle data model, calculation engine, date fixes.
# Run from the project root:   bash install_prompt2.sh
# Undo everything:             bash install_prompt2.sh restore
set -u
cd "$(dirname "$0")" || exit 1

if [ ! -f package.json ] || [ ! -d constants ] || [ ! -d app ]; then
  echo "Run this from the VIVA-cycle project root (the folder with package.json, app and constants)."
  exit 1
fi

BACKUP=".backup-prompt2"
CREATED="$BACKUP/_created.txt"

if [ "${1:-}" = "restore" ]; then
  if [ ! -d "$BACKUP" ]; then echo "Nothing to restore."; exit 0; fi
  (cd "$BACKUP" && find . -type f ! -name _created.txt) | while read -r f; do
    cp "$BACKUP/$f" "$f" && echo "restored $f"
  done
  if [ -f "$CREATED" ]; then
    while read -r f; do [ -n "$f" ] && rm -f "$f" && echo "removed $f"; done < "$CREATED"
  fi
  echo "Restore finished."
  exit 0
fi

mkdir -p "$BACKUP"
touch "$CREATED"

backup() {
  local f="$1"
  if grep -qx "$f" "$CREATED"; then
    :  # created by an earlier run of this script: there is no original to save
  elif [ -f "$f" ]; then
    if [ ! -f "$BACKUP/$f" ]; then mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"; fi
  else
    echo "$f" >> "$CREATED"
  fi
  mkdir -p "$(dirname "$f")"
}

echo "== Writing files =="
backup "constants/dateUtils.ts"
cat > "constants/dateUtils.ts" << 'VIVA_EOF'
// Calendar dates are plain "YYYY-MM-DD" strings. All arithmetic is done in UTC
// so the phone's time zone and daylight saving can never shift a date by a day.

// Developer switch: set to e.g. '2026-10-10' to pretend today is that date
// (useful for testing late periods). Keep null for normal use.
const DEV_TODAY: string | null = null;

const MS_PER_DAY = 86400000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function isValidDateKey(key: string): boolean {
  return parseDateKey(key) !== null;
}

function toUtcMs(key: string): number {
  const p = parseDateKey(key);
  if (!p) throw new Error('Invalid date: ' + key);
  return Date.UTC(p.y, p.m - 1, p.d);
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

export function addDays(key: string, days: number): string {
  return fromUtcMs(toUtcMs(key) + days * MS_PER_DAY);
}

// Whole days from a to b (positive when b is later).
export function dayDiff(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

// The calendar date a person sees on their wall clock. Never use
// toISOString() for this: it converts to UTC and can return the wrong day.
export function dateToKey(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// A local-midnight Date for a key, for date pickers.
export function keyToLocalDate(key: string): Date {
  const p = parseDateKey(key);
  if (!p) throw new Error('Invalid date: ' + key);
  return new Date(p.y, p.m - 1, p.d);
}

export function getToday(): string {
  return DEV_TODAY ?? dateToKey(new Date());
}
VIVA_EOF
echo "  wrote constants/dateUtils.ts"

backup "constants/periodHistory.ts"
cat > "constants/periodHistory.ts" << 'VIVA_EOF'
import { dayDiff, isValidDateKey } from './dateUtils';

// A CONFIRMED period: something the user actually logged. Predictions are
// never stored here; they are calculated on demand and thrown away.
export type PeriodEntry = {
  date: string; // first day of bleeding, YYYY-MM-DD
  durationDays?: number; // bleeding days, when the user recorded them
  flowIntensity?: 'light' | 'medium' | 'heavy' | 'spotting';
  source: 'confirmed';
};

export type PeriodDetails = {
  durationDays?: number;
  flowIntensity?: PeriodEntry['flowIntensity'];
};

export type AddOutcome = 'added' | 'updated' | 'merged';

// Two start dates closer together than this are one bleed, not two periods.
export const SAME_PERIOD_WITHIN_DAYS = 15;

export function sortPeriods(periods: PeriodEntry[]): PeriodEntry[] {
  return [...periods].sort((a, b) => a.date.localeCompare(b.date));
}

export function startDates(periods: PeriodEntry[]): string[] {
  return sortPeriods(periods).map((p) => p.date);
}

// Adds a confirmed period without creating duplicates. Pure: returns a new list.
//  - same day logged again          -> 'updated' (details replaced)
//  - within 15 days of another start -> 'merged' (the earlier start date wins)
//  - otherwise                      -> 'added'
export function addPeriod(
  periods: PeriodEntry[],
  date: string,
  details: PeriodDetails = {}
): { periods: PeriodEntry[]; entry: PeriodEntry; outcome: AddOutcome } {
  if (!isValidDateKey(date)) throw new Error('Invalid period date: ' + date);

  const defined: PeriodDetails = {};
  if (details.durationDays !== undefined) defined.durationDays = details.durationDays;
  if (details.flowIntensity !== undefined) defined.flowIntensity = details.flowIntensity;

  const near = periods.filter((p) => Math.abs(dayDiff(p.date, date)) < SAME_PERIOD_WITHIN_DAYS);

  if (near.length === 0) {
    const entry: PeriodEntry = { date, source: 'confirmed', ...defined };
    return { periods: sortPeriods([...periods, entry]), entry, outcome: 'added' };
  }

  const earliest = [date, ...near.map((p) => p.date)].sort()[0];
  const base = near.find((p) => p.date === earliest) ?? near[0];
  const entry: PeriodEntry = { ...base, ...defined, date: earliest, source: 'confirmed' };
  const rest = periods.filter((p) => !near.includes(p));
  const outcome: AddOutcome = near.length === 1 && near[0].date === date ? 'updated' : 'merged';
  return { periods: sortPeriods([...rest, entry]), entry, outcome };
}

// Completed cycle lengths: the gap between each confirmed start and the next.
// The number of bleeding days is never used here.
export function completedCycleLengths(periods: PeriodEntry[]): number[] {
  const starts = startDates(periods);
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    lengths.push(dayDiff(starts[i - 1], starts[i]));
  }
  return lengths;
}

export function latestStartOnOrBefore(periods: PeriodEntry[], todayKey: string): string | null {
  const starts = startDates(periods).filter((s) => s <= todayKey);
  return starts.length ? starts[starts.length - 1] : null;
}
VIVA_EOF
echo "  wrote constants/periodHistory.ts"

backup "constants/cycleEngine.ts"
cat > "constants/cycleEngine.ts" << 'VIVA_EOF'
import { addDays, dayDiff } from './dateUtils';
import { completedCycleLengths, latestStartOnOrBefore, PeriodEntry } from './periodHistory';

export { addDays, dayDiff };

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

export type DateRange = { start: string; end: string };

export type CycleEstimate = {
  stats: CycleStats;
  basis: 'history' | 'assumed';
  // Where expectedCycleLength came from: the user's own logged cycles,
  // the usual length they entered, or the 28-day default.
  lengthSource: 'history' | 'usual' | 'default';
  cycleStart: string | null; // latest CONFIRMED period start on or before today
  cycleDay: number | null;
  expectedCycleLength: number;
  nextPeriod: string | null; // PREDICTED
  predictedPeriod: DateRange | null; // PREDICTED
  daysToNextPeriod: number | null;
  periodLateDays: number;
  ovulation: string | null; // ESTIMATED, never confirmed
  fertileWindow: DateRange | null; // ESTIMATED
  uncertaintyDays: number;
  status: FertilityStatus;
};

export const DEFAULT_CYCLE_LENGTH = 28;
export const LUTEAL_PHASE_DAYS = 14;
export const FERTILE_DAYS_BEFORE_OVULATION = 5;
export const MIN_CYCLES_FOR_HISTORY = 3;

// ---- Small, separate calculations (swap any of these to improve the model) ----

// The first day of the latest confirmed period is cycle day 1.
export function calculateCycleDay(cycleStart: string, todayKey: string): number {
  return dayDiff(cycleStart, todayKey) + 1;
}

export function calculateNextPeriod(cycleStart: string, cycleLength: number): string {
  return addDays(cycleStart, cycleLength);
}

export function calculatePredictedPeriod(nextPeriod: string, periodLength: number): DateRange {
  return { start: nextPeriod, end: addDays(nextPeriod, periodLength - 1) };
}

// Simple calendar model: ovulation = next period start - 14 days. An estimate only.
export function calculateEstimatedOvulation(nextPeriod: string): string {
  return addDays(nextPeriod, -LUTEAL_PHASE_DAYS);
}

// 5 days before estimated ovulation through the ovulation day.
export function calculateFertileWindow(ovulation: string): DateRange {
  return { start: addDays(ovulation, -FERTILE_DAYS_BEFORE_OVULATION), end: ovulation };
}

// ---- Statistics ----

// Uses the last 6 completed cycles. Gaps under 15 or over 60 days usually mean
// a missed log rather than a real cycle, so they are left out of the statistics
// (they are still returned by completedCycleLengths).
export function computeCycleStats(periods: PeriodEntry[]): CycleStats {
  const usable = completedCycleLengths(periods).filter((g) => g >= 15 && g <= 60);
  const cycleLengths = usable.slice(-6);
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

// ---- The estimate ----

// periods: CONFIRMED history only. typicalCycleLength: the user's usual length,
// or null when they don't know it. Nothing here is ever written back to history.
export function estimateCycle(
  periods: PeriodEntry[],
  periodLength: number,
  todayKey: string,
  typicalCycleLength: number | null = null
): CycleEstimate {
  const stats = computeCycleStats(periods);

  const empty: CycleEstimate = {
    stats,
    basis: 'assumed',
    lengthSource: typicalCycleLength !== null ? 'usual' : 'default',
    cycleStart: null,
    cycleDay: null,
    expectedCycleLength: typicalCycleLength ?? DEFAULT_CYCLE_LENGTH,
    nextPeriod: null,
    predictedPeriod: null,
    daysToNextPeriod: null,
    periodLateDays: 0,
    ovulation: null,
    fertileWindow: null,
    uncertaintyDays: 4,
    status: 'unknown',
  };

  const cycleStart = latestStartOnOrBefore(periods, todayKey);
  if (cycleStart === null) return empty;

  const useHistory = stats.average !== null && stats.count >= MIN_CYCLES_FOR_HISTORY;
  const lengthSource: CycleEstimate['lengthSource'] = useHistory
    ? 'history'
    : typicalCycleLength !== null
    ? 'usual'
    : 'default';
  const expectedCycleLength = useHistory
    ? Math.round(stats.average as number)
    : typicalCycleLength ?? DEFAULT_CYCLE_LENGTH;

  const nextPeriod = calculateNextPeriod(cycleStart, expectedCycleLength);
  const predictedPeriod = calculatePredictedPeriod(nextPeriod, periodLength);
  const ovulation = calculateEstimatedOvulation(nextPeriod);
  const fertileWindow = calculateFertileWindow(ovulation);

  const cycleDay = calculateCycleDay(cycleStart, todayKey);
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
    basis: useHistory ? 'history' : 'assumed',
    lengthSource,
    cycleStart,
    cycleDay,
    expectedCycleLength,
    nextPeriod,
    predictedPeriod,
    daysToNextPeriod,
    periodLateDays,
    ovulation,
    fertileWindow,
    uncertaintyDays,
    status,
  };
}
VIVA_EOF
echo "  wrote constants/cycleEngine.ts"

backup "constants/settingsStore.ts"
cat > "constants/settingsStore.ts" << 'VIVA_EOF'
import { useSyncExternalStore } from 'react';

export type Goal = 'conceive' | 'avoid' | null;
export type Regularity = 'regular' | 'irregular' | 'unknown';

// Baseline preferences. These shape FUTURE predictions only.
// They are never used to rewrite logged period history.
export type Settings = {
  goal: Goal;
  cycleLength: number | null; // null = "I don't know", which is different from a real length
  periodLength: number;
  cycleRegularity: Regularity;
};

let settings: Settings = {
  goal: null,
  cycleLength: null,
  periodLength: 5,
  cycleRegularity: 'unknown',
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
VIVA_EOF
echo "  wrote constants/settingsStore.ts"

backup "constants/cycleStore.ts"
cat > "constants/cycleStore.ts" << 'VIVA_EOF'
import { useSyncExternalStore } from 'react';
import { cycleState as demo } from './cycleData';
import { AddOutcome, addPeriod, PeriodEntry } from './periodHistory';

export type { PeriodEntry } from './periodHistory';

export type DailyLog = {
  date: string;
  mood?: string;
  energy?: number;
  symptoms?: string[];
};

export type SexualActivityEntry = {
  date: string;
  hadActivity: boolean;
};

// Only things the user actually recorded live here. Predicted periods,
// estimated ovulation and the fertile window are calculated, never stored.
export type CycleLog = {
  periods: PeriodEntry[]; // CONFIRMED periods, sorted ascending
  dailyLogs: Record<string, DailyLog>;
  sexualActivity: SexualActivityEntry[];
};

// DEMO DATA ONLY: stands in for onboarding until it exists. Stored as confirmed
// history so the app has something to show. Remove when real onboarding lands.
const DEMO_PERIOD_STARTS = ['2026-08-09', demo.periodDays[0]];

let state: CycleLog = {
  periods: DEMO_PERIOD_STARTS.map((date) => ({ date, source: 'confirmed' as const })),
  dailyLogs: {},
  sexualActivity: demo.sexEvents.map((date) => ({ date, hadActivity: true })),
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCycleLog(): CycleLog {
  return state;
}

export function useCycleLog(): CycleLog {
  return useSyncExternalStore(subscribe, getCycleLog);
}

// Saves a confirmed period start. Never creates a duplicate record: logging the
// same day again updates it, and a start within 15 days of another is merged into it.
export function logPeriodStart(
  date: string,
  flowIntensity?: PeriodEntry['flowIntensity'],
  durationDays?: number
): AddOutcome {
  const result = addPeriod(state.periods, date, { flowIntensity, durationDays });
  state = { ...state, periods: result.periods };
  notify();
  return result.outcome;
}

export function saveDailyLog(date: string, patch: Partial<DailyLog>) {
  const existing = state.dailyLogs[date] || { date };
  state = {
    ...state,
    dailyLogs: { ...state.dailyLogs, [date]: { ...existing, ...patch } },
  };
  notify();
}

export function saveSexualActivity(date: string, hadActivity: boolean) {
  const others = state.sexualActivity.filter((e) => e.date !== date);
  state = { ...state, sexualActivity: [...others, { date, hadActivity }] };
  notify();
}
VIVA_EOF
echo "  wrote constants/cycleStore.ts"

backup "constants/baseline.ts"
cat > "constants/baseline.ts" << 'VIVA_EOF'
import { getCycleLog } from './cycleStore';
import { getProfile } from './profileStore';
import { Goal, getSettings, Regularity } from './settingsStore';
import { startDates } from './periodHistory';

// One read-only view of the user's baseline. Nothing is stored twice:
// the name comes from the profile, the usual lengths and goal from settings,
// and the last period start is simply the latest CONFIRMED period.
export type Baseline = {
  name: string;
  lastPeriodStartDate: string | null;
  usualCycleLength: number | null; // null = unknown
  usualPeriodDuration: number;
  cycleRegularity: Regularity;
  reproductiveGoal: Goal;
};

export function getBaseline(): Baseline {
  const starts = startDates(getCycleLog().periods);
  const s = getSettings();
  return {
    name: getProfile().name,
    lastPeriodStartDate: starts.length ? starts[starts.length - 1] : null,
    usualCycleLength: s.cycleLength,
    usualPeriodDuration: s.periodLength,
    cycleRegularity: s.cycleRegularity,
    reproductiveGoal: s.goal,
  };
}
VIVA_EOF
echo "  wrote constants/baseline.ts"

backup "constants/calendarModel.ts"
cat > "constants/calendarModel.ts" << 'VIVA_EOF'
import { DayInfo } from './cycleData';
import {
  addDays,
  calculateEstimatedOvulation,
  calculateFertileWindow,
  calculatePredictedPeriod,
  dayDiff,
  estimateCycle,
} from './cycleEngine';
import { CycleLog } from './cycleStore';
import { Settings } from './settingsStore';

export type DayModel = DayInfo & {
  isPredictedPeriod: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toKey(y: number, m: number, d: number) {
  return y + '-' + pad(m + 1) + '-' + pad(d);
}

function eachDay(start: string, end: string, fn: (day: string) => void) {
  const n = dayDiff(start, end);
  for (let i = 0; i <= n; i++) fn(addDays(start, i));
}

export function buildCalendarMonth(
  year: number,
  monthIndex: number,
  log: CycleLog,
  settings: Settings,
  todayKey: string
): DayModel[] {
  const est = estimateCycle(log.periods, settings.periodLength, todayKey, settings.cycleLength);
  const len = est.expectedCycleLength;
  const plen = settings.periodLength;
  const late = est.periodLateDays >= 2;

  const periodDays = new Set<string>(); // CONFIRMED
  const predictedDays = new Set<string>(); // PREDICTED
  const fertileDays = new Set<string>(); // ESTIMATED
  const ovulationDays = new Set<string>(); // ESTIMATED

  const markEstimate = (nextPeriodStart: string) => {
    const ovulation = calculateEstimatedOvulation(nextPeriodStart);
    ovulationDays.add(ovulation);
    const window = calculateFertileWindow(ovulation);
    eachDay(window.start, window.end, (d) => fertileDays.add(d));
  };

  // Logged periods are facts. For past cycles, ovulation is looked back from the
  // next logged period.
  const sorted = [...log.periods].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((p, i) => {
    const days = p.durationDays ?? plen;
    for (let d = 0; d < days; d++) periodDays.add(addDays(p.date, d));
    const next = sorted[i + 1];
    if (next) markEstimate(next.date);
  });

  // Predictions run forward from the latest confirmed period. Nothing is
  // projected while a period is late.
  if (est.cycleStart) {
    const last = late ? 0 : 3;
    for (let k = 0; k <= last; k++) {
      const nextStart = addDays(est.cycleStart, (k + 1) * len);
      markEstimate(nextStart);
      if (!late && nextStart >= todayKey) {
        const win = calculatePredictedPeriod(nextStart, plen);
        eachDay(win.start, win.end, (d) => predictedDays.add(d));
      }
    }
  }

  const sex = new Set(log.sexualActivity.filter((e) => e.hadActivity).map((e) => e.date));

  const make = (dateKey: string, day: number, inMonth: boolean): DayModel => ({
    dateKey,
    day,
    isCurrentMonth: inMonth,
    isToday: dateKey === todayKey,
    isPeriod: periodDays.has(dateKey),
    isPredictedPeriod: predictedDays.has(dateKey) && !periodDays.has(dateKey),
    isFertile: fertileDays.has(dateKey),
    isOvulation: ovulationDays.has(dateKey),
    isSexLogged: sex.has(dateKey),
  });

  const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const total = new Date(year, monthIndex + 1, 0).getDate();
  const prevTotal = new Date(year, monthIndex, 0).getDate();
  const prevY = monthIndex === 0 ? year - 1 : year;
  const prevM = monthIndex === 0 ? 11 : monthIndex - 1;
  const nextY = monthIndex === 11 ? year + 1 : year;
  const nextM = monthIndex === 11 ? 0 : monthIndex + 1;

  const cells: DayModel[] = [];
  for (let i = lead - 1; i >= 0; i--) {
    const day = prevTotal - i;
    cells.push(make(toKey(prevY, prevM, day), day, false));
  }
  for (let day = 1; day <= total; day++) {
    cells.push(make(toKey(year, monthIndex, day), day, true));
  }
  let nd = 1;
  while (cells.length % 7 !== 0) {
    cells.push(make(toKey(nextY, nextM, nd), nd, false));
    nd++;
  }
  return cells;
}
VIVA_EOF
echo "  wrote constants/calendarModel.ts"

backup "constants/homeData.ts"
cat > "constants/homeData.ts" << 'VIVA_EOF'
import { formatLongDate } from './cycleData';
import { estimateCycle, FertilityStatus } from './cycleEngine';
import { getCycleLog } from './cycleStore';
import { getToday } from './dateUtils';
import { Goal, getSettings } from './settingsStore';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(key: string) {
  const parts = key.split('-').map(Number);
  return parts[2] + ' ' + MONTHS[parts[1] - 1];
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || '';
}

type LateCopy = { label: string; explanation: string; message: string };

// Shown when the expected period date has passed. Never says "you are pregnant".
function lateCopy(daysLate: number): LateCopy {
  if (daysLate >= 14) {
    return {
      label: 'Period is late',
      explanation: 'Your period is more than 2 weeks later than expected. If you could be pregnant, a pregnancy test can help.',
      message: 'Consider speaking to a doctor or nurse if your period stays absent or your cycles have changed.',
    };
  }
  if (daysLate >= 7) {
    return {
      label: 'Period is late',
      explanation: 'Your period is about a week later than expected. If you could be pregnant, a pregnancy test can help.',
      message: 'Cycles can shift for many reasons, including stress, illness and travel.',
    };
  }
  return {
    label: 'Period may be late',
    explanation: 'Your period is a few days later than expected. This is an estimate, and cycle timing can vary.',
    message: 'If you could be pregnant, a pregnancy test can help.',
  };
}

// Extra guidance by goal. Estimates only: never "safe day", never a guarantee either way.
function goalGuidance(goal: Goal, status: FertilityStatus): string | null {
  const fertileNow = status === 'potentiallyFertile' || status === 'ovulationLikely';
  const approaching = status === 'fertileApproaching';

  if (goal === 'conceive') {
    if (fertileNow) return 'These days may offer a higher chance of conception. Having intercourse regularly in your fertile window may help.';
    if (approaching) return 'Your estimated fertile window is approaching. An LH test can give extra information about ovulation.';
    return null;
  }
  if (goal === 'avoid') {
    if (fertileNow || approaching) {
      return 'Pregnancy may be possible on these days. If you want to avoid pregnancy, use an effective contraceptive method or avoid vaginal intercourse. This estimate is not contraception.';
    }
    if (status === 'lowerFertility' || status === 'postOvulatory') {
      return 'Fertility is estimated to be lower, but pregnancy can still happen because ovulation timing varies.';
    }
    return null;
  }
  return null;
}

type StatusCopy = { label: string; explanation: string; message: string; note: string | null };

// Wording follows the product rules: estimates, never certainty, never a "safe day".
const STATUS_COPY: Record<FertilityStatus, StatusCopy> = {
  menstruation: {
    label: 'Menstruation',
    explanation: 'Your period is under way. Rest and be gentle with yourself.',
    message: 'Be kind to yourself today.',
    note: null,
  },
  lowerFertility: {
    label: 'Lower estimated fertility',
    explanation: 'Based on your cycle history, fertility is estimated to be lower right now. Pregnancy can still happen.',
    message: 'This is an estimate, not a guarantee.',
    note: null,
  },
  fertileApproaching: {
    label: 'Fertile window approaching',
    explanation: 'Your estimated fertile window may begin in the next few days.',
    message: 'Timing can vary from cycle to cycle.',
    note: null,
  },
  potentiallyFertile: {
    label: 'Potentially fertile',
    explanation: 'You may be in your estimated fertile window. Pregnancy is possible on these days.',
    message: 'This is an estimate based on your cycle history.',
    note: 'Potentially fertile',
  },
  ovulationLikely: {
    label: 'Ovulation likely approaching',
    explanation: 'Ovulation is estimated around now, but its timing varies and is not confirmed.',
    message: 'Pregnancy is possible on these days.',
    note: 'Estimated, not confirmed',
  },
  ovulationMayHavePassed: {
    label: 'Ovulation may have occurred',
    explanation: 'Your estimated ovulation date has just passed. This is an estimate, not a confirmed event.',
    message: 'Pregnancy is still possible for a short time.',
    note: null,
  },
  postOvulatory: {
    label: 'Post-ovulatory phase',
    explanation: 'This is after your estimated ovulation. Your body may be preparing for your next period.',
    message: 'Take care of yourself.',
    note: null,
  },
  periodExpectedSoon: {
    label: 'Period expected soon',
    explanation: 'Your next period may start within the next few days.',
    message: 'Take care of yourself.',
    note: null,
  },
  unknown: {
    label: 'Not enough data yet',
    explanation: 'Log the first day of your period to see estimates here.',
    message: 'The more cycles you log, the better the estimates.',
    note: null,
  },
};

export function getHomeSummary() {
  const log = getCycleLog();
  const settings = getSettings();
  const est = estimateCycle(log.periods, settings.periodLength, getToday(), settings.cycleLength);
  const isLate = est.periodLateDays >= 2;
  const base = STATUS_COPY[est.status];
  const copy = isLate ? { ...base, ...lateCopy(est.periodLateDays), note: null } : base;

  const cycleLength = est.expectedCycleLength;
  const cycleDay = est.cycleDay ?? 0;

  let confidenceNote: string;
  if (est.lengthSource === 'default') {
    confidenceNote = 'These dates assume a 28-day cycle until you set your usual length or log 3 cycles.';
  } else if (est.lengthSource === 'usual') {
    confidenceNote = 'These dates use your usual cycle length of ' + cycleLength + ' days until you have logged at least 3 cycles.';
  } else if (est.stats.confidence === 'good') {
    confidenceNote = 'Your cycle timing has been fairly consistent, so this estimate is based on your recent pattern.';
  } else if (est.stats.confidence === 'moderate') {
    confidenceNote = 'Your cycle timing has been somewhat consistent, so these estimates are approximate.';
  } else {
    confidenceNote = 'Your cycle lengths vary, so predicting ovulation from calendar dates alone is less reliable.';
  }

  return {
    hasData: est.cycleStart !== null,
    cycleDay,
    cycleLength,
    progress: Math.min(cycleDay / cycleLength, 1),
    phase: copy.label,
    statusKey: est.status,
    fertileRange: est.fertileWindow
      ? shortDate(est.fertileWindow.start) + ' – ' + formatLongDate(est.fertileWindow.end)
      : 'Not enough data yet',
    ovulationText: est.ovulation ? formatLongDate(est.ovulation) : 'Not enough data yet',
    nextPeriodDays: est.daysToNextPeriod ?? 0,
    nextPeriodText: est.nextPeriod ? 'Expected ' + formatLongDate(est.nextPeriod) : 'Not enough data yet',
    periodLateDays: est.periodLateDays,
    isLate,
    goal: settings.goal,
    goalNote: goalGuidance(settings.goal, est.status),
    phaseExplanation: copy.explanation,
    todayMessage: copy.message,
    todayNote: copy.note,
    confidenceNote,
  };
}
VIVA_EOF
echo "  wrote constants/homeData.ts"

backup "tests/cycleEngine.test.ts"
cat > "tests/cycleEngine.test.ts" << 'VIVA_EOF'
// Run with:  npx tsx tests/cycleEngine.test.ts
// Optionally with a different time zone:  TZ=Africa/Kampala npx tsx tests/cycleEngine.test.ts
import { getBaseline } from '../constants/baseline';
import {
  calculateCycleDay,
  estimateCycle,
} from '../constants/cycleEngine';
import { getCycleLog, logPeriodStart } from '../constants/cycleStore';
import { addDays, dateToKey, dayDiff, isValidDateKey, keyToLocalDate } from '../constants/dateUtils';
import { addPeriod, completedCycleLengths, PeriodEntry } from '../constants/periodHistory';
import { getHomeSummary } from '../constants/homeData';
import { getSettings, updateSettings } from '../constants/settingsStore';

declare const process: { exitCode?: number; env: Record<string, string | undefined> };

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log('  PASS  ' + label);
  } else {
    failed++;
    console.log('  FAIL  ' + label + '\n        expected ' + e + '\n        got      ' + a);
  }
}

function group(name: string) {
  console.log('\n' + name);
}

const confirmed = (dates: string[]): PeriodEntry[] => dates.map((date) => ({ date, source: 'confirmed' as const }));

console.log('Time zone: ' + (process.env.TZ ?? 'system default'));

group('TEST 1  LMP 5 Sep, 28-day cycle, 5-day period');
{
  const e = estimateCycle(confirmed(['2026-09-05']), 5, '2026-09-20', 28);
  eq(e.nextPeriod, '2026-10-03', 'next period is 3 Oct');
  eq(e.ovulation, '2026-09-19', 'estimated ovulation is 19 Sep');
  eq(e.fertileWindow, { start: '2026-09-14', end: '2026-09-19' }, 'fertile window is 14-19 Sep');
  eq(e.predictedPeriod, { start: '2026-10-03', end: '2026-10-07' }, 'predicted period is 3-7 Oct');
}

group('TEST 2  completed cycle lengths');
{
  const periods = confirmed(['2026-08-09', '2026-09-05', '2026-10-03', '2026-10-31', '2026-11-28', '2026-12-26']);
  eq(completedCycleLengths(periods), [27, 28, 28, 28, 28], 'lengths are 27, 28, 28, 28, 28');
  const e = estimateCycle(periods, 5, '2026-12-30', 30);
  eq(e.lengthSource, 'history', '6 confirmed periods: history wins over the usual length');
  eq(e.expectedCycleLength, 28, 'expected cycle length is 28 (average of history)');
}

group('TEST 3  cycle day');
{
  const e = estimateCycle(confirmed(['2026-10-03']), 5, '2026-10-17', 28);
  eq(e.cycleDay, 15, '3 Oct = CD1, so 17 Oct = CD15');
  eq(calculateCycleDay('2026-09-05', '2026-09-05'), 1, '5 Sep is CD1');
  eq(calculateCycleDay('2026-09-05', '2026-09-07'), 3, '7 Sep is CD3');
}

group('TEST 4  predicted 3-7 Oct, user logs 6 Oct');
{
  const before = confirmed(['2026-09-05']);
  const predicted = estimateCycle(before, 5, '2026-10-01', 28).predictedPeriod;
  eq(predicted, { start: '2026-10-03', end: '2026-10-07' }, 'prediction was 3-7 Oct');
  const after = addPeriod(before, '2026-10-06', { flowIntensity: 'medium' });
  eq(after.outcome, 'added', 'logging 6 Oct is a new confirmed period');
  eq(after.periods.map((p) => p.date), ['2026-09-05', '2026-10-06'], 'history is 5 Sep and 6 Oct only');
  eq(after.periods.some((p) => p.date === '2026-10-03'), false, 'the predicted 3 Oct was never stored');
  const e = estimateCycle(after.periods, 5, '2026-10-06', 28);
  eq(e.cycleStart, '2026-10-06', '6 Oct becomes the cycle anchor');
  eq(e.cycleDay, 1, '6 Oct is CD1');
  eq(e.nextPeriod, '2026-11-03', 'next prediction restarts from 6 Oct');
}

group('TEST 5  predicted period passes, nothing logged');
{
  const history = confirmed(['2026-09-05']);
  const e = estimateCycle(history, 5, '2026-10-12', 28);
  eq(history.length, 1, 'no confirmed period was created');
  eq(e.cycleStart, '2026-09-05', 'cycle anchor is still the last CONFIRMED period');
  eq(e.periodLateDays, 9, 'the period is reported as 9 days late');
  eq(e.cycleDay, 38, 'cycle day keeps counting from 5 Sep');
}

group('TEST 6  settings change does not touch history');
{
  const history = confirmed(['2026-09-05', '2026-10-03', '2026-10-31']);
  const snapshot = JSON.stringify(history);
  const at28 = estimateCycle(history, 5, '2026-11-05', 28);
  const at30 = estimateCycle(history, 5, '2026-11-05', 30);
  eq(JSON.stringify(history), snapshot, 'history is unchanged by running estimates');
  eq(at28.nextPeriod, '2026-11-28', 'usual 28: next period 28 Nov');
  eq(at30.nextPeriod, '2026-11-30', 'usual 30: next period 30 Nov (future prediction changes)');
  eq(completedCycleLengths(history), [28, 28], 'completed cycle lengths stay 28, 28');
}

group('Unknown cycle length is not forced');
{
  const e = estimateCycle(confirmed(['2026-09-05']), 5, '2026-09-20', null);
  eq(e.lengthSource, 'default', 'unknown length is reported as a default, not as the user\'s value');
  eq(e.basis, 'assumed', 'basis is assumed');
  eq(e.expectedCycleLength, 28, 'a 28-day default is used for the estimate');
  const none = estimateCycle([], 5, '2026-09-20', 30);
  eq(none.status, 'unknown', 'no confirmed periods: status is unknown');
  eq(none.nextPeriod, null, 'no confirmed periods: no prediction');
}

group('Duplicate period records');
{
  let periods = confirmed(['2026-08-09', '2026-09-05']);
  const same = addPeriod(periods, '2026-09-05', { flowIntensity: 'heavy' });
  eq(same.outcome, 'updated', 'logging the same day again updates it');
  eq(same.periods.length, 2, '...and still 2 records');
  eq(same.periods[1].flowIntensity, 'heavy', '...with the new flow saved');
  periods = same.periods;
  const near = addPeriod(periods, '2026-09-08');
  eq(near.outcome, 'merged', 'a start 3 days later is merged, not duplicated');
  eq(near.periods.map((p) => p.date), ['2026-08-09', '2026-09-05'], '...and the earlier start wins');
  const earlier = addPeriod(periods, '2026-09-03');
  eq(earlier.periods.map((p) => p.date), ['2026-08-09', '2026-09-03'], 'logging an earlier true start moves it back');
  eq(earlier.periods[1].flowIntensity, 'heavy', '...and keeps the details already saved');
}

group('Store: logging does not rewrite history');
{
  const start = getCycleLog().periods.map((p) => p.date);
  eq(start, ['2026-08-09', '2026-09-05'], 'store starts with the 2 demo confirmed periods');
  eq(logPeriodStart('2026-10-06', 'medium'), 'added', 'logging 6 Oct is added');
  eq(logPeriodStart('2026-10-06', 'heavy'), 'updated', 'logging 6 Oct again is an update');
  eq(logPeriodStart('2026-10-04'), 'merged', 'logging 4 Oct merges into the same period');
  eq(getCycleLog().periods.map((p) => p.date), ['2026-08-09', '2026-09-05', '2026-10-04'], 'history has 3 records, no duplicates');
  eq(getCycleLog().periods.every((p) => p.source === 'confirmed'), true, 'every record is marked confirmed');
}

group('Baseline and settings');
{
  const b = getBaseline();
  eq(b.lastPeriodStartDate, '2026-10-04', 'last period start is the latest confirmed period');
  eq(b.usualCycleLength, null, 'usual cycle length is unknown by default');
  const historyBefore = JSON.stringify(getCycleLog().periods);
  updateSettings({ cycleLength: 30, periodLength: 6, cycleRegularity: 'irregular' });
  eq(getBaseline().usualCycleLength, 30, 'baseline picks up the new usual length');
  eq(getSettings().cycleLength, 30, 'settings store holds the new value');
  eq(JSON.stringify(getCycleLog().periods), historyBefore, 'history is identical after the settings change');
  updateSettings({ cycleLength: null, periodLength: 5, cycleRegularity: 'unknown' });
}

group('Home summary reads the engine');
{
  const s = getHomeSummary();
  eq(s.hasData, true, 'home has data');
  eq(s.confidenceNote.includes('null'), false, 'no "null" leaks into the wording');
  eq(typeof s.cycleDay, 'number', 'cycle day is a number');
}

group('Dates: boundaries, leap years, time zones');
{
  eq(addDays('2026-12-30', 5), '2027-01-04', 'year boundary');
  eq(addDays('2026-01-30', 3), '2026-02-02', 'month boundary');
  eq(addDays('2028-02-27', 2), '2028-02-29', 'leap year: 27 Feb + 2 = 29 Feb 2028');
  eq(addDays('2027-02-27', 2), '2027-03-01', 'non-leap year: 27 Feb + 2 = 1 Mar');
  eq(dayDiff('2028-02-28', '2028-03-01'), 2, 'leap year day difference');
  eq(dayDiff('2026-10-03', '2026-10-03'), 0, 'same day is 0');
  eq(addDays('2026-10-03', 0), '2026-10-03', '3 Oct stays 3 Oct');
  eq(dateToKey(new Date(2026, 9, 3)), '2026-10-03', 'local 3 Oct midnight is 2026-10-03');
  eq(dateToKey(keyToLocalDate('2026-10-03')), '2026-10-03', 'key -> Date -> key round trip');
  eq(dateToKey(new Date(2026, 9, 3, 23, 59)), '2026-10-03', 'local 23:59 is still 3 Oct');
  eq(isValidDateKey('2026-02-30'), false, '30 Feb is rejected');
  eq(isValidDateKey('2026-13-01'), false, 'month 13 is rejected');
  const legacy = new Date(2026, 8, 17).toISOString().slice(0, 10);
  console.log('  info  the old toISOString() style gives "' + legacy + '" for local 17 Sep in this time zone');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed === 0 ? 0 : 1;
VIVA_EOF
echo "  wrote tests/cycleEngine.test.ts"


echo
echo "== Patching existing screens (each change is checked before it is made) =="
command -v python3 >/dev/null 2>&1 || { echo "python3 not found: skipping screen patches"; exit 1; }

python3 - "$BACKUP" << 'PYEOF2'
import os, shutil, sys

backup = sys.argv[1]
results = []

def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()

def write(path, text):
    if not os.path.exists(os.path.join(backup, path)):
        os.makedirs(os.path.dirname(os.path.join(backup, path)), exist_ok=True)
        shutil.copy(path, os.path.join(backup, path))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)

def replace(path, old, new, label):
    if not os.path.exists(path):
        results.append(("SKIP", path, label + " (file not found)")); return
    text = read(path)
    if old in text:
        write(path, text.replace(old, new))
        results.append(("OK", path, label))
    elif new in text:
        results.append(("DONE", path, label + " (already applied)"))
    else:
        results.append(("MISS", path, label + " (text not found - not changed)"))

def ensure_import(path, anchor, line, label):
    if not os.path.exists(path):
        results.append(("SKIP", path, label + " (file not found)")); return
    text = read(path)
    if line in text:
        results.append(("DONE", path, label + " (already present)")); return
    lines = text.split("\n")
    for i, l in enumerate(lines):
        if anchor in l and l.rstrip().endswith(";"):
            lines.insert(i + 1, line)
            write(path, "\n".join(lines))
            results.append(("OK", path, label)); return
    results.append(("MISS", path, label + " (anchor not found - not changed)"))

# --- Period Log: today's date was taken from UTC, which can be the wrong day
p = "app/period-log.tsx"
replace(p, "useState(new Date().toISOString().slice(0, 10))", "useState(getToday())", "period-log: local today")
ensure_import(p, "from '../constants/theme'", "import { getToday } from '../constants/dateUtils';", "period-log: import")

# --- Daily Tracking: week keys were built from UTC and came out a day early
p = "app/daily-tracking.tsx"
replace(p, "key: d.toISOString().slice(0, 10),", "key: dateToKey(d),", "daily-tracking: week day keys")
replace(p, "useState(centerDate.toISOString().slice(0, 10))", "useState(dateToKey(centerDate))", "daily-tracking: selected date")
replace(p, "useState(new Date(2026, 8, 17))", "useState(keyToLocalDate(getToday()))", "daily-tracking: opens on today")
ensure_import(p, "from '../constants/theme'", "import { dateToKey, getToday, keyToLocalDate } from '../constants/dateUtils';", "daily-tracking: import")

# --- Sexual Activity
p = "app/sexual-activity.tsx"
replace(p, "const date = new Date().toISOString().slice(0, 10);", "const date = getToday();", "sexual-activity: local today")
ensure_import(p, "from '../constants/theme'", "import { getToday } from '../constants/dateUtils';", "sexual-activity: import")

# --- Calendar: follow the real date instead of the fixed demo date
p = "app/(tabs)/calendar.tsx"
if os.path.exists(p):
    text = read(p)
    if "cycleState.today" in text:
        write(p, text.replace("cycleState.today", "getToday()"))
        results.append(("OK", p, "calendar: uses today's real date"))
    else:
        results.append(("DONE", p, "calendar: no fixed date left"))
ensure_import(p, "from '../../constants/theme'", "import { getToday } from '../../constants/dateUtils';", "calendar: import")

# --- Cycle Settings: the usual cycle length can now be 'not sure' (null)
p = "app/cycle-settings.tsx"
replace(p, "value: settings.cycleLength + ' days'", "value: settings.cycleLength === null ? 'Not sure' : settings.cycleLength + ' days'", "cycle-settings: row shows 'Not sure'")
replace(p, "settings[field] + delta", "(settings[field] ?? 28) + delta", "cycle-settings: stepper starts at 28")
replace(p, "{settings.cycleLength} days", "{settings.cycleLength === null ? 'Not sure' : settings.cycleLength + ' days'}", "cycle-settings: stepper label")

for status, path, label in results:
    print("  %-4s %s: %s" % (status, path, label))
PYEOF2

echo
echo "== Old calculation file =="
if [ -f constants/cycleDerive.ts ]; then
  USERS=$(grep -rl "cycleDerive" app components constants tests 2>/dev/null | grep -v "constants/cycleDerive.ts" || true)
  if [ -z "$USERS" ]; then
    mkdir -p "$BACKUP/constants"; cp constants/cycleDerive.ts "$BACKUP/constants/cycleDerive.ts"
    rm constants/cycleDerive.ts
    echo "  removed constants/cycleDerive.ts (nothing used it; it duplicated the engine with the old fertile window)"
  else
    echo "  kept constants/cycleDerive.ts, still used by: $USERS"
  fi
else
  echo "  not present"
fi

echo
echo "== Type check =="
if npx tsc --noEmit 2>&1 | head -30 | tee /tmp/tsc_out.txt | grep -q .; then
  echo "  tsc reported problems (above). Paste them to Claude. To undo: bash install_prompt2.sh restore"
else
  echo "  tsc: no errors"
fi

echo
echo "== Tests =="
for tz in Africa/Kampala America/Los_Angeles UTC; do
  printf "  %-22s" "$tz"
  TZ=$tz npx --yes tsx tests/cycleEngine.test.ts 2>&1 | grep -E "FAIL|passed," | tr '\n' ' '
  echo
done

echo
echo "Done. Backups of every changed file are in $BACKUP. Undo with: bash install_prompt2.sh restore"
