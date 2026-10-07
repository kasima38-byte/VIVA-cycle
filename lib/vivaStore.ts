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
  addDays, applyPeriodCorrection, applyPeriodLog, applyPeriodRemoval, diffDays, todayLocal,
} from './cycleEngine';
import { DailyTrackingRecord, hasAnyData, normalizeRecord } from './dailyTracking';
import { PeriodChanges, derivePeriodLogs, episodesFromLogs } from './periodTracking';
import { isValidDateKey } from '../constants/dateUtils';

/** One day of Daily Tracking (her own entries). Full model: lib/dailyTracking.ts */
export type DailyLog = DailyTrackingRecord;

const STORAGE_KEY = 'viva-cycle:data';
const BACKUP_KEY = 'viva-cycle:data-backup'; // last copy that was read successfully
const SCHEMA_VERSION = 2; // 2: bleeding days are the stored period data

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

/** Every change to daily records goes through here, so the period start list
 *  (calculated from bleeding days) can never go stale. */
function updateDailyLogs(dailyLogs: Record<string, DailyLog>, extra: Partial<VivaData> = {}): Promise<boolean> {
  return update({ ...extra, dailyLogs, periods: derivePeriodLogs(dailyLogs) });
}

/** Set or clear the `period` field on some days. Every other answer on those days is kept. */
function withPeriodChanges(
  logs: Record<string, DailyLog>, changes: PeriodChanges, stamp: string | null
): Record<string, DailyLog> {
  const next = { ...logs };
  for (const [date, value] of Object.entries(changes)) {
    if (!isValidDateKey(date)) continue;
    const rec = normalizeRecord(date, next[date] ?? {});
    const updated: DailyLog = { ...rec, period: value, updatedAt: stamp ?? rec.updatedAt };
    if (hasAnyData(updated)) next[date] = updated;
    else delete next[date];
  }
  return next;
}

/** Version 1 stored periods as start dates. From version 2 the bleeding DAYS are the stored
 *  data and the start list is calculated from them. Each older period becomes its recorded
 *  day(s): start to end if an end was logged, otherwise just the start day. */
function periodData(version: unknown, oldPeriods: PeriodLog[], dailyLogs: Record<string, DailyLog>) {
  let logs = dailyLogs;
  if (typeof version !== 'number' || version < 2) {
    const changes: PeriodChanges = {};
    for (const p of oldPeriods) {
      const end = p.end && p.end >= p.start ? p.end : p.start;
      for (let d = p.start, n = 0; d <= end && n < 15; d = addDays(d, 1), n++) changes[d] = 'yes';
    }
    logs = withPeriodChanges(logs, changes, null);
  }
  return { dailyLogs: logs, periods: derivePeriodLogs(logs) };
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
    ...periodData(saved.version, sortPeriods(periods), parseDailyLogs(saved.dailyLogs)),
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
  // Her last period start becomes a recorded bleeding day; the start list is calculated from it
  const dailyLogs = withPeriodChanges(state.dailyLogs, { [input.lastPeriodStart]: 'yes' }, new Date().toISOString());
  void updateDailyLogs(dailyLogs, {
    setupComplete: true,
    name: input.name.trim(),
    dateOfBirth: input.dateOfBirth,
    baseline: input.baseline,
    goal: input.goal ?? state.goal,
  });
}

/** Log an ACTUAL period start (becomes Cycle Day 1 if it is the latest). Never changes other logs. */
export function logPeriod(start: DateStr): PeriodLogResult {
  const { result } = applyPeriodLog(state.periods, start);
  if (result.kind === 'added') {
    void updateDailyLogs(withPeriodChanges(state.dailyLogs, { [start]: 'yes' }, new Date().toISOString()));
  }
  return result;
}

/** Fix a wrongly entered start date: the old record is replaced, never duplicated. */
export function correctPeriodStart(oldStart: DateStr, newStart: DateStr): PeriodLogResult {
  const { result } = applyPeriodCorrection(state.periods, oldStart, newStart);
  if (result.kind === 'replaced') {
    // Move that period's recorded bleeding days by the same number of days (never into the future)
    const shift = diffDays(newStart, oldStart);
    const today = todayLocal();
    const episode = episodesFromLogs(state.dailyLogs).find((e) => e.start === oldStart);
    const days = episode ? episode.dates : [oldStart];
    const changes: PeriodChanges = {};
    days.forEach((d) => {
      changes[d] = null;
    });
    days.forEach((d) => {
      const moved = addDays(d, shift);
      if (moved <= today) changes[moved] = 'yes';
    });
    void updateDailyLogs(withPeriodChanges(state.dailyLogs, changes, new Date().toISOString()));
  }
  return result;
}

/** Delete a logged period (from Period History). Other records are untouched. */
export function removePeriod(start: DateStr): 'removed' | 'notFound' | 'lastOne' {
  const { result } = applyPeriodRemoval(state.periods, start);
  if (result.kind === 'removed') {
    // Clear every recorded bleeding day of that period (up to the next period start)
    const next = state.periods.map((p) => p.start).filter((s) => s > start).sort()[0];
    const changes: PeriodChanges = {};
    Object.keys(state.dailyLogs).forEach((d) => {
      if (d >= start && (!next || d < next) && state.dailyLogs[d].period === 'yes') changes[d] = null;
    });
    void updateDailyLogs(withPeriodChanges(state.dailyLogs, changes, new Date().toISOString()));
  }
  return result.kind;
}

/** Set or clear bleeding on several days at once (only the `period` field changes).
 *  Use lib/periodService.ts rather than calling this directly. */
export function applyPeriodChanges(changes: PeriodChanges): Promise<boolean> {
  if (!canSave) return Promise.resolve(false);
  return updateDailyLogs(withPeriodChanges(state.dailyLogs, changes, new Date().toISOString()));
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
  return updateDailyLogs(dailyLogs);
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
  return updateDailyLogs(rest);
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