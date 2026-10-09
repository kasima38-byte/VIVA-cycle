import { formatLongDate } from './cycleData';
import { calculateCycle, CycleEstimate, FertilityStatus, Goal, todayLocal } from '../lib/cycleEngine';
import { VivaState } from '../lib/vivaStore';
import { showsFertilityEstimatesOnHome } from '../lib/goals';

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

// Guidance by goal. Same dates for every goal — only the wording changes.
// Estimates only: never "safe day", never "can't get pregnant", never a promise.
const NOT_CONTRACEPTION =
  'A calendar estimate should not be your only method of contraception.';

function goalGuidance(goal: Goal | null, est: CycleEstimate): string | null {
  const s = est.status;
  const fw = est.fertileWindowStatus;

  // Period LATE: the cycle is running longer than estimated, so ovulation may
  // not have happened yet. Never call this lower fertility; give no window.
  if (est.isLate) {
    switch (goal) {
      case 'conceive':
        return 'Your period is later than expected, so ovulation timing in this cycle is uncertain. If you could be pregnant, a pregnancy test can help.';
      case 'avoid':
        return 'Your period is later than expected. When a cycle runs long, ovulation may happen later than estimated, so pregnancy may still be possible. ' + NOT_CONTRACEPTION;
      case 'understand':
        return 'A late period can simply mean a longer cycle this time; ovulation may have happened later than the estimate. Calendar dates cannot tell which.';
      default:
        return null;
    }
  }

  const up = est.upcomingFertileWindow ?? est.estimatedFertileWindow; // never null when not late
  const window = shortDate(up.start) + ' – ' + shortDate(up.end);

  switch (goal) {
    case 'conceive':
      if (fw === 'current')
        return 'You may be in your estimated fertile window. Intercourse every 1–2 days in this window may help, but pregnancy is never guaranteed and ovulation can vary from cycle to cycle.';
      if (fw === 'upcoming')
        return 'Your estimated fertile window is ' + window + '. These are calendar-based estimates and may vary from cycle to cycle.';
      return "This cycle's estimated fertile window has passed. Your next one is estimated around " + window + '.';

    case 'avoid':
      if (fw === 'current' || s === 'fertileApproaching')
        return 'Pregnancy may be possible on these days. If you want to avoid pregnancy, use an effective contraceptive method or avoid vaginal intercourse. ' + NOT_CONTRACEPTION;
      return 'Fertility is estimated to be lower, but pregnancy can still happen because ovulation timing varies. ' + NOT_CONTRACEPTION;

    case 'understand':
      switch (s) {
        case 'menstruation':
          return 'Your cycle begins on the first day of your period. After bleeding, the follicular phase prepares an egg for release.';
        case 'fertileApproaching':
        case 'potentiallyFertile':
          return 'The fertile window is the few days before and including ovulation, because sperm can survive several days in the body.';
        case 'ovulationLikely':
          return 'Ovulation is when an egg is released; the egg survives for about a day. The date shown is a calendar estimate, not a measurement.';
        case 'ovulationMayHavePassed':
        case 'postOvulatory':
          return 'After ovulation comes the luteal phase, usually about two weeks, which ends with your next period.';
        case 'periodExpectedSoon':
          return 'The luteal phase ends when your next period starts, beginning a new cycle.';
        default:
          return fw === 'upcoming'
            ? 'You are likely in the follicular phase, when an egg matures. Your estimated fertile window comes next. Calendar dates cannot pinpoint these phases exactly.'
            : 'Calendar dates give an estimate of your cycle phases; your body may vary.';
      }

    default: // 'track' or not set: focus on dates, no conception/contraception emphasis
      return null;
  }
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
const STATUS_COPY: Record<FertilityStatus | 'unknown', StatusCopy> = {
  menstruation: {
    label: 'Menstruation',
    explanation: 'Your period is under way. Rest and be gentle with yourself.',
    message: 'Be kind to yourself today.',
    note: null,
  },
  lowerFertility: {
    label: 'Lower estimated fertility',
    explanation: 'Based on your cycle information, fertility is estimated to be lower right now. Pregnancy can still happen.',
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
    message: 'This is an estimate based on your cycle information.',
    note: 'Potentially fertile',
  },
  ovulationLikely: {
    label: 'Around estimated ovulation',
    explanation: 'Your estimated ovulation is today or tomorrow. Its timing varies and VIVA cannot confirm it.',
    message: 'Pregnancy is possible on these days.',
    note: 'Estimated, not confirmed',
  },
  ovulationMayHavePassed: {
    label: 'Estimated ovulation has passed',
    explanation: 'Your estimated ovulation date has just passed. VIVA cannot confirm whether or when ovulation happened.',
    message: 'Pregnancy may still be possible for a short time.',
    note: null,
  },
  postOvulatory: {
    label: 'After estimated ovulation',
    explanation: 'This is after your estimated ovulation. Your next period is estimated to follow.',
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

export function getHomeSummary(viva: VivaState, today: string = todayLocal()) {
  const est = calculateCycle(viva.baseline, viva.periods, today);

  if (!est) {
    const copy = STATUS_COPY.unknown;
    return {
      hasData: false,
      cycleDay: 0,
      cycleLength: 28,
      progress: 0,
      phase: copy.label,
      statusKey: 'unknown' as const,
      fertileRange: 'Not enough data yet',
      ovulationText: 'Not enough data yet',
      nextPeriodDays: 0,
      nextPeriodText: 'Not enough data yet',
      periodLateDays: 0,
      isLate: false,
      goal: viva.goal,
      goalNote: null,
      showFertilityEstimates: showsFertilityEstimatesOnHome(viva.goal),
      ovulationIsVariable: false,
      fertileWindowStatus: 'upcoming' as const,
      regularity: viva.baseline.regularity,
      phaseExplanation: copy.explanation,
      todayMessage: copy.message,
      todayNote: copy.note,
      confidenceNote: '',
    };
  }

  const copy = est.isLate
    ? { ...STATUS_COPY[est.status], ...lateCopy(est.daysLate), note: null }
    : STATUS_COPY[est.status];

  let confidenceNote: string;
  if (est.lengthSource === 'default') {
    confidenceNote =
      'You chose "Not sure" for cycle length, so these dates assume a 28-day cycle until you log your next period.';
  } else if (est.lengthSource === 'baseline') {
    confidenceNote =
      'These dates use your usual cycle length of ' + est.cycleLengthUsed + ' days until you log more periods.';
  } else if (est.confidence === 'high') {
    confidenceNote = 'Your cycle timing has been fairly consistent, so this estimate is based on your recent pattern.';
  } else if (est.confidence === 'medium') {
    confidenceNote = 'Your cycle timing has been somewhat consistent, so these estimates are approximate.';
  } else {
    confidenceNote = 'Your cycle lengths vary, so predicting ovulation from calendar dates alone is less reliable.';
  }

  if (est.ovulationIsVariable) {
    confidenceNote += ' Because your cycle length can vary, estimated ovulation is shown as a range.';
  }

  return {
    hasData: true,
    cycleDay: est.currentCycleDay,
    cycleLength: est.cycleLengthUsed,
    progress: Math.min(est.currentCycleDay / est.cycleLengthUsed, 1),
    phase: copy.label,
    statusKey: est.status,
    fertileRange:
      shortDate(est.estimatedFertileWindow.start) + ' – ' + formatLongDate(est.estimatedFertileWindow.end),
    ovulationText: est.ovulationIsVariable
      ? 'Around ' + shortDate(est.ovulationRange.start) + ' – ' + formatLongDate(est.ovulationRange.end)
      : formatLongDate(est.estimatedOvulation),
    ovulationIsVariable: est.ovulationIsVariable,
    fertileWindowStatus: est.fertileWindowStatus,
    regularity: est.regularity,
    nextPeriodDays: Math.max(0, est.daysToNextPeriod),
    nextPeriodText: 'Expected ' + formatLongDate(est.estimatedNextPeriod),
    periodLateDays: est.daysLate,
    isLate: est.isLate,
    goal: viva.goal,
    goalNote: goalGuidance(viva.goal, est),
    showFertilityEstimates: showsFertilityEstimatesOnHome(viva.goal), // goal rule: lib/goals.ts
    phaseExplanation: copy.explanation,
    todayMessage: copy.message,
    todayNote: copy.note,
    confidenceNote,
  };
}
