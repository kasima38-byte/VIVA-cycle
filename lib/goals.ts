// VIVA Cycle - the goals she can choose (ONE list for the whole app).
// Used by Cycle Settings, My Health Goals and My Data. The saved value lives in the canonical
// store (lib/vivaStore.ts `goal`); there is no other goal setting.
//
// Rules (product decisions):
//  - every goal uses the SAME cycle engine and the same dates; a goal only changes what is shown
//    and how guidance is worded. Changing it never touches period history;
//  - wording says "estimated", "may", "potentially": never "safe day", never a guarantee of
//    pregnancy or of no pregnancy, never a diagnosis.

import type { Goal } from './cycleEngine';

export type GoalOption = {
  key: Goal;
  label: string;
  detail: string;    // one line, as in Cycle Settings
  changes: string;   // what this goal changes in the app (My Health Goals)
};

export const GOAL_OPTIONS: GoalOption[] = [
  {
    key: 'understand',
    label: 'Understand my cycle',
    detail: 'Learn how your cycle works.',
    changes:
      'Home explains the phase your cycle is estimated to be in. Fertile-window and ovulation estimates are not ' +
      'shown on Home, but stay in Calendar and the Fertility screen.',
  },
  {
    key: 'track',
    label: 'Track my cycle',
    detail: 'Keep a record of your periods and patterns.',
    changes:
      'Home focuses on your cycle day and next estimated period. Fertile-window and ovulation estimates are not ' +
      'shown on Home, but stay in Calendar and the Fertility screen.',
  },
  {
    key: 'conceive',
    label: 'Try to get pregnant',
    detail: 'Focus on your estimated fertile window and timing.',
    changes:
      'Home shows your estimated fertile window and ovulation, with guidance on timing. These are calendar ' +
      'estimates: pregnancy is never guaranteed.',
  },
  {
    key: 'avoid',
    label: 'Avoid pregnancy',
    detail: 'Focus on days that may be fertile. Estimates are not contraception.',
    changes:
      'Home shows the days when pregnancy may be possible, with guidance. A calendar estimate is not ' +
      'contraception and should not be your only method.',
  },
];

export const GOALS: Goal[] = GOAL_OPTIONS.map((o) => o.key);

export function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOALS as string[]).includes(value);
}

/** Label for any saved value, including none or an unknown one. */
export function goalLabel(goal: unknown): string {
  return GOAL_OPTIONS.find((o) => o.key === goal)?.label ?? 'Not set';
}

/** Home shows the fertile-window and ovulation estimates only for the two fertility goals.
 *  Not set (older data): shown, as before goals existed. Calendar and Fertility show them always. */
export function showsFertilityEstimatesOnHome(goal: Goal | null): boolean {
  return goal === null || goal === 'conceive' || goal === 'avoid';
}

/** The "Trying to conceive?" card on the Fertility screen is hidden for "Avoid pregnancy". */
export function showsConceptionCard(goal: Goal | null): boolean {
  return goal !== 'avoid';
}

/** What she sees after choosing a goal. "Saved" only when it really was saved. */
export function goalSaveMessage(saved: boolean, goal: Goal): { kind: 'error' | 'info'; text: string } {
  return saved
    ? { kind: 'info', text: 'Saved. Your goal is now "' + goalLabel(goal) + '".' }
    : { kind: 'error', text: "We couldn't save your goal, so it hasn't changed. Please try again." };
}
