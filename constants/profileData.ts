import { PeriodLog } from '../lib/cycleEngine';
import { average, formatAverage } from './insightsCalc';
import { buildCycleRecords } from './insightsData';

export const userProfile = {
  tagline: 'A healthier, brighter me',
};

/** Profile stats from her REAL logged history (same records the Insights screen uses). */
export function getProfileStats(periods: PeriodLog[]) {
  const recent = buildCycleRecords(periods).slice(-6);
  const periodLengths = recent.flatMap((r) => (r.periodLength === null ? [] : [r.periodLength]));
  return {
    cyclesTracked: recent.length,
    averageCycle: recent.length ? formatAverage(average(recent.map((r) => r.cycleLength))) + ' days' : '–',
    averagePeriod: periodLengths.length ? formatAverage(average(periodLengths)) + ' days' : '–',
  };
}

// Change this to the real VIVA Pregnancy link when you have it.
export const PREGNANCY_LINK = 'vivapregnancy://open';
