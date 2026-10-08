import { completedCycles, diffDays, isPlausibleCycleLength, PeriodLog } from '../lib/cycleEngine';
import type { DailyLog } from '../lib/vivaStore';
import { buildPeriodRecords } from '../lib/periodLength';
import { getToday } from './dateUtils';

export type CycleRecord = {
  month: string;                 // month the cycle started
  cycleLength: number;           // observed: start → next start (never from Settings)
  periodLength: number | null;   // recorded bleeding days (null if fewer than 2 recorded)
  fertileWindowLength: number;   // the engine's estimated window (6 days)
  symptoms: string[];
  moods: string[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One record per COMPLETED cycle in her confirmed history, oldest first.
 *  Uses the engine's rule: gaps outside 15–90 days (e.g. a forgotten log) are left out. */
export function buildCycleRecords(periods: PeriodLog[], dailyLogs: Record<string, DailyLog> = {}): CycleRecord[] {
  // Period length comes from the ONE calculation path (lib/periodLength.ts)
  const periodRecs = buildPeriodRecords(dailyLogs, getToday());
  return completedCycles(periods).filter((c) => isPlausibleCycleLength(c.length)).map((c) => {
    const logs = Object.values(dailyLogs).filter(
      (d) => diffDays(d.date, c.start) >= 0 && diffDays(c.nextStart, d.date) > 0
    );
    return {
      month: MONTHS[Number(c.start.slice(5, 7)) - 1],
      cycleLength: c.length,
      periodLength: (() => {
        const p = periodRecs.find((r) => r.start === c.start);
        return p && p.countsForAverage ? p.periodLength : null;
      })(), // logged bleeding days, never start-to-start
      fertileWindowLength: 6,
      symptoms: logs.flatMap((d) => d.symptoms ?? []),
      moods: logs.flatMap((d) => (d.mood ? [d.mood] : [])),
    };
  });
}
