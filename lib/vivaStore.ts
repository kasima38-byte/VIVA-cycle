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
  applyPeriodCorrection, applyPeriodLog, applyPeriodRemoval, createInitialLogs,
} from './cycleEngine';
import { DailyTrackingRecord, hasAnyData, normalizeRecord } from './dailyTracking';
import { isValidDateKey } from '../constants/dateUtils';

/** One day of Daily Tracking (her own entries). Full model: lib/dailyTracking.ts */
export type DailyLog = DailyTrackingRecord;

const STORAGE_KEY = 'viva-cycle:data';
const BACKUP_KEY = 'viva-cycle:data-backup'; // last copy that was read successfully
const SCHEMA_VERSION = 1;

export interface VivaData {
  version: number;
  setupComplete: boolean;
  name: string;
  dateOfBirth: DateStr | null;
  baseline: CycleBaseline;
  goal: Goal | null;     // null until she chooses one
  periods: PeriodLog[];  // confirmed periods, oldest → newest
  dailyLogs: Record<string, DailyLog>; // Daily Tracking entries by date
  reminders: Record<string, boolean>;  // Notification switches (all off until she turns one on)
}

export interface VivaState extends VivaData {
  loaded: boolean;       // false until saved data has been read from the phone
  loadError: boolean;    // true if saved data exists but could not be read: saving is blocked
}

const EMPTY: VivaData = {
  version: SCHEMA_VERSION,
  setupComplete: false,
  name: '',
  dateOfBirth: null,
  baseline: { cycleLength: null, periodLength: null, regularity: 'not_sure' },
  goal: null,
  periods: [],
  dailyLogs: {},
  reminders: {},
};

let state: VivaState = { ...EMPTY, loaded: false, loadError: false };

// Saving is only allowed after a SUCCESSFUL read (or when nothing was saved yet).
// This stops a failed/corrupted read from leading to her history being overwritten.
let canSave = false;

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

// Writes run one after another, so an older save can never land after a newer one.
let writeChain: Promise<unknown> = Promise.resolve();

/** Resolves true only once the data is really on the phone. */
function persist(): Promise<boolean> {
  if (!canSave) return Promise.resolve(false);
  const { loaded: _loaded, loadError: _loadError, ...data } = state;
  const json = JSON.stringify(data);
  const write = writeChain.then(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (e) {
      console.warn('VIVA: could not save data', e);
      return false;
    }
  });
  writeChain = write;
  return write;
}

function update(patch: Partial<VivaData>): Promise<boolean> {
  state = { ...state, ...patch };
  emit();
  return persist();
}

let loading: Promise<void> | null = null;

/** Clean every saved Daily Tracking day. The date KEY is the record's identity,
 *  so one date can only ever hold one record. Older entries are upgraded. */
function parseDailyLogs(raw: unknown): Record<string, DailyLog> {
  const out: Record<string, DailyLog> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidDateKey(key)) continue;
    const record = normalizeRecord(key, value);
    if (hasAnyData(record)) out[key] = record;
  }
  return out;
}

/** Parse saved JSON and keep only well-formed values. Throws if it is not a saved profile. */
function parseSaved(raw: string): VivaData {
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.periods)) throw new Error('not a VIVA profile');
  const isDate = (d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const periods: PeriodLog[] = saved.periods
    .filter((p: any) => p && isDate(p.start))
    .map((p: any) => (isDate(p.end) ? { start: p.start, end: p.end } : { start: p.start }));
  return {
    ...EMPTY,
    ...saved,
    baseline: { ...EMPTY.baseline, ...(saved.baseline ?? {}) },
    periods: sortPeriods(periods),
    dailyLogs: parseDailyLogs(saved.dailyLogs),
    reminders: saved.reminders && typeof saved.reminders === 'object' && !Array.isArray(saved.reminders) ? saved.reminders : {},
    version: SCHEMA_VERSION,
  };
}

/** Read saved data from the phone. Safe to call more than once. */
export function loadVivaStore(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === null) {
          // Nothing saved yet: a genuinely new user
          state = { ...EMPTY, loaded: true, loadError: false };
        } else {
          state = { ...parseSaved(raw), loaded: true, loadError: false };
          AsyncStorage.setItem(BACKUP_KEY, raw).catch(() => {});
        }
        canSave = true;
      } catch (e) {
        console.warn('VIVA: could not load data', e);
        // Try the last good copy before giving up
        try {
          const backup = await AsyncStorage.getItem(BACKUP_KEY);
          if (backup === null) throw new Error('no backup');
          state = { ...parseSaved(backup), loaded: true, loadError: false };
          canSave = true;
        } catch {
          // Do NOT continue as a new user: block saving and let her retry
          state = { ...EMPTY, loaded: true, loadError: true };
          canSave = false;
        }
      }
      emit();
    })();
  }
  return loading;
}

/** Try reading saved data again (after a load error). */
export function retryLoadVivaStore(): Promise<void> {
  loading = null;
  state = { ...state, loaded: false };
  emit();
  return loadVivaStore();
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

/** Delete a logged period (from Period History). Other records are untouched. */
export function removePeriod(start: DateStr): 'removed' | 'notFound' | 'lastOne' {
  const { result, logs } = applyPeriodRemoval(state.periods, start);
  if (result.kind === 'removed') update({ periods: logs });
  return result.kind;
}

/** Turn one reminder on or off. */
export function setReminder(key: string, on: boolean) {
  update({ reminders: { ...state.reminders, [key]: on } });
}

/** Replace one day's Daily Tracking record (never duplicated: the date is the key).
 *  A day with every answer cleared is removed. Resolves true once it is on the phone. */
export function putDailyLog(record: DailyLog): Promise<boolean> {
  if (!canSave || !isValidDateKey(record.date)) return Promise.resolve(false);
  const clean = normalizeRecord(record.date, record);
  const dailyLogs = { ...state.dailyLogs };
  if (hasAnyData(clean)) dailyLogs[clean.date] = { ...clean, updatedAt: new Date().toISOString() };
  else delete dailyLogs[clean.date];
  return update({ dailyLogs });
}

/** Merge a few answers into one day (kept for older callers). */
export function saveDailyLog(date: DateStr, patch: Partial<DailyLog>): Promise<boolean> {
  const existing = state.dailyLogs[date] ?? normalizeRecord(date, {});
  return putDailyLog({ ...existing, ...patch, date });
}

/** Delete one day's Daily Tracking record. */
export function removeDailyLog(date: DateStr): Promise<boolean> {
  if (!canSave) return Promise.resolve(false);
  if (!(date in state.dailyLogs)) return Promise.resolve(true);
  const { [date]: _removed, ...rest } = state.dailyLogs;
  return update({ dailyLogs: rest });
}

/** Settings change: affects future predictions only, never period history. */
export function updateBaseline(patch: Partial<CycleBaseline>) {
  update({ baseline: { ...state.baseline, ...patch } });
}

export function setGoal(goal: Goal | null) {
  update({ goal });
}

/** Personal details. Never affect cycle calculations. */
export function setName(name: string) {
  update({ name: name.trim() });
}

export function setDateOfBirth(dateOfBirth: DateStr | null) {
  update({ dateOfBirth });
}

/** For testing: wipe all saved data and return to the Welcome screen. */
export async function resetVivaStore() {
  state = { ...EMPTY, loaded: true, loadError: false };
  canSave = true;
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('VIVA: could not clear data', e);
  }
}