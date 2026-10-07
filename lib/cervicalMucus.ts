// VIVA Cycle - Cervical mucus observations (the one central list)
// These are what she OBSERVED. They are stored as structured data only;
// nothing in the app draws conclusions from a single observation.

export type MucusValue = 'dry' | 'sticky' | 'creamy' | 'watery' | 'egg_white' | 'other';

export type MucusObservation = {
  id: MucusValue;       // stored value - never rename once released
  label: string;        // shown in the sheet
  cardLabel: string;    // shown on the small card
  description: string;  // one plain-language line
};

export const MUCUS_OBSERVATIONS: MucusObservation[] = [
  { id: 'dry', label: 'Dry', cardLabel: 'Dry', description: 'Little or no noticeable cervical mucus.' },
  { id: 'sticky', label: 'Sticky', cardLabel: 'Sticky', description: 'Thick or tacky mucus.' },
  { id: 'creamy', label: 'Creamy', cardLabel: 'Creamy', description: 'Smooth, lotion-like mucus.' },
  { id: 'watery', label: 'Watery', cardLabel: 'Watery', description: 'Thin and watery mucus.' },
  { id: 'egg_white', label: 'Egg-white', cardLabel: 'Egg-white', description: 'Clear, slippery and stretchy mucus.' },
  { id: 'other', label: 'Unusual / Other', cardLabel: 'Other', description: 'Something different from the options above.' },
];

/** Optional note, only with "Unusual / Other". */
export const MUCUS_NOTE_MAX = 120;

export function isMucusValue(v: unknown): v is MucusValue {
  return MUCUS_OBSERVATIONS.some((o) => o.id === v);
}

export function normalizeMucusNote(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, MUCUS_NOTE_MAX).trim();
  return t.length > 0 ? t : null;
}
