// VIVA Cycle - Medication entries (pure: no React, no storage)
// Records what she says she took. Nothing here recommends, calculates doses,
// or guesses why a medication was taken.

export type MedicationEntry = {
  id: string;           // stable: editing updates this entry, never duplicates it
  name: string;         // required
  dose: string | null;  // e.g. "400" (kept apart from the unit)
  unit: string | null;  // e.g. "mg", "tablet"
  time: string | null;  // 24-hour "HH:MM"; shown in the phone's own format
  note: string | null;  // short, belongs only to this entry
};

export const MEDICATION_LIMITS = { name: 60, dose: 20, unit: 20, note: 120, entriesPerDay: 20 };

/** Quick picks for the unit field - any text is still allowed. */
export const UNIT_SUGGESTIONS = ['mg', 'mL', 'tablet', 'capsule', 'drops'];

// Chips from the first version of Daily Tracking, converted to named entries
const LEGACY_NAMES: Record<string, string> = {
  painRelief: 'Pain relief',
  birthControl: 'Birth control',
  vitamins: 'Vitamins / supplements',
  iron: 'Iron',
  other: 'Other',
};

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return t.length > 0 ? t : null;
}

export function normalizeTime(v: unknown): string | null {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

export function timeFromDate(d: Date): string {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function newMedicationId(): string {
  return 'med_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function normalizeMedicationEntry(raw: unknown, fallbackId: string): MedicationEntry | null {
  const L = MEDICATION_LIMITS;
  if (typeof raw === 'string') {
    const name = cleanText(LEGACY_NAMES[raw] ?? raw, L.name);
    return name ? { id: fallbackId, name, dose: null, unit: null, time: null, note: null } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = cleanText(r.name, L.name);
  if (!name) return null;
  const id = typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 64 ? r.id : fallbackId;
  return {
    id,
    name,
    dose: cleanText(r.dose, L.dose),
    unit: cleanText(r.unit, L.unit),
    time: normalizeTime(r.time),
    note: cleanText(r.note, L.note),
  };
}

/** Clean list for one date. No entries = null (Not tracked) - never an empty list. */
export function normalizeMedications(raw: unknown, date: string): MedicationEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MedicationEntry[] = [];
  const seen = new Set<string>();
  raw.slice(0, MEDICATION_LIMITS.entriesPerDay).forEach((item, i) => {
    const e = normalizeMedicationEntry(item, 'med_' + date + '_' + i); // stable ID for older entries
    if (e && !seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  });
  return out.length > 0 ? out : null;
}

export function formatDose(e: Pick<MedicationEntry, 'dose' | 'unit'>): string | null {
  const parts = [e.dose, e.unit].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

/** "10:30" -> "10:30 AM" (or the phone's own format). */
export function formatTime(hhmm: string | null): string | null {
  if (!hhmm || !normalizeTime(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Ibuprofen, 400 mg, 10:30 AM" - for screen readers inside the sheet. */
export function describeMedication(e: MedicationEntry): string {
  return [e.name, formatDose(e), formatTime(e.time)].filter(Boolean).join(', ');
}

// ---------- Data for optional future Insights (no conclusions) ----------

type Logs = Record<string, { medications: MedicationEntry[] | null }>;

function inRange(d: string, from?: string, to?: string): boolean {
  return !(from && d < from) && !(to && d > to);
}

/** Each medication (matched by name, ignoring case) with how many days and entries it was recorded. */
export function medicationFrequency(logs: Logs, from?: string, to?: string) {
  const map = new Map<string, { name: string; days: number; entries: number }>();
  for (const d of Object.keys(logs).sort()) {
    if (!inRange(d, from, to)) continue;
    const seenToday = new Set<string>();
    for (const e of logs[d]?.medications ?? []) {
      const key = e.name.toLowerCase();
      const row = map.get(key) ?? { name: e.name, days: 0, entries: 0 };
      row.entries++;
      if (!seenToday.has(key)) {
        row.days++;
        seenToday.add(key);
      }
      map.set(key, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name));
}

/** Dates on which a medication (by name, ignoring case) was recorded. */
export function medicationDates(logs: Logs, name: string, from?: string, to?: string): string[] {
  const key = name.toLowerCase();
  return Object.keys(logs)
    .filter((d) => inRange(d, from, to) && (logs[d]?.medications ?? []).some((e) => e.name.toLowerCase() === key))
    .sort();
}
