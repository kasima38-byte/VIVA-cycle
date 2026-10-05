import { useSyncExternalStore } from 'react';

export type Goal = 'conceive' | 'avoid' | null;

export type Settings = {
  goal: Goal;
  cycleLength: number; // typical length, used until enough periods are logged
  periodLength: number;
};

let settings: Settings = {
  goal: null,
  cycleLength: 28,
  periodLength: 5,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}