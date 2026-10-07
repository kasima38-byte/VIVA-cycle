// VIVA Cycle - Period tracking model (pure: no React, no storage)
//
// SOURCE OF TRUTH: the `period` field of each day's Daily Tracking record.
//   'yes' = PERIOD      (a recorded bleeding day)
//   'no'  = NOT_PERIOD  (she explicitly said no)
//   null  = UNTRACKED   (never read as "no period")
//
// Everything below is CALCULATED from those days and never stored separately:
//   bleeding days -> episodes (consecutive days) -> day number, recorded length
//   episodes      -> cycle starts (the PeriodLog list used by the engine, calendar, reminders)
//
// Period length = recorded bleeding days in an episode. Cycle length (start to next start)
// is a different measurement and lives in lib/cycleEngine.ts.

import { addDays, diffDays, MIN_DAYS_BETWEEN_PERIODS, PeriodLog } from './cycleEngine';
import type { DailyTrackingRecord, FlowValue } from './dailyTracking';

type Logs = Record<string, Pick<DailyTrackingRecord, 'period'>>;

export type PeriodDayStatus = 'period' | 'notPeriod' | 'untracked';

export type PeriodEpisode = {
  id: string;            // its start date
  start: string;         // first recorded bleeding day (the period start date)
  end: string;           // LAST RECORDED bleeding day - not a claim that bleeding ended
  dates: string[];
  recordedDays: number;
};

/** Changes applied by the store: set or clear bleeding on specific days. */
export type PeriodChanges = Record<string, 'yes' | 'no' | null>;

export function bleedingDates(logs: Logs): string[] {
  return Object.keys(logs).filter((d) => logs[d]?.period === 'yes').sort();
}

export function notPeriodDates(logs: Logs): string[] {
  return Object.keys(logs).filter((d) => logs[d]?.period === 'no').sort();
}

/** Consecutive bleeding days form one episode. A gap always starts a new episode. */
export function buildEpisodes(dates: string[]): PeriodEpisode[] {
  const sorted = Array.from(new Set(dates)).sort();
  const out: PeriodEpisode[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && addDays(last.end, 1) === d) {
      last.dates.push(d);
      last.end = d;
      last.recordedDays++;
    } else {
      out.push({ id: d, start: d, end: d, dates: [d], recordedDays: 1 });
    }
  }
  return out;
}

export function episodesFromLogs(logs: Logs): PeriodEpisode[] {
  return buildEpisodes(bleedingDates(logs));
}

/** An episode starts a NEW CYCLE only if it begins at least MIN_DAYS_BETWEEN_PERIODS
 *  after the previous cycle start (the engine's own rule). Closer episodes - for
 *  example bleeding again after a one-day gap - stay in the same cycle. */
export function cycleStartEpisodes(episodes: PeriodEpisode[]): PeriodEpisode[] {
  const out: PeriodEpisode[] = [];
  for (const ep of episodes) {
    const prev = out[out.length - 1];
    if (!prev || diffDays(ep.start, prev.start) >= MIN_DAYS_BETWEEN_PERIODS) out.push(ep);
  }
  return out;
}

/** The period-start list the cycle engine reads. No end dates: bleeding facts come from the days themselves. */
export function derivePeriodLogs(logs: Logs): PeriodLog[] {
  return cycleStartEpisodes(episodesFromLogs(logs)).map((ep) => ({ start: ep.start }));
}

export type PeriodDayInfo = {
  date: string;
  status: PeriodDayStatus;
  episode: PeriodEpisode | null;
  dayNumber: number | null;  // day within the bleeding episode, not the cycle day
};

export function periodInfoOn(logs: Logs, date: string): PeriodDayInfo {
  const value = logs[date]?.period ?? null;
  if (value !== 'yes') {
    return { date, status: value === 'no' ? 'notPeriod' : 'untracked', episode: null, dayNumber: null };
  }
  const episode = episodesFromLogs(logs).find((e) => e.start <= date && date <= e.end) ?? null;
  return { date, status: 'period', episode, dayNumber: episode ? diffDays(date, episode.start) + 1 : null };
}

/** For the calendar: recorded bleeding days, days she explicitly marked as no period, and each
 *  day's recorded flow / spotting (so spotting can be shown apart from period days). */
export function bleedingMarks(logs: Record<string, Pick<DailyTrackingRecord, 'period' | 'flow'>>): {
  period: Set<string>;
  notPeriod: Set<string>;
  flow: Record<string, FlowValue>;
} {
  const flow: Record<string, FlowValue> = {};
  for (const d of Object.keys(logs)) {
    const f = logs[d]?.flow;
    if (f) flow[d] = f;
  }
  return { period: new Set(bleedingDates(logs)), notPeriod: new Set(notPeriodDates(logs)), flow };
}

export function rangeDates(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------- Period length data for Insights ----------

/** A single recorded day is treated as not enough information for length stats. */
export const MIN_RECORDED_FOR_STATS = 2;

export type PeriodLengthEntry = {
  start: string;         // period start date
  end: string;           // last recorded bleeding day
  recordedDays: number;  // bleeding days recorded in this period
  isLatest: boolean;     // the most recent period may still be in progress
};

/** One entry per period (the episode that starts each cycle), oldest first. */
export function periodLengthHistory(logs: Logs): PeriodLengthEntry[] {
  const starts = cycleStartEpisodes(episodesFromLogs(logs));
  return starts.map((ep, i) => ({
    start: ep.start,
    end: ep.end,
    recordedDays: ep.recordedDays,
    isLatest: i === starts.length - 1,
  }));
}

export type PeriodLengthStats = {
  count: number;
  average: number | null;
  shortest: number | null;
  longest: number | null;
  recent: number | null;  // most recent period that is no longer the latest
};

/** Stats over earlier periods only, each with at least MIN_RECORDED_FOR_STATS recorded days. */
export function periodLengthStats(history: PeriodLengthEntry[]): PeriodLengthStats {
  const usable = history
    .filter((h) => !h.isLatest && h.recordedDays >= MIN_RECORDED_FOR_STATS)
    .map((h) => h.recordedDays);
  if (usable.length === 0) return { count: 0, average: null, shortest: null, longest: null, recent: null };
  const sum = usable.reduce((a, b) => a + b, 0);
  return {
    count: usable.length,
    average: Math.round((sum / usable.length) * 10) / 10,
    shortest: Math.min(...usable),
    longest: Math.max(...usable),
    recent: usable[usable.length - 1],
  };
}

/** Recorded length of the period that starts a cycle, or null if too little was recorded. */
export function recordedPeriodLength(logs: Logs, cycleStart: string): number | null {
  const ep = episodesFromLogs(logs).find((e) => e.start === cycleStart);
  return ep && ep.recordedDays >= MIN_RECORDED_FOR_STATS ? ep.recordedDays : null;
}
