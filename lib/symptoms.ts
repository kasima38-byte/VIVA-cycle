// VIVA Cycle - Symptom library
// The single source for every symptom shown anywhere. Records store only the stable `id`;
// labels are for display. Later features (custom symptoms, intensity, trends) extend this
// file, not the screens. IDs must never be renamed once released.

export type SymptomCategory = 'general' | 'pain' | 'digestive' | 'emotional' | 'other';

export const SYMPTOM_CATEGORIES: { id: SymptomCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'pain', label: 'Pain' },
  { id: 'digestive', label: 'Digestive' },
  { id: 'emotional', label: 'Emotional / Mental' },
  { id: 'other', label: 'Other' },
];

export type SymptomDefinition = {
  id: string;
  label: string;
  category: SymptomCategory;
  retired?: boolean; // no longer offered, but still shown where it was already recorded
};

export const SYMPTOMS: SymptomDefinition[] = [
  // General
  { id: 'fatigue', label: 'Fatigue', category: 'general' },
  { id: 'weakness', label: 'Weakness', category: 'general' },
  { id: 'dizziness', label: 'Dizziness', category: 'general' },
  { id: 'headache', label: 'Headache', category: 'general' },
  { id: 'migraine', label: 'Migraine', category: 'general' },
  // Pain
  { id: 'cramps', label: 'Cramps', category: 'pain' },
  { id: 'pelvicPain', label: 'Pelvic pain', category: 'pain' },
  { id: 'backPain', label: 'Back pain', category: 'pain' },
  { id: 'breastTenderness', label: 'Breast tenderness', category: 'pain' },
  { id: 'muscleAches', label: 'Muscle aches', category: 'pain' },
  // Digestive
  { id: 'bloating', label: 'Bloating', category: 'digestive' },
  { id: 'constipation', label: 'Constipation', category: 'digestive' },
  { id: 'diarrhea', label: 'Diarrhea', category: 'digestive' },
  { id: 'nausea', label: 'Nausea', category: 'digestive' },
  // Emotional / mental
  { id: 'irritability', label: 'Irritability', category: 'emotional' },
  { id: 'anxiety', label: 'Anxiety', category: 'emotional' },
  { id: 'stress', label: 'Stress', category: 'emotional' },
  { id: 'feelingLow', label: 'Feeling low', category: 'emotional' },
  // Other
  { id: 'acne', label: 'Acne', category: 'other' },
  { id: 'increasedAppetite', label: 'Increased appetite', category: 'other' },
  { id: 'decreasedAppetite', label: 'Decreased appetite', category: 'other' },
  { id: 'troubleSleeping', label: 'Trouble sleeping', category: 'other' },
  // Retired (from the first version of Daily Tracking)
  { id: 'cravings', label: 'Cravings', category: 'other', retired: true },
  { id: 'moodSwings', label: 'Mood swings', category: 'emotional', retired: true },
];

const INDEX = new Map(SYMPTOMS.map((s, i) => [s.id, i]));

export function isKnownSymptom(id: string): boolean {
  return INDEX.has(id);
}

export function symptomLabel(id: string): string {
  const i = INDEX.get(id);
  return i === undefined ? id : SYMPTOMS[i].label;
}

/** No duplicates, stable order (library order, unknown IDs last). */
export function normalizeSymptomIds(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.filter((x) => typeof x === 'string' && x.length > 0)));
  return unique.sort((a, b) => (INDEX.get(a) ?? 1e6) - (INDEX.get(b) ?? 1e6) || a.localeCompare(b));
}

/** Symptoms offered in a category. Retired ones appear only if already recorded. */
export function symptomsInCategory(category: SymptomCategory, recorded: string[] = []): SymptomDefinition[] {
  return SYMPTOMS.filter((s) => s.category === category && (!s.retired || recorded.includes(s.id)));
}

/** "Cramps · Bloating · Headache +2" */
export function symptomPreview(ids: string[], max = 3): string {
  const labels = ids.map(symptomLabel);
  const shown = labels.slice(0, max).join(' · ');
  return labels.length > max ? shown + ' +' + (labels.length - max) : shown;
}

/** For Insights: how many days each symptom was recorded (between from and to, inclusive). */
export function symptomFrequency(
  logs: Record<string, { symptoms: string[] | null }>, from?: string, to?: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of Object.keys(logs)) {
    if ((from && d < from) || (to && d > to)) continue;
    for (const id of logs[d]?.symptoms ?? []) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}
