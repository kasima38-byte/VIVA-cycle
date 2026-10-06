import { useSyncExternalStore } from 'react';
import { DailyLog, saveDailyLog as saveDailyLogToStore } from '../lib/vivaStore';

// Daily Tracking entries are SAVED in lib/vivaStore.ts (they survive restarts).
// Sexual activity is not an approved VIVA feature: it stays in memory only.

export type { DailyLog };

export type SexualActivityEntry = {
  date: string;
  hadActivity: boolean;
};

type SexLog = { sexualActivity: SexualActivityEntry[] };

let state: SexLog = { sexualActivity: [] };

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

export function getCycleLog(): SexLog {
  return state;
}

export function useCycleLog(): SexLog {
  return useSyncExternalStore(subscribe, getCycleLog);
}

export function saveDailyLog(date: string, patch: Partial<DailyLog>) {
  saveDailyLogToStore(date, patch);
}

export function saveSexualActivity(date: string, hadActivity: boolean) {
  const others = state.sexualActivity.filter((e) => e.date !== date);
  state = { ...state, sexualActivity: [...others, { date, hadActivity }] };
  notify();
}
