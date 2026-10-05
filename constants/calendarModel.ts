import { DayInfo } from './cycleData';
import { addDays, estimateCycle, FERTILE_DAYS_BEFORE_OVULATION, LUTEAL_PHASE_DAYS } from './cycleEngine';
import { CycleLog } from './cycleStore';
import { Settings } from './settingsStore';

export type DayModel = DayInfo & {
  isPredictedPeriod: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toKey(y: number, m: number, d: number) {
  return y + '-' + pad(m + 1) + '-' + pad(d);
}

export function buildCalendarMonth(
  year: number,
  monthIndex: number,
  log: CycleLog,
  settings: Settings,
  todayKey: string
): DayModel[] {
  const est = estimateCycle(log.periods, settings.periodLength, todayKey, settings.cycleLength);
  const len = est.expectedCycleLength;
  const plen = settings.periodLength;
  const late = est.periodLateDays >= 2;

  const periodDays = new Set<string>();
  const predictedDays = new Set<string>();
  const fertileDays = new Set<string>();
  const ovulationDays = new Set<string>();

  const markFertile = (ovulation: string) => {
    ovulationDays.add(ovulation);
    for (let d = 0; d <= FERTILE_DAYS_BEFORE_OVULATION; d++) {
      fertileDays.add(addDays(ovulation, -d));
    }
  };

  // Logged periods are facts. Ovulation in past cycles is looked back from the next logged period.
  const starts = log.periods.map((p) => p.date).sort();
  starts.forEach((s, i) => {
    for (let d = 0; d < plen; d++) periodDays.add(addDays(s, d));
    const next = starts[i + 1];
    if (next) markFertile(addDays(next, -LUTEAL_PHASE_DAYS));
  });

  // Predictions run forward from the latest period. Nothing is projected while a period is late.
  if (est.cycleStart) {
    const last = late ? 0 : 3;
    for (let k = 0; k <= last; k++) {
      const nextStart = addDays(est.cycleStart, (k + 1) * len);
      markFertile(addDays(nextStart, -LUTEAL_PHASE_DAYS));
      if (!late && nextStart >= todayKey) {
        for (let d = 0; d < plen; d++) predictedDays.add(addDays(nextStart, d));
      }
    }
  }

  const sex = new Set(log.sexualActivity.filter((e) => e.hadActivity).map((e) => e.date));

  const make = (dateKey: string, day: number, inMonth: boolean): DayModel => ({
    dateKey,
    day,
    isCurrentMonth: inMonth,
    isToday: dateKey === todayKey,
    isPeriod: periodDays.has(dateKey),
    isPredictedPeriod: predictedDays.has(dateKey) && !periodDays.has(dateKey),
    isFertile: fertileDays.has(dateKey),
    isOvulation: ovulationDays.has(dateKey),
    isSexLogged: sex.has(dateKey),
  });

  const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const total = new Date(year, monthIndex + 1, 0).getDate();
  const prevTotal = new Date(year, monthIndex, 0).getDate();
  const prevY = monthIndex === 0 ? year - 1 : year;
  const prevM = monthIndex === 0 ? 11 : monthIndex - 1;
  const nextY = monthIndex === 11 ? year + 1 : year;
  const nextM = monthIndex === 11 ? 0 : monthIndex + 1;

  const cells: DayModel[] = [];
  for (let i = lead - 1; i >= 0; i--) {
    const day = prevTotal - i;
    cells.push(make(toKey(prevY, prevM, day), day, false));
  }
  for (let day = 1; day <= total; day++) {
    cells.push(make(toKey(year, monthIndex, day), day, true));
  }
  let nd = 1;
  while (cells.length % 7 !== 0) {
    cells.push(make(toKey(nextY, nextM, nd), nd, false));
    nd++;
  }
  return cells;
}