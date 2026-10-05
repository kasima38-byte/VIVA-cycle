import { cycleState, formatLongDate } from './cycleData';
import { estimateCycle, FertilityStatus } from './cycleEngine';

type LateCopy = { label: string; explanation: string; message: string };

// Shown when the expected period date has passed. Never says "you are pregnant".
function lateCopy(daysLate: number): LateCopy {
  if (daysLate >= 14) {
    return {
      label: 'Period is late',
      explanation: 'Your period is more than 2 weeks later than expected. If you could be pregnant, a pregnancy test can help.',
      message: 'Consider speaking to a doctor or nurse if your period stays absent or your cycles have changed.',
    };
  }
  if (daysLate >= 7) {
    return {
      label: 'Period is late',
      explanation: 'Your period is about a week later than expected. If you could be pregnant, a pregnancy test can help.',
      message: 'Cycles can shift for many reasons, including stress, illness and travel.',
    };
  }
  return {
    label: 'Period may be late',
    explanation: 'Your period is a few days later than expected. This is an estimate, and cycle timing can vary.',
    message: 'If you could be pregnant, a pregnancy test can help.',
  };
}
import { CycleLog, getCycleLog } from './cycleStore';
import { Goal, getSettings } from './settingsStore';

// Extra guidance by goal. Estimates only: never "safe day", never a guarantee either way.
function goalGuidance(goal: Goal, status: FertilityStatus): string | null {
  const fertileNow = status === 'potentiallyFertile' || status === 'ovulationLikely';
  const approaching = status === 'fertileApproaching';

  if (goal === 'conceive') {
    if (fertileNow) return 'These days may offer a higher chance of conception. Having intercourse regularly in your fertile window may help.';
    if (approaching) return 'Your estimated fertile window is approaching. An LH test can give extra information about ovulation.';
    return null;
  }
  if (goal === 'avoid') {
    if (fertileNow || approaching) {
      return 'Pregnancy may be possible on these days. If you want to avoid pregnancy, use an effective contraceptive method or avoid vaginal intercourse. This estimate is not contraception.';
    }
    if (status === 'lowerFertility' || status === 'postOvulatory') {
      return 'Fertility is estimated to be lower, but pregnancy can still happen because ovulation timing varies.';
    }
    return null;
  }
  return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(key: string) {
  const parts = key.split('-').map(Number);
  return parts[2] + ' ' + MONTHS[parts[1] - 1];
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || '';
}

type StatusCopy = { label: string; explanation: string; message: string; note: string | null };

// Wording follows the product rules: estimates, never certainty, never a "safe day".
const STATUS_COPY: Record<FertilityStatus, StatusCopy> = {
  menstruation: {
    label: 'Menstruation',
    explanation: 'Your period is under way. Rest and be gentle with yourself.',
    message: 'Be kind to yourself today.',
    note: null,
  },
  lowerFertility: {
    label: 'Lower estimated fertility',
    explanation: 'Based on your cycle history, fertility is estimated to be lower right now. Pregnancy can still happen.',
    message: 'This is an estimate, not a guarantee.',
    note: null,
  },
  fertileApproaching: {
    label: 'Fertile window approaching',
    explanation: 'Your estimated fertile window may begin in the next few days.',
    message: 'Timing can vary from cycle to cycle.',
    note: null,
  },
  potentiallyFertile: {
    label: 'Potentially fertile',
    explanation: 'You may be in your estimated fertile window. Pregnancy is possible on these days.',
    message: 'This is an estimate based on your cycle history.',
    note: 'Potentially fertile',
  },
  ovulationLikely: {
    label: 'Ovulation likely approaching',
    explanation: 'Ovulation is estimated around now, but its timing varies and is not confirmed.',
    message: 'Pregnancy is possible on these days.',
    note: 'Estimated, not confirmed',
  },
  ovulationMayHavePassed: {
    label: 'Ovulation may have occurred',
    explanation: 'Your estimated ovulation date has just passed. This is an estimate, not a confirmed event.',
    message: 'Pregnancy is still possible for a short time.',
    note: null,
  },
  postOvulatory: {
    label: 'Post-ovulatory phase',
    explanation: 'This is after your estimated ovulation. Your body may be preparing for your next period.',
    message: 'Take care of yourself.',
    note: null,
  },
  periodExpectedSoon: {
    label: 'Period expected soon',
    explanation: 'Your next period may start within the next few days.',
    message: 'Take care of yourself.',
    note: null,
  },
  unknown: {
    label: 'Not enough data yet',
    explanation: 'Log the first day of your period to see estimates here.',
    message: 'The more cycles you log, the better the estimates.',
    note: null,
  },
};

function getEstimate(log: CycleLog) {
  const s = getSettings();
  return estimateCycle(log.periods, s.periodLength, cycleState.today, s.cycleLength);
}

export function getHomeSummary() {
  const log = getCycleLog();
  const est = getEstimate(log);
  const isLate = est.periodLateDays >= 2;
  const copy = isLate ? { ...STATUS_COPY[est.status], ...lateCopy(est.periodLateDays), note: null } : STATUS_COPY[est.status];

  const hasData = est.cycleStart !== null;
  const cycleLength = est.expectedCycleLength;
  const cycleDay = est.cycleDay ?? 0;

  let confidenceNote: string;
  if (est.stats.confidence === 'good') {
    confidenceNote = 'Your cycle timing has been fairly consistent, so this estimate is based on your recent pattern.';
  } else if (est.stats.confidence === 'moderate') {
    confidenceNote = 'Your cycle timing has been somewhat consistent, so these estimates are approximate.';
  } else if (est.stats.confidence === 'low') {
    confidenceNote = 'Your cycle lengths vary, so predicting ovulation from calendar dates alone is less reliable.';
  } else {
    confidenceNote = 'These dates use your typical cycle length of ' + getSettings().cycleLength + ' days until you log more periods.';
  }

  return {
    hasData,
    cycleDay,
    cycleLength,
    progress: Math.min(cycleDay / cycleLength, 1),
    phase: copy.label,
    statusKey: est.status,
    fertileRange: est.fertileWindow
      ? shortDate(est.fertileWindow.start) + ' – ' + formatLongDate(est.fertileWindow.end)
      : 'Not enough data yet',
    ovulationText: est.ovulation ? formatLongDate(est.ovulation) : 'Not enough data yet',
    nextPeriodDays: est.daysToNextPeriod ?? 0,
    nextPeriodText: est.nextPeriod ? 'Expected ' + formatLongDate(est.nextPeriod) : 'Not enough data yet',
    periodLateDays: est.periodLateDays,
    isLate,
    goal: getSettings().goal,
    goalNote: goalGuidance(getSettings().goal, est.status),
    phaseExplanation: copy.explanation,
    todayMessage: copy.message,
    todayNote: copy.note,
    confidenceNote,
  };
}