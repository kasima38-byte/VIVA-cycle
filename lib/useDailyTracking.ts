// VIVA Cycle - Daily Tracking screen state
//
//   UI (app/daily-tracking.tsx) -> THIS HOOK -> lib/dailyTrackingService.ts -> lib/vivaStore.ts
//
// Her taps change a DRAFT for the selected date. Saving writes the draft through the service.
// The selected date controls everything: the draft always belongs to selectedDate.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { addDays, isValidDateKey } from '../constants/dateUtils';
import {
  DailyTrackingRecord, DateRelation, TrackedField, TrackingState,
  canLog, dateRelation, sameTrackedData, trackingState,
} from './dailyTracking';
import { SaveResult, readDailyRecord, saveDailyRecord } from './dailyTrackingService';
import { periodInfoOn } from './periodTracking';
import { useToday } from './useToday';
import { useVivaStore } from './vivaStore';

const WINDOW_DAYS = 7;

/** notSaved: nothing saved for this day and no changes
 *  unsaved:  she has changes that are not saved yet
 *  saved:    what she sees is exactly what is saved */
export type SaveStatus = 'notSaved' | 'unsaved' | 'saved';

/** Slide the 7-day strip only when the date would fall off its edge. */
function keepVisible(windowStart: string, date: string): string {
  if (date < windowStart) return date;
  const windowEnd = addDays(windowStart, WINDOW_DAYS - 1);
  if (date > windowEnd) return addDays(date, -(WINDOW_DAYS - 1));
  return windowStart;
}

export function useDailyTracking() {
  const today = useToday();
  const { dailyLogs } = useVivaStore(); // re-renders when saved data changes

  const [selectedDate, setSelectedDate] = useState(today);
  const [windowStart, setWindowStart] = useState(() => addDays(today, -3));
  const [draft, setDraft] = useState<DailyTrackingRecord>(() => readDailyRecord(today));
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saved = useMemo(() => readDailyRecord(selectedDate), [selectedDate, dailyLogs]);

  // Never show another date's answers, even for a single frame
  // Period, flow and symptoms are saved directly by their own sheets,
  // so their cards always show the saved values
  const base = draft.date === selectedDate ? draft : saved;
  const record = useMemo(
    () => ({
      ...base,
      period: saved.period,
      flow: saved.flow,
      symptoms: saved.symptoms,
      cervicalMucus: saved.cervicalMucus,
      cervicalMucusNote: saved.cervicalMucusNote,
    }),
    [base, saved]
  );

  const draftRef = useRef(record);
  draftRef.current = record;
  const selectedRef = useRef(selectedDate);
  selectedRef.current = selectedDate;
  const todayRef = useRef(today);
  todayRef.current = today;
  const inFlight = useRef<Promise<SaveResult> | null>(null);

  // If this day's saved record changes elsewhere while she has no edits, show it
  const lastSaved = useRef(saved);
  useEffect(() => {
    const prev = lastSaved.current;
    lastSaved.current = saved;
    if (prev.date !== saved.date) return;
    setDraft((d) => (d.date === saved.date && sameTrackedData(d, prev) ? saved : d));
  }, [saved]);

  const relation: DateRelation = dateRelation(selectedDate, today);
  const canEdit = canLog(selectedDate, today);
  const dirty = !sameTrackedData(record, saved);
  const hasSaved = Object.prototype.hasOwnProperty.call(dailyLogs, selectedDate);
  const saveStatus: SaveStatus = dirty ? 'unsaved' : hasSaved ? 'saved' : 'notSaved';
  const state: TrackingState = trackingState(record);
  const periodInfo = useMemo(() => periodInfoOn(dailyLogs, selectedDate), [dailyLogs, selectedDate]);

  const loggedDates = useMemo(() => new Set(Object.keys(dailyLogs)), [dailyLogs]);
  const visibleDates = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i)),
    [windowStart]
  );

  /** Save the shown draft. A second tap while saving returns the same save. */
  const save = useCallback((): Promise<SaveResult> => {
    if (inFlight.current) return inFlight.current;
    const toSave = draftRef.current;
    const p = (async () => {
      setSaving(true);
      try {
        return await saveDailyRecord(toSave);
      } finally {
        setSaving(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, []);

  /** Save her changes for the shown date, if any. Used before switching dates or leaving. */
  const flush = useCallback(async (): Promise<SaveResult | null> => {
    const current = draftRef.current;
    if (!canLog(current.date, todayRef.current)) return null;
    if (sameTrackedData(current, readDailyRecord(current.date))) return null;
    return save();
  }, [save]);

  /** Switch dates: save unsaved changes first, then load that date's own record. */
  const selectDate = useCallback(
    async (date: string): Promise<SaveResult | null> => {
      if (!isValidDateKey(date) || date === selectedRef.current) return null;
      const result = await flush();
      if (result === 'failed') return result; // stay here so nothing is lost
      selectedRef.current = date;
      setSelectedDate(date);
      setDraft(readDailyRecord(date));
      setWindowStart((ws) => keepVisible(ws, date));
      return result;
    },
    [flush]
  );

  const goPrev = useCallback(() => selectDate(addDays(selectedRef.current, -1)), [selectDate]);
  const goNext = useCallback(() => selectDate(addDays(selectedRef.current, 1)), [selectDate]);
  const goToday = useCallback(() => selectDate(todayRef.current), [selectDate]);

  /** Change one answer in the draft. Ignored for future dates. */
  const setField = useCallback(<F extends TrackedField>(field: F, value: DailyTrackingRecord[F]) => {
    setDraft((d) => {
      const base = d.date === selectedRef.current ? d : readDailyRecord(selectedRef.current);
      return canLog(base.date, todayRef.current) ? { ...base, [field]: value } : base;
    });
  }, []);

  // App going to the background: keep her changes
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flush();
    });
    return () => sub.remove();
  }, [flush]);

  return {
    today,
    selectedDate,
    relation,          // 'today' | 'past' | 'future'
    canEdit,
    visibleDates,
    loggedDates,
    record,            // what the cards show (the draft for selectedDate)
    savedAt: saved.updatedAt,
    state,             // 'empty' | 'partial' | 'complete'
    periodInfo,        // bleeding status, episode and day number for selectedDate
    saveStatus,        // 'notSaved' | 'unsaved' | 'saved'
    dirty,
    saving,
    setField,
    save,
    flush,
    selectDate,
    goPrev,
    goNext,
    goToday,
  };
}
