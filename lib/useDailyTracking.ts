// VIVA Cycle - Daily Tracking screen state
//
//   UI (app/daily-tracking.tsx) -> THIS HOOK -> lib/dailyTrackingService.ts -> lib/vivaStore.ts
//
// Mood and Energy change a DRAFT for the selected date and AUTOSAVE: mood at once, energy
// shortly after she stops dragging. Every other field is saved by its own sheet, so the draft
// always shows those saved values. The Save button is a final "save anything pending" point.
// If a write fails, her input stays in the draft so she can try again.

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
const ENERGY_AUTOSAVE_MS = 700; // after she stops dragging
const SAVED_FLASH_MS = 2000;    // how long the button says "Saved"

/** notSaved: nothing saved for this day and no changes
 *  unsaved:  changes not saved yet (autosave is about to run)
 *  saving:   writing to the phone
 *  saved:    what she sees is exactly what is saved
 *  error:    the last write failed - her input is kept for Try Again */
export type SaveStatus = 'notSaved' | 'unsaved' | 'saving' | 'saved' | 'error';

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
  const [saveError, setSaveError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saved = useMemo(() => readDailyRecord(selectedDate), [selectedDate, dailyLogs]);

  // Never show another date's answers, even for a single frame.
  // Fields with their own sheets always show their saved values.
  const base = draft.date === selectedDate ? draft : saved;
  const record = useMemo(
    () => ({
      ...base,
      period: saved.period,
      flow: saved.flow,
      symptoms: saved.symptoms,
      cervicalMucus: saved.cervicalMucus,
      cervicalMucusNote: saved.cervicalMucusNote,
      sexualActivity: saved.sexualActivity,
      medications: saved.medications,
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
  const delayRef = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If this day's saved record changes elsewhere while she has no edits, show it.
  // While our own save is running (or being undone after a failure), keep her input.
  const lastSaved = useRef(saved);
  useEffect(() => {
    const prev = lastSaved.current;
    lastSaved.current = saved;
    if (prev.date !== saved.date || inFlight.current) return;
    setDraft((d) => (d.date === saved.date && sameTrackedData(d, prev) ? saved : d));
  }, [saved]);

  const relation: DateRelation = dateRelation(selectedDate, today);
  const canEdit = canLog(selectedDate, today);
  const dirty = !sameTrackedData(record, saved);
  const hasSaved = Object.prototype.hasOwnProperty.call(dailyLogs, selectedDate);
  const saveStatus: SaveStatus = saving
    ? 'saving'
    : saveError && dirty
      ? 'error'
      : dirty
        ? 'unsaved'
        : hasSaved
          ? 'saved'
          : 'notSaved';
  const state: TrackingState = trackingState(record);
  const periodInfo = useMemo(() => periodInfoOn(dailyLogs, selectedDate), [dailyLogs, selectedDate]);

  const loggedDates = useMemo(() => new Set(Object.keys(dailyLogs)), [dailyLogs]);
  const visibleDates = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i)),
    [windowStart]
  );

  /** Save the shown draft. A second call while saving returns the same save. */
  const save = useCallback((): Promise<SaveResult> => {
    if (inFlight.current) return inFlight.current;
    const toSave = draftRef.current;
    const p = (async () => {
      setSaving(true);
      try {
        const result = await saveDailyRecord(toSave);
        if (result === 'failed') {
          setSaveError(true);
        } else {
          setSaveError(false);
          if (result === 'saved') {
            setJustSaved(true);
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
          }
        }
        return result;
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

  /** Switch dates: save pending changes first, then load that date's own record.
   *  If saving fails she stays on this date (the screen offers Retry). */
  const selectDate = useCallback(
    async (date: string): Promise<SaveResult | null> => {
      if (!isValidDateKey(date) || date === selectedRef.current) return null;
      const result = await flush();
      if (result === 'failed') return result;
      selectedRef.current = date;
      setSelectedDate(date);
      setDraft(readDailyRecord(date));
      setSaveError(false);
      setWindowStart((ws) => keepVisible(ws, date));
      return result;
    },
    [flush]
  );

  const goPrev = useCallback(() => selectDate(addDays(selectedRef.current, -1)), [selectDate]);
  const goNext = useCallback(() => selectDate(addDays(selectedRef.current, 1)), [selectDate]);
  const goToday = useCallback(() => selectDate(todayRef.current), [selectDate]);

  /** Change one draft answer (Mood / Energy). Ignored for future dates. Autosaves. */
  const setField = useCallback(<F extends TrackedField>(field: F, value: DailyTrackingRecord[F]) => {
    delayRef.current = field === 'energy' ? ENERGY_AUTOSAVE_MS : 0;
    setSaveError(false); // a new change gets a fresh attempt
    setDraft((d) => {
      const b = d.date === selectedRef.current ? d : readDailyRecord(selectedRef.current);
      return canLog(b.date, todayRef.current) ? { ...b, [field]: value } : b;
    });
  }, []);

  // AUTOSAVE: when there are pending changes, save after the field's delay.
  // A newer change restarts the wait, so the latest value always wins. After a failure it
  // waits for Try Again or a new change instead of retrying in a loop.
  useEffect(() => {
    if (!dirty || !canEdit || saving || saveError) return;
    const t = setTimeout(() => {
      void save();
    }, delayRef.current);
    return () => clearTimeout(t);
  }, [record, dirty, canEdit, saving, saveError, save]);

  // App going to the background: save anything pending
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flush();
    });
    return () => sub.remove();
  }, [flush]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  return {
    today,
    selectedDate,
    relation,          // 'today' | 'past' | 'future'
    canEdit,
    visibleDates,
    loggedDates,
    record,            // what the cards show
    savedAt: saved.updatedAt,
    state,             // 'empty' | 'partial' | 'complete'
    periodInfo,        // bleeding status, episode and day number for selectedDate
    saveStatus,        // 'notSaved' | 'unsaved' | 'saving' | 'saved' | 'error'
    justSaved,         // true for a moment after a successful save
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
