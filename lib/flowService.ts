// VIVA Cycle - Flow / Spotting service
// The ONLY way screens change flow. Only the `flow` field of a day changes:
// it never marks or unmarks a period day, and never touches any other answer.

import { getToday, isValidDateKey } from '../constants/dateUtils';
import { FLOW_OPTIONS, FlowValue } from './dailyTracking';
import {
  CycleFlowSummary, EpisodeFlow, FlowCounts, cycleFlowSummaries, flowCounts, periodFlowPatterns, spottingDates,
} from './flowTracking';
import { getVivaState, saveDailyLog } from './vivaStore';

export type FlowResult =
  | 'saved'      // written to the phone
  | 'unchanged'  // same as what is saved
  | 'future'     // flow can only be recorded for today or earlier
  | 'invalid'    // not a real date or not a known flow value
  | 'failed';    // the phone could not save

export function getFlow(date: string): FlowValue | null {
  return getVivaState().dailyLogs[date]?.flow ?? null;
}

/** Save (or clear, with null) the flow for one day. */
export async function saveFlow(date: string, value: FlowValue | null): Promise<FlowResult> {
  if (!isValidDateKey(date)) return 'invalid';
  if (value !== null && !FLOW_OPTIONS.some((o) => o.value === value)) return 'invalid';
  if (date > getToday()) return 'future';
  if (getFlow(date) === value) return 'unchanged';
  return (await saveDailyLog(date, { flow: value })) ? 'saved' : 'failed';
}

// ---------- Data for Insights (no charts yet) ----------

export function getFlowCounts(from?: string, to?: string): FlowCounts {
  return flowCounts(getVivaState().dailyLogs, from, to);
}

export function getSpottingDates(): string[] {
  return spottingDates(getVivaState().dailyLogs);
}

export function getPeriodFlowPatterns(): EpisodeFlow[] {
  return periodFlowPatterns(getVivaState().dailyLogs);
}

export function getCycleFlowSummaries(): CycleFlowSummary[] {
  return cycleFlowSummaries(getVivaState().dailyLogs);
}
