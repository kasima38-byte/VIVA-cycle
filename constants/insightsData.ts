export type CycleRecord = {
  month: string;
  cycleLength: number;
  periodLength: number;
  fertileWindowLength: number;
  symptoms: string[];
  moods: string[];
};

// Demo history (Oct 2025 - Sep 2026). Replace with real saved logs later.
export const cycleHistory: CycleRecord[] = [
  { month: 'Oct', cycleLength: 28, periodLength: 5, fertileWindowLength: 5, symptoms: ['cramps', 'fatigue'], moods: ['good', 'okay'] },
  { month: 'Nov', cycleLength: 29, periodLength: 4, fertileWindowLength: 5, symptoms: ['cramps', 'headache'], moods: ['great', 'good'] },
  { month: 'Dec', cycleLength: 27, periodLength: 5, fertileWindowLength: 5, symptoms: ['bloating'], moods: ['okay', 'good'] },
  { month: 'Jan', cycleLength: 28, periodLength: 5, fertileWindowLength: 5, symptoms: ['cramps', 'bloating'], moods: ['good', 'good'] },
  { month: 'Feb', cycleLength: 29, periodLength: 4, fertileWindowLength: 5, symptoms: ['headache'], moods: ['great', 'okay'] },
  { month: 'Mar', cycleLength: 28, periodLength: 5, fertileWindowLength: 5, symptoms: ['cramps'], moods: ['good', 'low'] },
  { month: 'Apr', cycleLength: 27, periodLength: 4, fertileWindowLength: 5, symptoms: ['cramps', 'bloating'], moods: ['good', 'great'] },
  { month: 'May', cycleLength: 29, periodLength: 5, fertileWindowLength: 5, symptoms: ['cramps', 'headache'], moods: ['okay', 'good'] },
  { month: 'Jun', cycleLength: 28, periodLength: 4, fertileWindowLength: 5, symptoms: ['bloating'], moods: ['good', 'good'] },
  { month: 'Jul', cycleLength: 28, periodLength: 5, fertileWindowLength: 5, symptoms: ['cramps', 'bloating'], moods: ['great', 'good'] },
  { month: 'Aug', cycleLength: 30, periodLength: 4, fertileWindowLength: 5, symptoms: ['headache', 'cramps'], moods: ['okay', 'good'] },
  { month: 'Sep', cycleLength: 28, periodLength: 5, fertileWindowLength: 5, symptoms: ['cramps', 'bloating'], moods: ['good', 'great'] },
];