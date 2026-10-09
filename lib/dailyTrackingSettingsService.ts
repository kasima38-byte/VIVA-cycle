// VIVA Cycle - Daily Tracking settings service
// Stored under its own key, completely apart from the daily records.
// Changing a setting never touches recorded data.

// Encrypted like every VIVA value (lib/secureStorage.ts)
import AsyncStorage from './secureStorage';
import { useSyncExternalStore } from 'react';
import {
  CORE_SETTINGS, DEFAULT_TRACKING_SETTINGS, DailyTrackingSettings, isSettingKey, normalizeSettings,
} from './dailyTrackingSettings';
import { SETTINGS_KEY } from './dailyStorage';
const SETTINGS_VERSION = 1;

export type SettingsResult =
  | 'saved'       // written to the phone
  | 'unchanged'   // already like that
  | 'invalid'     // unknown setting, or not true/false
  | 'notAllowed'  // core category (Period) can't be switched off
  | 'failed';     // the phone could not save - the setting goes back

type State = { settings: DailyTrackingSettings; loaded: boolean };

let state: State = { settings: { ...DEFAULT_TRACKING_SETTINGS }, loaded: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getSettings(): DailyTrackingSettings {
  return state.settings;
}

export function useTrackingSettings(): State {
  return useSyncExternalStore(subscribe, () => state);
}

let loading: Promise<void> | null = null;

/** Read settings once at start-up. Unreadable settings fall back to the defaults (visibility only). */
export function loadTrackingSettings(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      let settings = { ...DEFAULT_TRACKING_SETTINGS };
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) settings = normalizeSettings(JSON.parse(raw));
      } catch {
        console.warn('VIVA: could not read tracking settings - using defaults');
      }
      state = { settings, loaded: true };
      emit();
    })();
  }
  return loading;
}

let chain: Promise<unknown> = Promise.resolve();
let paused = false; // true while "Delete all my data" runs: nothing may be written

function write(next: DailyTrackingSettings): Promise<SettingsResult> {
  if (paused) return Promise.resolve('failed');
  const previous = state.settings;
  state = { ...state, settings: next };
  emit();
  const p = chain.then(async (): Promise<SettingsResult> => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...next, schemaVersion: SETTINGS_VERSION }));
      return 'saved';
    } catch {
      console.warn('VIVA: could not save tracking settings');
      if (state.settings === next) {
        state = { ...state, settings: previous };
        emit();
      }
      return 'failed';
    }
  });
  chain = p;
  return p;
}

const same = (a: DailyTrackingSettings, b: DailyTrackingSettings) => JSON.stringify(a) === JSON.stringify(b);

export async function updateSettings(changes: Record<string, unknown>): Promise<SettingsResult> {
  for (const [k, v] of Object.entries(changes)) {
    if (!isSettingKey(k) || typeof v !== 'boolean') return 'invalid';
    if (CORE_SETTINGS.includes(k) && v === false) return 'notAllowed';
  }
  const next = normalizeSettings({ ...state.settings, ...changes });
  if (same(next, state.settings)) return 'unchanged';
  return write(next);
}

export function updateSetting(key: string, value: unknown): Promise<SettingsResult> {
  return updateSettings({ [key]: value });
}

/** Back to the defaults. Recorded data is never touched. */
export async function resetSettings(): Promise<SettingsResult> {
  if (same(state.settings, DEFAULT_TRACKING_SETTINGS)) return 'unchanged';
  return write({ ...DEFAULT_TRACKING_SETTINGS });
}

// ---------- Used only by lib/dataDeletionService.ts ----------

/** Stop saving settings and wait for any save already under way. */
export async function pauseSettingsWrites(): Promise<void> {
  paused = true;
  await chain.catch(() => {});
}

/** After every VIVA key was deleted: back to the defaults in memory. Nothing is written,
 *  so the phone keeps no settings key until she changes a setting again. */
export function resetSettingsAfterDeletion(): void {
  state = { settings: { ...DEFAULT_TRACKING_SETTINGS }, loaded: true };
  loading = Promise.resolve();
  paused = false;
  emit();
}

/** After a delete that failed or was partial: show what is really still saved. */
export async function reloadSettingsAfterFailedDeletion(): Promise<void> {
  paused = false;
  loading = null;
  await loadTrackingSettings();
}
