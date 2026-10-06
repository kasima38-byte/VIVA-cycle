import { completedCycles, diffDays, PeriodLog } from '../lib/cycleEngine';
import { DailyLog } from './cycleStore';

export type CycleRecord = {
  month: string;                 // month the cycle started
  cycleLength: number;           // observed: start → next start (never from Settings)
  periodLength: number | null;   // observed only when an end date was logged
  fertileWindowLength: number;   // the engine's estimated window (6 days)
  symptoms: string[];
  moods: string[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** One record per COMPLETED cycle in her confirmed history, oldest first. */
export function buildCycleRecords(periods: PeriodLog[], dailyLogs: Record<string, DailyLog> = {}): CycleRecord[] {
  return completedCycles(periods).map((c) => {
    const log = periods.find((p) => p.start === c.start);
    const logs = Object.values(dailyLogs).filter(
      (d) => diffDays(d.date, c.start) >= 0 && diffDays(c.nextStart, d.date) > 0
    );
    return {
      month: MONTHS[Number(c.start.slice(5, 7)) - 1],
      cycleLength: c.length,
      periodLength: log?.end ? diffDays(log.end, log.start) + 1 : null,
      fertileWindowLength: 6,
      symptoms: logs.flatMap((d) => d.symptoms ?? []),
      moods: logs.flatMap((d) => (d.mood ? [d.mood] : [])),
    };
  });
}
