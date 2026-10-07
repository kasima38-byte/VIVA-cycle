// VIVA Cycle - Daily Tracking settings model (pure)
// Settings control WHAT SHE SEES in Daily Tracking. They never change or delete what she recorded,
// and they never affect Insights. They are stored apart from the daily records.

import { DailyTrackingRecord, TRACKED_FIELDS, TrackedField, isTracked } from './dailyTracking';

export type DailyTrackingSettings = {
  periodEnabled: boolean;          // always true: the cycle, Calendar and Insights depend on it
  flowEnabled: boolean;
  symptomsEnabled: boolean;
  moodEnabled: boolean;
  energyEnabled: boolean;
  cervicalMucusEnabled: boolean;
  sexualActivityEnabled: boolean;
  medicationsEnabled: boolean;
};

export type SettingKey = keyof DailyTrackingSettings;

export const DEFAULT_TRACKING_SETTINGS: DailyTrackingSettings = {
  periodEnabled: true,
  flowEnabled: true,
  symptomsEnabled: true,
  moodEnabled: true,
  energyEnabled: true,
  cervicalMucusEnabled: true,
  sexualActivityEnabled: true,
  medicationsEnabled: true,
};

export const SETTING_FOR_FIELD: Record<TrackedField, SettingKey> = {
  period: 'periodEnabled',
  flow: 'flowEnabled',
  symptoms: 'symptomsEnabled',
  mood: 'moodEnabled',
  energy: 'energyEnabled',
  cervicalMucus: 'cervicalMucusEnabled',
  sexualActivity: 'sexualActivityEnabled',
  medications: 'medicationsEnabled',
};

/** Core categories can never be switched off. */
export const CORE_SETTINGS: SettingKey[] = ['periodEnabled'];

const KEYS = Object.keys(DEFAULT_TRACKING_SETTINGS) as SettingKey[];

export function isSettingKey(k: unknown): k is SettingKey {
  return typeof k === 'string' && (KEYS as string[]).includes(k);
}

/** Anything read from storage -> clean settings (unknown keys dropped, Period always on). */
export function normalizeSettings(raw: unknown): DailyTrackingSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_TRACKING_SETTINGS };
  for (const k of KEYS) {
    if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  }
  for (const k of CORE_SETTINGS) out[k] = true;
  return out;
}

export function isFieldVisible(s: DailyTrackingSettings, field: TrackedField): boolean {
  return s[SETTING_FOR_FIELD[field]];
}

export function visibleFields(s: DailyTrackingSettings): TrackedField[] {
  return TRACKED_FIELDS.filter((f) => isFieldVisible(s, f));
}

/** "3 of 7 categories tracked" - counts only categories that are switched on, each once. */
export function trackingProgress(
  record: DailyTrackingRecord, s: DailyTrackingSettings
): { count: number; total: number; state: 'empty' | 'partial' | 'complete' } {
  const fields = visibleFields(s);
  const count = fields.filter((f) => isTracked(record, f)).length;
  const state = count === 0 ? 'empty' : count === fields.length ? 'complete' : 'partial';
  return { count, total: fields.length, state };
}
