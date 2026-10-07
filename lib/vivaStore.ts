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
import { DAMAGED_PREFIX, DAY_PREFIX, JOURNAL_KEY, isMonthKey, migrateRecord, serializeMonths } from './dailyStorage';
import { isValidDateKey } from '../constants/dateUtils';

/** One day of Daily Tracking (her own entries). Full model: lib/dailyTracking.ts */
export type DailyLog = DailyTrackingRecord;

const STORAGE_KEY = 'viva-cycle:data';
const BACKUP_KEY = 'viva-cycle:data-backup'; // last copy that was read successfully
const SCHEMA_VERSION = 3; // 2: bleeding days are the period data; 3: daily records stored one key per month

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

// What is really on the phone (updated only after a successful write).
// If a write fails, the screen goes back to this - nothing unsaved ever looks saved.
let savedData: VivaData | null = null;
let savedCore: string | null = null;           // profile text on the phone
let savedMonths = new Map<string, string>();   // month -> records text on the phone

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

/** Writes only what changed: the month(s) of the changed day(s), and the profile if it changed.
 *  Several keys go through a journal, so an interrupted write is finished on the next launch
 *  (all of the change, never half). Resolves true only once it is really on the phone. */
function persist(): Promise<boolean> {
  if (!canSave) return Promise.resolve(false);
  const { loaded: _loaded, loadError: _loadError, ...data } = state;
  const { dailyLogs, ...core } = data;
  const months = serializeMonths(dailyLogs);
  const coreJson = JSON.stringify({
    ...core,
    version: SCHEMA_VERSION,
    layout: 'monthly',
    dailyMonths: Array.from(months.keys()),
  });
  const write = writeChain.then(async () => {
    const sets: [string, string][] = [];
    const removes: string[] = [];
    months.forEach((json, m) => {
      if (savedMonths.get(m) !== json) sets.push([DAY_PREFIX + m, json]);
    });
    savedMonths.forEach((_json, m) => {
      if (!months.has(m)) removes.push(DAY_PREFIX + m);
    });
    if (coreJson !== savedCore) sets.push([STORAGE_KEY, coreJson]); // index last
    try {
      const several = sets.length + removes.length > 1;
      if (several) await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify({ sets, removes }));
      for (const [k, v] of sets) await AsyncStorage.setItem(k, v);
      for (const k of removes) await AsyncStorage.removeItem(k);
      if (several) await AsyncStorage.removeItem(JOURNAL_KEY);
      savedCore = coreJson;
      savedMonths = months;
      savedData = data;
      return true;
    } catch {
      console.warn('VIVA: could not save data'); // never log the data itself
      return false;
    }
  });
  writeChain = write;
  return write;
}

function update(patch: Partial<VivaData>): Promise<boolean> {
  const after = { ...state, ...patch };
  state = after;
  emit();
  return persist().then((ok) => {
    // Failed write: show what is really saved again (unless a newer change already replaced it)
    if (!ok && state === after && savedData) {
      state = { ...state, ...savedData };
      emit();
    }
    return ok;
  });
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
    const updated: DailyLog = { ...rec, period: value, createdAt: rec.createdAt ?? stamp, updatedAt: stamp ?? rec.updatedAt };
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
function parseSaved(raw: string, extraLogs: Record<string, unknown> = {}): VivaData {
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
    ...periodData(saved.version, sortPeriods(periods), parseDailyLogs({
      ...(saved.dailyLogs && typeof saved.dailyLogs === 'object' && !Array.isArray(saved.dailyLogs) ? saved.dailyLogs : {}),
      ...extraLogs,
    })),
    reminders: saved.reminders && typeof saved.reminders === 'object' && !Array.isArray(saved.reminders) ? saved.reminders : {},
    version: SCHEMA_VERSION,
  };
}

/** A write interrupted last time (app closed or phone died) is finished now: all of it. */
async function finishInterruptedWrite(): Promise<void> {
  const journal = await AsyncStorage.getItem(JOURNAL_KEY);
  if (journal === null) return;
  try {
    const { sets, removes } = JSON.parse(journal) as { sets: [string, string][]; removes: string[] };
    for (const [k, v] of sets) await AsyncStorage.setItem(k, v);
    for (const k of removes) await AsyncStorage.removeItem(k);
  } catch {
    // An unreadable journal means the write never started: the previous data is intact
  }
  await AsyncStorage.removeItem(JOURNAL_KEY);
}

/** Read every month listed in the profile. A month that can't be read is set aside untouched
 *  (never deleted) and everything else still loads. */
async function readMonths(coreRaw: string | null): Promise<{ logs: Record<string, unknown>; raw: Map<string, string>; monthly: boolean }> {
  const logs: Record<string, unknown> = {};
  const raw = new Map<string, string>();
  let months: string[] = [];
  let monthly = false;
  try {
    const core = coreRaw ? JSON.parse(coreRaw) : null;
    monthly = !!core && core.layout === 'monthly';
    if (core && Array.isArray(core.dailyMonths)) months = core.dailyMonths.filter(isMonthKey);
  } catch {
    return { logs, raw, monthly }; // an unreadable profile is handled by the caller
  }
  for (const m of months) {
    const text = await AsyncStorage.getItem(DAY_PREFIX + m);
    if (text === null) continue;
    try {
      const bucket = JSON.parse(text);
      if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) throw new Error('unreadable month');
      for (const [d, r] of Object.entries(bucket)) {
        if (d.slice(0, 7) === m) logs[d] = migrateRecord(r);
      }
      raw.set(m, text);
    } catch {
      await AsyncStorage.setItem(DAMAGED_PREFIX + m, text).catch(() => {});
    }
  }
  return { logs, raw, monthly };
}

/** Read saved data from the phone. Safe to call more than once. */
export function loadVivaStore(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      let raw: string | null = null;
      let monthLogs: Record<string, unknown> = {};
      let layoutMonthly = false;
      try {
        await finishInterruptedWrite();
        raw = await AsyncStorage.getItem(STORAGE_KEY);
        const months = await readMonths(raw);
        monthLogs = months.logs;
        savedMonths = months.raw;
        layoutMonthly = months.monthly;
        if (raw === null) {
          // Nothing saved yet: a genuinely new user
          state = { ...EMPTY, loaded: true, loadError: false };
        } else {
          state = { ...parseSaved(raw, monthLogs), loaded: true, loadError: false };
          savedCore = layoutMonthly ? raw : null;
          AsyncStorage.setItem(BACKUP_KEY, raw).catch(() => {});
        }
        canSave = true;
      } catch (e) {
        console.warn('VIVA: could not load saved data'); // never log the data itself
        // Try the last good copy before giving up
        try {
          const backup = await AsyncStorage.getItem(BACKUP_KEY);
          if (backup === null) throw new Error('no backup');
          const backupMonths = await readMonths(backup);
          savedMonths = backupMonths.raw;
          state = { ...parseSaved(backup, backupMonths.logs), loaded: true, loadError: false };
          canSave = true;
        } catch {
          // Do NOT continue as a new user: block saving and let her retry
          state = { ...EMPTY, loaded: true, loadError: true };
          canSave = false;
        }
      }
      if (canSave) {
        const { loaded: _l, loadError: _e, ...data } = state;
        savedData = data;
        // Finish any migration or repair: writes only the months that differ
        if (raw !== null) void persist();
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

/** Remove everything recorded in Daily Tracking EXCEPT period days (the cycle history).
 *  Only the explicit confirmation in Daily Tracking Settings calls this. */
export function clearTrackingDataKeepPeriods(): Promise<boolean> {
  if (!canSave) return Promise.resolve(false);
  const now = new Date().toISOString();
  const next: Record<string, DailyLog> = {};
  for (const [date, rec] of Object.entries(state.dailyLogs)) {
    if (rec.period === null) continue;
    next[date] = { ...normalizeRecord(date, { date, period: rec.period }), createdAt: rec.createdAt, updatedAt: now };
  }
  return updateDailyLogs(next);
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
  const now = new Date().toISOString();
  if (hasAnyData(clean)) {
    dailyLogs[clean.date] = { ...clean, createdAt: state.dailyLogs[clean.date]?.createdAt ?? now, updatedAt: now };
  }
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
  savedData = { ...EMPTY };
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    for (const m of savedMonths.keys()) await AsyncStorage.removeItem(DAY_PREFIX + m);
    await AsyncStorage.removeItem(JOURNAL_KEY);
    savedMonths = new Map();
    savedCore = null;
  } catch (e) {
    console.warn('VIVA: could not clear saved data'); // never log the data itself
  }
}