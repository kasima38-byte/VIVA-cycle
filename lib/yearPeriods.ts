// VIVA Cycle - actual logged period days for the Year Overview
//
// Reuses the detailed Calendar's own rule: buildCalendarMonth() decides what is an actual
// period day (logged starts + tapped bleeding days). Each month is checked on its own,
// so a period running from one month into the next is marked in both.
// No cycle estimate is passed in, so this never shows anything that was not logged.

import { buildCalendarMonth } from '../constants/calendarModel';
import { MONTH_NAMES } from './yearOverview';

type Periods = Parameters<typeof buildCalendarMonth>[2];
type Marks = Parameters<typeof buildCalendarMonth>[6];
const NO_ESTIMATE = null as unknown as Parameters<typeof buildCalendarMonth>[3]; // logged data only

/** For each month (0-11): the day numbers that are actual logged period days. */
export function actualPeriodDaysByMonth(year: number, periods: Periods, marks: Marks, today: string): Set<number>[] {
  return MONTH_NAMES.map((_, monthIndex) => {
    const cells = buildCalendarMonth(year, monthIndex, periods, NO_ESTIMATE, [], today, marks);
    return new Set(
      cells.filter((c) => c.isCurrentMonth && c.isPeriod).map((c) => Number(c.dateKey.slice(8, 10)))
    );
  });
}
