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
