import { useSyncExternalStore } from 'react';
import { cycleState as initialCycleState } from './cycleData';

export type PeriodEntry = {
  date: string; // YYYY-MM-DD, first day of period
  flowIntensity?: 'light' | 'medium' | 'heavy' | 'spotting';
};

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

export type CycleLog = {
  periods: PeriodEntry[]; // sorted ascending by date
  dailyLogs: Record<string, DailyLog>; // keyed by date
  sexualActivity: SexualActivityEntry[];
  cycleLength: number;
  periodLength: number;
};

// Seeded from the existing demo data so Calendar/Home/Insights don't go blank.
let state: CycleLog = {
  periods: [
    { date: '2026-08-09' },
    { date: initialCycleState.periodDays[0] },
  ],
  dailyLogs: {},
  sexualActivity: initialCycleState.sexEvents.map((date) => ({ date, hadActivity: true })),
  cycleLength: initialCycleState.cycleLength,
  periodLength: initialCycleState.periodLength,
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

export function logPeriodStart(date: string, flowIntensity?: PeriodEntry['flowIntensity']) {
  const existing = state.periods.find((p) => p.date === date);
  let periods: PeriodEntry[];
  if (existing) {
    periods = state.periods.map((p) => (p.date === date ? { ...p, flowIntensity } : p));
  } else {
    periods = [...state.periods, { date, flowIntensity }].sort((a, b) => a.date.localeCompare(b.date));
  }
  state = { ...state, periods };
  notify();
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