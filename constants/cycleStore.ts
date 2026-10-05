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
