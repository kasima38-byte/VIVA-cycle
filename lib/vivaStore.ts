// VIVA Cycle — saved app data (single source of truth)
//
// Stores ONLY what the user told us or confirmed:
//   setup answers (name, date of birth, baseline, goal) + confirmed period logs.
// Predictions are never stored. Screens get them from calculateCycle()
// in lib/cycleEngine.ts, so a prediction can never become "confirmed".

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import {
  CycleBaseline, DateStr, Goal, PeriodLog, PeriodLogResult,
  applyPeriodCorrection, applyPeriodLog, createInitialLogs,
} from './cycleEngine';

const STORAGE_KEY = 'viva-cycle:data';
const SCHEMA_VERSION = 1;

export interface VivaData {
  version: number;
  setupComplete: boolean;
  name: string;
  dateOfBirth: DateStr | null;
  baseline: CycleBaseline;
  goal: Goal | null;     // null until she chooses one
  periods: PeriodLog[];  // confirmed periods, oldest → newest
}

export interface VivaState extends VivaData {
  loaded: boolean;       // false until saved data has been read from the phone
}

const EMPTY: VivaData = {
  version: SCHEMA_VERSION,
  setupComplete: false,
  name: '',
  dateOfBirth: null,
  baseline: { cycleLength: null, periodLength: null, regularity: 'not_sure' },
  goal: null,
  periods: [],
};

let state: VivaState = { ...EMPTY, loaded: false };

// ---------- Subscriptions ----------

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVivaState(): VivaState {
  return state;
}

export function useVivaStore(): VivaState {
  return useSyncExternalStore(subscribe, getVivaState);
}

// ---------- Saving & loading ----------

async function persist() {
  const { loaded: _loaded, ...data } = state;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('VIVA: could not save data', e);
  }
}

function update(patch: Partial<VivaData>) {
  state = { ...state, ...patch };
  emit();
  void persist();
}

let loading: Promise<void> | null = null;

/** Read saved data from the phone. Safe to call more than once. */
export function loadVivaStore(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved: Partial<VivaData> = raw ? JSON.parse(raw) : {};
        state = { ...EMPTY, ...saved, version: SCHEMA_VERSION, loaded: true };
      } catch (e) {
        console.warn('VIVA: could not load data', e);
        state = { ...state, loaded: true };
      }
      emit();
    })();
  }
  return loading;
}

// ---------- Actions ----------

const sortPeriods = (logs: PeriodLog[]) => [...logs].sort((a, b) => a.start.localeCompare(b.start));

export interface SetupInput {
  name: string;
  dateOfBirth: DateStr | null;
  lastPeriodStart: DateStr;
  baseline: CycleBaseline;
  goal?: Goal | null;
}

/** Finish onboarding. Her last period start becomes the first confirmed log. */
export function completeSetup(input: SetupInput) {
  const already = state.periods.some((p) => p.start === input.lastPeriodStart);
  const periods = already
    ? state.periods
    : sortPeriods([...state.periods, ...createInitialLogs(input.lastPeriodStart)]);
  update({
    setupComplete: true,
    name: input.name.trim(),
    dateOfBirth: input.dateOfBirth,
    baseline: input.baseline,
    goal: input.goal ?? state.goal,
    periods,
  });
}

/** Log an ACTUAL period start (becomes Cycle Day 1 if it is the latest). Never changes other logs. */
export function logPeriod(start: DateStr): PeriodLogResult {
  const { result, logs } = applyPeriodLog(state.periods, start);
  if (result.kind === 'added') update({ periods: logs });
  return result;
}

/** Fix a wrongly entered start date: the old record is replaced, never duplicated. */
export function correctPeriodStart(oldStart: DateStr, newStart: DateStr): PeriodLogResult {
  const { result, logs } = applyPeriodCorrection(state.periods, oldStart, newStart);
  if (result.kind === 'replaced') update({ periods: logs });
  return result;
}

/** Settings change: affects future predictions only, never period history. */
export function updateBaseline(patch: Partial<CycleBaseline>) {
  update({ baseline: { ...state.baseline, ...patch } });
}

export function setGoal(goal: Goal | null) {
  update({ goal });
}

/** For testing: wipe all saved data and return to the Welcome screen. */
export async function resetVivaStore() {
  state = { ...EMPTY, loaded: true };
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('VIVA: could not clear data', e);
  }
}