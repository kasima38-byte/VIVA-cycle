// Calendar display helpers only. All cycle dates come from lib/cycleEngine.ts
// (the old demo data and demo calculations that used to live here were removed).

export type DayInfo = {
  dateKey: string; // "YYYY-MM-DD"
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  isSexLogged: boolean;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(year: number, monthIndex: number) {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

export function formatLongDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}
