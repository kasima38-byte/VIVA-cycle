// VIVA Cycle - actual and predicted period days for the Year Overview
//
// Reuses the detailed Calendar's own rules: buildCalendarMonth() decides what is an actual
// period day (logged starts + tapped bleeding days) and what is a predicted period day
// (from the same calculateCycle() estimate the Calendar passes in). Each month is checked on
// its own, so a period running from one month into the next is marked in both.
// Actual always wins: a day is never shown as both actual and predicted.

import { buildCalendarMonth } from '../constants/calendarModel';
import { MONTH_NAMES } from './yearOverview';

type Periods = Parameters<typeof buildCalendarMonth>[2];
type Estimate = Parameters<typeof buildCalendarMonth>[3];
type Marks = Parameters<typeof buildCalendarMonth>[6];
const NO_ESTIMATE = null as unknown as Estimate; // logged data only

export type MonthMarks = {
  period: Set<number>;    // actual logged period days
  predicted: Set<number>; // predicted period days (never an actual day)
};

/** For each month (0-11): actual and predicted period day numbers, exactly as the Calendar shows them. */
export function yearCalendarMarks(year: number, periods: Periods, estimate: Estimate, marks: Marks, today: string): MonthMarks[] {
  return MONTH_NAMES.map((_, monthIndex) => {
    const cells = buildCalendarMonth(year, monthIndex, periods, estimate, [], today, marks).filter((c) => c.isCurrentMonth);
    const dayOf = (dateKey: string) => Number(dateKey.slice(8, 10));
    const period = new Set(cells.filter((c) => c.isPeriod).map((c) => dayOf(c.dateKey)));
    const predicted = new Set(cells.filter((c) => c.isPredictedPeriod && !c.isPeriod).map((c) => dayOf(c.dateKey)));
    return { period, predicted };
  });
}

/** Actual logged period days only (no estimate passed in). */
export function actualPeriodDaysByMonth(year: number, periods: Periods, marks: Marks, today: string): Set<number>[] {
  return yearCalendarMarks(year, periods, NO_ESTIMATE, marks, today).map((m) => m.period);
}
