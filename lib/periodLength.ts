// VIVA Cycle - Period Length + Calendar tracking card (pure: no React, no storage)
//
// Source of truth: the bleeding days she taps on the Calendar (Log Period sets Day 1).
// Period length = number of LOGGED bleeding days in a period. Never predicted dates,
// never cycle length, never days that were not logged, and never "she stopped because
// she didn't open the app".

import { addDays, diffDays } from './cycleEngine';
import type { DailyTrackingRecord } from './dailyTracking';
import { MIN_RECORDED_FOR_STATS, bleedingDates, cycleStartEpisodes, episodesFromLogs } from './periodTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'period'>>;

/** A period stays "in progress" until this many days after Day 1, unless the day after its
 *  last logged day is marked "no period" or a new period starts. */
export const PERIOD_TRACKING_WINDOW_DAYS = 10;
export const TYPICAL_PERIOD = { min: 2, max: 7 };

export type PeriodRecord = {
  start: string;          // Day 1 (first logged bleeding day)
  end: string;            // last logged day of the first unbroken run
  dates: string[];        // days of the first unbroken run
  recordedDays: number;   // length of the first unbroken run
  loggedInWindow: number; // every bleeding day logged for this period (gaps included)
  hasGap: boolean;        // bleeding logged again after a missing day -> incomplete
  periodLength: number | null; // logged bleeding days in one unbroken run (null when a day is missing)
  status: 'active' | 'completed';
  countsForAverage: boolean; // completed, no gap, at least 2 days logged
};

/** One record per period (the bleeding that starts each cycle), oldest first. */
export function buildPeriodRecords(logs: Logs, today: string): PeriodRecord[] {
  const starts = cycleStartEpisodes(episodesFromLogs(logs));
  const bleeding = bleedingDates(logs);
  return starts.map((ep, i) => {
    const next = starts[i + 1];
    const windowEnd = addDays(ep.start, PERIOD_TRACKING_WINDOW_DAYS - 1);
    const limit = next && next.start <= windowEnd ? addDays(next.start, -1) : windowEnd;
    const loggedInWindow = bleeding.filter((d) => d >= ep.start && d <= limit).length;
    const hasGap = loggedInWindow > ep.recordedDays;
    const markedEnded = logs[addDays(ep.end, 1)]?.period === 'no';
    const completed = !!next || markedEnded || diffDays(today, ep.start) >= PERIOD_TRACKING_WINDOW_DAYS;
    return {
      start: ep.start,
      end: ep.end,
      dates: ep.dates,
      recordedDays: ep.recordedDays,
      loggedInWindow,
      hasGap,
      periodLength: hasGap ? null : ep.recordedDays,
      status: completed ? 'completed' : 'active',
      countsForAverage: completed && !hasGap && ep.recordedDays >= MIN_RECORDED_FOR_STATS,
    };
  });
}

export type PeriodRangeKey = 'cycle' | '3m' | '6m' | '12m';

const pad = (n: number) => String(n).padStart(2, '0');

/** The same day n calendar months earlier (clamped to the end of shorter months). */
export function monthsBefore(date: string, n: number): string {
  let y = Number(date.slice(0, 4));
  let m = Number(date.slice(5, 7)) - n;
  while (m < 1) {
    m += 12;
    y--;
  }
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return y + '-' + pad(m) + '-' + pad(Math.min(Number(date.slice(8, 10)), daysInMonth));
}

/** This Cycle = the current cycle's period. 3/6/12 Months = periods that STARTED in that window. */
export function periodsInRange(all: PeriodRecord[], range: PeriodRangeKey, today: string): PeriodRecord[] {
  if (range === 'cycle') return all.length > 0 ? [all[all.length - 1]] : [];
  const from = monthsBefore(today, range === '3m' ? 3 : range === '6m' ? 6 : 12);
  return all.filter((p) => p.start >= from && p.start <= today);
}

/** Neutral wording only - describes the number, never a medical conclusion. */
export function periodRangeStatus(avg: number): { text: string; within: boolean } {
  if (avg < TYPICAL_PERIOD.min) return { text: 'Shorter than the typical range', within: false };
  if (avg > TYPICAL_PERIOD.max) return { text: 'Longer than the typical range', within: false };
  return { text: 'Within typical range', within: true };
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (k: string) => SHORT[Number(k.slice(5, 7)) - 1];
const monthDay = (k: string) => monthOf(k) + ' ' + Number(k.slice(8, 10));
const daysText = (n: number) => n + (n === 1 ? ' day' : ' days');
const bleedingDaysLogged = (n: number) => n + (n === 1 ? ' bleeding day logged' : ' bleeding days logged');

function formatAvg(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export type PeriodLengthView = {
  inRange: PeriodRecord[];
  counted: PeriodRecord[];
  active: PeriodRecord | null;
  average: number | null;
  averageText: string;
  withinRange: boolean | null;
  statusText: string;
  subtitle: string;
  notes: string[];
  chart: { label: string; value: number; current: boolean }[];
};

export function periodLengthView(all: PeriodRecord[], range: PeriodRangeKey, today: string): PeriodLengthView {
  const inRange = periodsInRange(all, range, today);
  const counted = inRange.filter((p) => p.countsForAverage);
  const active = inRange.find((p) => p.status === 'active') ?? null;
  const average = counted.length > 0
    ? Math.round((counted.reduce((s, p) => s + p.recordedDays, 0) / counted.length) * 10) / 10
    : null;
  const status = average === null ? null : periodRangeStatus(average);
  const notes: string[] = [];
  if (active) {
    notes.push('Tracking in progress: ' + bleedingDaysLogged(active.loggedInWindow) + ' so far');
    if (counted.length === 0) notes.push('Complete your bleeding-day tracking to calculate period length.');
  }
  if (counted.length === 1) notes.push('Based on 1 logged period. Log more periods to see your pattern.');
  else if (counted.length > 1) notes.push('Based on your last ' + counted.length + ' periods');
  // Bars: completed, logged periods only (never active or predicted days).
  // This Cycle: the current period may still be in progress, so - like the Cycle Length
  // card - the bars show her recent completed periods for context. Average is unchanged.
  const chartPeriods = range === 'cycle' ? all.filter((p) => p.countsForAverage).slice(-6) : counted;
  return {
    inRange,
    counted,
    active,
    average,
    averageText: average === null ? '—' : formatAvg(average) + (average === 1 ? ' day' : ' days'),
    withinRange: status ? status.within : null,
    statusText: status ? status.text : active ? 'Tracking in progress' : 'No completed period data yet',
    subtitle: inRange.length > 0 ? 'Your logged bleeding days' : 'Tap bleeding days on the Calendar to track your period length.',
    notes,
    chart: chartPeriods.map((p, i) => ({ label: monthOf(p.start), value: p.recordedDays, current: i === chartPeriods.length - 1 })),
  };
}

/** Rows for See Details, newest first. */
export function periodDetailRows(view: PeriodLengthView) {
  return [...view.inRange].reverse().map((p) => ({
    key: p.start,
    month: monthOf(p.start),
    dates: p.start === p.end && p.loggedInWindow === 1 ? monthDay(p.start) : monthDay(p.start) + ' – ' + monthDay(p.hasGap ? p.dates[p.dates.length - 1] : p.end),
    value: p.status === 'active'
      ? daysText(p.loggedInWindow) + ' so far'
      : p.hasGap
        ? daysText(p.loggedInWindow) + ' logged'
        : p.countsForAverage ? daysText(p.recordedDays) : '1 day logged',
    note: p.status === 'active'
      ? 'Tracking in progress - added to the average once it ends'
      : p.hasGap
        ? 'Has a missing day - not included in the average. Tap any day you bled on the Calendar.'
        : p.countsForAverage ? null : 'Not included in the average (only 1 day logged)',
  }));
}

// ---------- Calendar tracking card (shown only while it helps) ----------

export type CalendarCard =
  | { kind: 'start'; text: string }
  | { kind: 'tracking'; heading: string; text: string; started: string; logged: string; todayPrompt: string | null };

export function calendarTrackingCard(records: PeriodRecord[], logs: Logs, today: string): CalendarCard | null {
  if (records.length === 0) return { kind: 'start', text: 'Log your period to start tracking.' };
  const cur = records[records.length - 1];
  if (cur.status !== 'active') return null; // finished: the Calendar returns to normal
  const started = 'Started ' + monthDay(cur.start);
  const logged = bleedingDaysLogged(cur.loggedInWindow);
  const todayLogged = logs[today]?.period === 'yes';
  const todayPrompt = todayLogged ? null : 'Bleeding today? Tap today to record it.';
  if (records.length === 1 && cur.loggedInWindow === 1) {
    return { kind: 'tracking', heading: 'Track your period', text: 'Tap each day you have bleeding to record your period length.', started, logged, todayPrompt };
  }
  if (todayLogged) {
    return { kind: 'tracking', heading: 'Period tracking', text: 'Today is logged as a bleeding day.', started, logged, todayPrompt: null };
  }
  return { kind: 'tracking', heading: 'Track your period', text: 'Tap each day you have bleeding to record your period length.', started, logged, todayPrompt };
}
