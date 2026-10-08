// VIVA Cycle - Year Overview calendar logic (pure: no React, no storage)
// Every month is generated from real date logic - nothing is hard-coded.
// Weeks start on Monday, matching the detailed Calendar.

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Mini calendars always show 6 week rows so every card in the grid is the same height. */
export const MINI_WEEK_ROWS = 6;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month (monthIndex 0-11). Uses UTC so the phone's time zone can't shift it. */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Blank cells before day 1 in a Monday-first week. */
export function mondayLead(year: number, monthIndex: number): number {
  return (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
}

export type MiniMonth = {
  year: number;
  monthIndex: number; // 0-11 - kept so cycle data can be linked to this month later
  name: string;
  days: number;
  weeks: (number | null)[][]; // MINI_WEEK_ROWS rows of 7; null = blank cell
};

/** One month, generated from its real year and month. */
export function buildMiniMonth(year: number, monthIndex: number): MiniMonth {
  const days = daysInMonth(year, monthIndex);
  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayLead(year, monthIndex); i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length < MINI_WEEK_ROWS * 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, monthIndex, name: MONTH_NAMES[monthIndex], days, weeks };
}

export function buildYearOverview(year: number): MiniMonth[] {
  return MONTH_NAMES.map((_, monthIndex) => buildMiniMonth(year, monthIndex));
}

/** The year passed to the screen, or the fallback when missing or not a sensible year. */
export function parseYearParam(raw: string | string[] | undefined, fallback: number): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value >= 1900 && value <= 2200 ? value : fallback;
}
