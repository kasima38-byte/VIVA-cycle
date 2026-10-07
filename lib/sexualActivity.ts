// VIVA Cycle - Sexual activity: central options and data shape (pure, private)
// Not tracked = null on the day's record. "No activity" is only ever her explicit answer.
// Nothing in the app draws conclusions from this data.

export type SexualActivityStatus = 'none' | 'activity';
export type ProtectionStatus = 'used' | 'not_used' | 'prefer_not_to_say';

/** One entry. protection: null = not recorded (never guessed). */
export type SexualActivityEntry = { protection: ProtectionStatus | null };

/** 'none' has no entries; 'activity' has at least one (the simple UI edits the first). */
export type SexualActivity = { status: SexualActivityStatus; entries: SexualActivityEntry[] };

export const SEXUAL_ACTIVITY_STATUS_OPTIONS: { id: SexualActivityStatus; label: string }[] = [
  { id: 'none', label: 'No activity' },
  { id: 'activity', label: 'Sexual activity' },
];

export const PROTECTION_OPTIONS: { id: ProtectionStatus; label: string }[] = [
  { id: 'used', label: 'Protection used' },
  { id: 'not_used', label: 'Protection not used' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const MAX_ENTRIES_PER_DAY = 10;

export function isActivityStatus(v: unknown): v is SexualActivityStatus {
  return v === 'none' || v === 'activity';
}

export function isProtection(v: unknown): v is ProtectionStatus {
  return v === 'used' || v === 'not_used' || v === 'prefer_not_to_say';
}

function protectionOf(v: unknown): ProtectionStatus | null {
  return isProtection(v) ? v : null;
}

/** Anything read from storage -> a clean value (older single-word values included). */
export function normalizeSexualActivity(raw: unknown): SexualActivity | null {
  if (raw === 'none') return { status: 'none', entries: [] };
  if (raw === 'protected') return { status: 'activity', entries: [{ protection: 'used' }] };
  if (raw === 'unprotected') return { status: 'activity', entries: [{ protection: 'not_used' }] };
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.status === 'none') return { status: 'none', entries: [] };
  if (r.status !== 'activity') return null;
  let entries: SexualActivityEntry[] = Array.isArray(r.entries)
    ? r.entries.slice(0, MAX_ENTRIES_PER_DAY).map((e) => ({
        protection: protectionOf(e && typeof e === 'object' ? (e as Record<string, unknown>).protection : null),
      }))
    : [{ protection: protectionOf(r.protection) }];
  if (entries.length === 0) entries = [{ protection: null }];
  return { status: 'activity', entries };
}

/** Protection of the first entry (what the simple UI shows). */
export function primaryProtection(sa: SexualActivity | null): ProtectionStatus | null {
  return sa && sa.status === 'activity' ? sa.entries[0]?.protection ?? null : null;
}

/** Build the value the simple UI saves. Extra entries (if any) are kept untouched. */
export function buildSexualActivity(
  status: SexualActivityStatus | null, protection: ProtectionStatus | null, existing: SexualActivity | null
): SexualActivity | null {
  if (status === null) return null;
  if (status === 'none') return { status: 'none', entries: [] };
  const rest = existing && existing.status === 'activity' ? existing.entries.slice(1) : [];
  return { status: 'activity', entries: [{ protection }, ...rest] };
}

// ---------- Data for optional future Insights (no conclusions) ----------

type Logs = Record<string, { sexualActivity: SexualActivity | null }>;

function inRange(d: string, from?: string, to?: string): boolean {
  return !(from && d < from) && !(to && d > to);
}

/** Days with recorded activity, in date order. */
export function sexualActivityDates(logs: Logs, from?: string, to?: string): string[] {
  return Object.keys(logs)
    .filter((d) => logs[d]?.sexualActivity?.status === 'activity' && inRange(d, from, to))
    .sort();
}

export function sexualActivityCounts(logs: Logs, from?: string, to?: string) {
  const protection: Record<ProtectionStatus | 'not_recorded', number> = {
    used: 0, not_used: 0, prefer_not_to_say: 0, not_recorded: 0,
  };
  let activityDays = 0;
  let noActivityDays = 0;
  let entries = 0;
  for (const d of Object.keys(logs)) {
    const sa = logs[d]?.sexualActivity;
    if (!sa || !inRange(d, from, to)) continue;
    if (sa.status === 'none') {
      noActivityDays++;
      continue;
    }
    activityDays++;
    for (const e of sa.entries) {
      entries++;
      protection[e.protection ?? 'not_recorded']++;
    }
  }
  return { activityDays, noActivityDays, entries, protection };
}
