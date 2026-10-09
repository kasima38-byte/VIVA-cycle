// VIVA Cycle - how Daily Tracking records are laid out on the phone
//
//   viva-cycle:data           profile, settings, and the list of months that have records
//   viva-cycle:data-backup    last copy of viva-cycle:data that was read successfully
//   viva-cycle:daily:YYYY-MM  that month's records, keyed by date
//   viva-cycle:damaged:YYYY-MM  an unreadable month, set aside untouched
//   viva-cycle:journal        exists only while a multi-key write is in progress
//   viva-cycle:daily-tracking-settings  which Daily Tracking cards are shown
//   viva-cycle:encryption     encryption state ({version, state}); holds no personal data
//
// Every value except viva-cycle:encryption is stored ENCRYPTED (lib/secureStorage.ts).
//
// Every key VIVA Cycle owns starts with APP_KEY_PREFIX. "Delete all my data" relies on that,
// so any new key MUST use the prefix too.
//
// Saving one day rewrites only its month - never the whole history.
// Every stored record carries schemaVersion so future changes can be migrated safely.

export const APP_KEY_PREFIX = 'viva-cycle:';
export const DATA_KEY = 'viva-cycle:data';
export const BACKUP_KEY = 'viva-cycle:data-backup';
export const DAY_PREFIX = 'viva-cycle:daily:';
export const JOURNAL_KEY = 'viva-cycle:journal';
export const DAMAGED_PREFIX = 'viva-cycle:damaged:';
export const SETTINGS_KEY = 'viva-cycle:daily-tracking-settings';
export const ENCRYPTION_MARKER_KEY = 'viva-cycle:encryption';

/** True for keys that belong to VIVA Cycle (never another app's or library's data). */
export function isAppKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(APP_KEY_PREFIX);
}

/** Version of each stored daily record. Bump it and add a step below when the shape changes. */
export const RECORD_SCHEMA_VERSION = 1;

type RawRecord = Record<string, unknown>;

// One step per version: RECORD_MIGRATIONS[n] upgrades a version-n record to n+1.
// Never drop data in a migration - only rename, convert or add.
const RECORD_MIGRATIONS: Record<number, (r: RawRecord) => RawRecord> = {
  // 0 -> 1: records saved before monthly storage. Older IDs (veryLow, eggWhite, single-word
  // sexual activity, medication chips) are converted when the record is read, so nothing to rename.
  0: (r) => r,
};

/** Upgrade a stored record to the current version (schemaVersion is removed in memory). */
export function migrateRecord(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  let r: RawRecord = { ...(raw as RawRecord) };
  let v = typeof r.schemaVersion === 'number' ? r.schemaVersion : 0;
  while (v < RECORD_SCHEMA_VERSION && RECORD_MIGRATIONS[v]) {
    r = RECORD_MIGRATIONS[v](r);
    v++;
  }
  delete r.schemaVersion;
  return r;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isMonthKey(m: unknown): m is string {
  return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

/** Group records by month and turn each month into the exact text stored on the phone. */
export function serializeMonths(logs: Record<string, object>): Map<string, string> {
  const groups = new Map<string, RawRecord>();
  for (const d of Object.keys(logs).sort()) {
    const m = monthOf(d);
    let g = groups.get(m);
    if (!g) {
      g = {};
      groups.set(m, g);
    }
    g[d] = { ...logs[d], schemaVersion: RECORD_SCHEMA_VERSION };
  }
  const out = new Map<string, string>();
  groups.forEach((g, m) => out.set(m, JSON.stringify(g)));
  return out;
}

/** Every "YYYY-MM" from start's month to end's month, inclusive. */
export function monthsBetween(start: string, end: string): string[] {
  let [y, m] = start.slice(0, 7).split('-').map(Number);
  const [ey, em] = end.slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  while (y < ey || (y === ey && m <= em)) {
    out.push(y + '-' + String(m).padStart(2, '0'));
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
