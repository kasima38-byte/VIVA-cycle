export type DayInfo = {
  dateKey: string; // "2026-09-26"
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  isSexLogged: boolean;
};

export const cycleState = {
  today: '2026-09-26',
  periodDays: ['2026-09-05', '2026-09-06', '2026-09-07'],
  fertileWindow: { start: '2026-09-15', end: '2026-09-19' },
  ovulationDate: '2026-09-17',
  sexEvents: ['2026-09-15', '2026-09-18'],
  nextPeriod: '2026-10-05',
  cycleLength: 28,
  periodLength: 5,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(year: number, monthIndex: number) {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function isInFertileWindow(dateKey: string, fertileWindow: { start: string; end: string }) {
  return dateKey >= fertileWindow.start && dateKey <= fertileWindow.end;
}

/**
 * Builds a Mon–Sun grid for the given month, including the trailing days
 * of the previous month and leading days of the next month needed to
 * fill complete weeks.
 */
export type CycleOverrides = {
  today?: string;
  periodDays?: string[];
  fertileWindow?: { start: string; end: string };
  ovulationDate?: string;
  sexEvents?: string[];
};

export function buildMonthGrid(year: number, monthIndex: number, overrides?: CycleOverrides): DayInfo[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  // JS getDay(): 0=Sun..6=Sat. Convert to Mon=0..Sun=6.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

  const total = daysInMonth(year, monthIndex);
  const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const prevYear = monthIndex === 0 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonthIndex);

  const cells: DayInfo[] = [];

  // Leading days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevTotal - i;
    const dateKey = toDateKey(prevYear, prevMonthIndex, day);
    cells.push(makeDayInfo(dateKey, day, false, overrides));
  }

  // Days of current month
  for (let day = 1; day <= total; day++) {
    const dateKey = toDateKey(year, monthIndex, day);
    cells.push(makeDayInfo(dateKey, day, true, overrides));
  }

  // Trailing days from next month, fill to a multiple of 7
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const dateKey = toDateKey(nextYear, nextMonthIndex, nextDay);
    cells.push(makeDayInfo(dateKey, nextDay, false, overrides));
    nextDay++;
  }

  return cells;
}

function makeDayInfo(
  dateKey: string,
  day: number,
  isCurrentMonth: boolean,
  overrides?: CycleOverrides
): DayInfo {
  const today = overrides?.today ?? cycleState.today;
  const periodDays = overrides?.periodDays ?? cycleState.periodDays;
  const fertileWindow = overrides?.fertileWindow ?? cycleState.fertileWindow;
  const ovulationDate = overrides?.ovulationDate ?? cycleState.ovulationDate;
  const sexEvents = overrides?.sexEvents ?? cycleState.sexEvents;

  return {
    dateKey,
    day,
    isCurrentMonth,
    isToday: dateKey === today,
    isPeriod: periodDays.includes(dateKey),
    isFertile: isInFertileWindow(dateKey, fertileWindow),
    isOvulation: dateKey === ovulationDate,
    isSexLogged: sexEvents.includes(dateKey),
  };
}

export function formatLongDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

export function daysUntil(dateKey: string, todayKey?: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const [ty, tm, td] = (todayKey ?? cycleState.today).split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}