import { useSyncExternalStore } from 'react';

// Daily logs and sexual activity only.
// Periods, setup answers and settings live in lib/vivaStore.ts (the single
// source of truth); predictions come from lib/cycleEngine.ts and are never stored.

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
  dailyLogs: Record<string, DailyLog>;
  sexualActivity: SexualActivityEntry[];
};

let state: CycleLog = {
  dailyLogs: {},
  sexualActivity: [],
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
