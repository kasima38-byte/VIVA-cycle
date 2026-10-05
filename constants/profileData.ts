import { average, formatAverage } from './insightsCalc';
import { cycleHistory } from './insightsData';

export const userProfile = {
  name: 'Kasima Allan',
  tagline: 'A healthier, brighter me',
};

const recent = cycleHistory.slice(-6);

// Derived from the same cycle history the Insights screen uses.
export const profileStats = {
  cyclesTracked: recent.length,
  averageCycle: formatAverage(average(recent.map((r) => r.cycleLength))) + ' days',
  averagePeriod: formatAverage(average(recent.map((r) => r.periodLength))) + ' days',
  articlesRead: 12, // demo value until article reading is tracked
};

// Change this to the real VIVA Pregnancy link when you have it.
export const PREGNANCY_LINK = 'vivapregnancy://open';