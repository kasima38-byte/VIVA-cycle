// VIVA Cycle - Period Length for Insights (pure: no React, no storage)
//
// Source of truth: the bleeding days she taps on the Calendar (Log Period sets day 1).
// Period length = number of LOGGED bleeding days in a period. Never predicted dates,
// never cycle length, never days that were not logged.

import { addDays, diffDays } from './cycleEngine';
import type { DailyTrackingRecord } from './dailyTracking';
import { MIN_RECORDED_FOR_STATS, cycleStartEpisodes, episodesFromLogs } from './periodTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'period'>>;

/** A period counts as finished once this many full days after its last logged bleeding day
 *  have passed with nothing logged (or the next day is marked "no period", or a new period starts). */
export const PERIOD_END_GRACE_DAYS = 1;
export const TYPICAL_PERIOD = { min: 2, max: 7 };

export type PeriodRecord = {
  start: string;         // Day 1 (first logged bleeding day)
  end: string;           // last logged bleeding day
  dates: string[];       // every logged bleeding day
  recordedDays: number;  // period length in logged days
  status: 'active' | 'completed';
  countsForAverage: boolean; // completed and at least 2 days logged
};

/** One record per period (the bleeding run that starts each cycle), oldest first. */
export function buildPeriodRecords(logs: Logs, today: string): PeriodRecord[] {
  const starts = cycleStartEpisodes(episodesFromLogs(logs));
  return starts.map((ep, i) => {
    const nextStarted = !!starts[i + 1];
    const markedEnded = logs[addDays(ep.end, 1)]?.period === 'no';
    const timePassed = diffDays(today, ep.end) > PERIOD_END_GRACE_DAYS;
    const completed = nextStarted || markedEnded || timePassed;
    return {
      start: ep.start,
      end: ep.end,
      dates: ep.dates,
      recordedDays: ep.recordedDays,
      status: completed ? 'completed' : 'active',
      countsForAverage: completed && ep.recordedDays >= MIN_RECORDED_FOR_STATS,
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
  if (active) notes.push('Current period: ' + daysText(active.recordedDays) + ' logged so far');
  if (counted.length === 1) notes.push('Based on 1 logged period. Log more periods to see your pattern.');
  else if (counted.length > 1) notes.push('Based on your last ' + counted.length + ' periods');
  return {
    inRange,
    counted,
    active,
    average,
    averageText: average === null ? '—' : formatAvg(average) + (average === 1 ? ' day' : ' days'),
    withinRange: status ? status.within : null,
    statusText: status ? status.text : 'No completed period data yet',
    subtitle: inRange.length > 0 ? 'Your logged bleeding days' : 'Tap bleeding days on the Calendar to track your period length.',
    notes,
    chart: counted.map((p, i) => ({ label: monthOf(p.start), value: p.recordedDays, current: i === counted.length - 1 })),
  };
}

/** Rows for See Details, newest first. */
export function periodDetailRows(view: PeriodLengthView) {
  return [...view.inRange].reverse().map((p) => ({
    key: p.start,
    month: monthOf(p.start),
    dates: p.start === p.end ? monthDay(p.start) : monthDay(p.start) + ' – ' + monthDay(p.end),
    value: p.status === 'active' ? daysText(p.recordedDays) + ' so far' : p.countsForAverage ? daysText(p.recordedDays) : '1 day logged',
    note: p.status === 'active'
      ? 'Current period - added to the average once it ends'
      : p.countsForAverage ? null : 'Not included in the average (only 1 day logged)',
  }));
}
