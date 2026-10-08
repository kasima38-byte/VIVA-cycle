// VIVA Cycle - Period sheet (Daily Tracking)
// Records bleeding days through lib/periodService.ts. Only the `period` field of a day changes:
// mood, energy, symptoms and everything else on those days is never touched.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, keyToLocalDate } from '../constants/dateUtils';
import { colors, radius, spacing } from '../constants/theme';
import { formatLongDate, relativeDayName } from '../lib/dailyTracking';
import {
  MAX_PERIOD_RANGE_DAYS, PeriodResult, markPeriodDay, removePeriodDay, savePeriodRange,
} from '../lib/periodService';
import { periodInfoOn, rangeDates } from '../lib/periodTracking';
import { useVivaStore } from '../lib/vivaStore';
import BottomSheet from './BottomSheet';

type Tone = 'success' | 'error' | 'info';
type Mode = 'day' | 'range' | 'remove';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  date: string;   // the selected date on Daily Tracking
  today: string;
  onClose: () => void;
  onFeedback: (text: string, tone: Tone) => void;
};

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(key: string): string {
  const d = keyToLocalDate(key);
  return WEEKDAYS_SHORT[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
}

function monthDay(key: string): string {
  const d = keyToLocalDate(key);
  return MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
}

function rangeText(start: string, end: string): string {
  return start === end ? monthDay(start) : monthDay(start) + ' – ' + monthDay(end);
}

/** "1 day recorded" / "3 days recorded" - never claims the period has ended. */
export function recordedText(n: number): string {
  return n === 1 ? '1 day recorded' : n + ' days recorded';
}

const ERRORS: Partial<Record<PeriodResult, string>> = {
  future: 'Period days can only be recorded for today or earlier.',
  invalid: "The end date can't be before the start date.",
  tooLong: 'A period range can be up to ' + MAX_PERIOD_RANGE_DAYS + ' days.',
  lastOne: "This is your only recorded period, so it can't be removed. Use Edit period to change its dates instead.",
  failed: "Couldn't save. Please try again.",
};

export default function PeriodSheet({ visible, date, today, onClose, onFeedback }: Props) {
  const { dailyLogs } = useVivaStore();
  const info = periodInfoOn(dailyLogs, date);
  const episode = info.episode;

  const [mode, setMode] = useState<Mode>('day');
  const [marked, setMarked] = useState(false);
  const [start, setStart] = useState(date);
  const [end, setEnd] = useState(date);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every time the sheet opens, start fresh for the selected date
  useEffect(() => {
    if (!visible) return;
    setMode('day');
    setMarked(false);
    setStart(date);
    setEnd(date);
    setEditing(false);
    setBusy(false);
    setError(null);
  }, [visible, date]);

  const rel = relativeDayName(date, today);
  const isToday = date === today;
  const checkLabel = isToday ? 'Period today' : 'Period on this day';

  const run = async (action: () => Promise<PeriodResult>, successText: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result === 'saved') {
      onClose();
      onFeedback(successText, 'success');
    } else if (result === 'unchanged') {
      onClose();
    } else {
      setError(ERRORS[result] ?? "Couldn't save. Please try again.");
    }
  };

  const openRange = (s: string, e: string, isEdit: boolean) => {
    setStart(s);
    setEnd(e);
    setEditing(isEdit);
    setError(null);
    setMode('range');
  };

  const backToDay = () => {
    setError(null);
    setMode('day');
  };

  // Range limits: end never after today, start never after end, at most MAX days
  const length = start <= end ? rangeDates(start, end).length : 0;
  const canStartBack = length < MAX_PERIOD_RANGE_DAYS;
  const canStartForward = start < end;
  const canEndBack = end > start;
  const canEndForward = end < today && length < MAX_PERIOD_RANGE_DAYS;

  let primaryLabel = 'Done';
  let onPrimary: () => void = onClose;
  let primaryDisabled = busy;
  if (mode === 'day' && info.status !== 'period') {
    primaryLabel = 'Save';
    onPrimary = () => void run(() => markPeriodDay(date), 'Period day saved');
    primaryDisabled = busy || !marked;
  } else if (mode === 'range') {
    primaryLabel = 'Save Period';
    onPrimary = () =>
      void run(
        () => savePeriodRange(start, end, editing ? date : undefined),
        !editing && length === 1 ? 'Period day saved' : 'Period updated'
      );
  } else if (mode === 'remove') {
    primaryLabel = 'Remove';
    onPrimary = () => void run(() => removePeriodDay(date), 'Period removed from this day');
  }

  return (
    <BottomSheet
      visible={visible}
      title="Period"
      onClose={onClose}
      primaryLabel={busy ? 'Saving…' : primaryLabel}
      onPrimary={onPrimary}
      primaryDisabled={primaryDisabled}
    >
      <Text style={styles.subtitle}>Which days are you having your period?</Text>
      <View
        style={styles.dateBlock}
        accessible
        accessibilityLabel={'Selected date: ' + (rel ? rel + ', ' : '') + formatLongDate(date)}
      >
        {rel && <Text style={styles.dateRel}>{rel}</Text>}
        <Text style={styles.dateText}>{formatLongDate(date)}</Text>
      </View>

      {/* A recorded period day: what is recorded, and how to change it */}
      {mode === 'day' && info.status === 'period' && episode && (
        <>
          <View
            style={styles.statusCard}
            accessible
            accessibilityLabel={
              'Period day ' + info.dayNumber + '. ' + rangeText(episode.start, episode.end) + ', ' + recordedText(episode.recordedDays)
            }
          >
            <View style={styles.statusIcon}>
              <Ionicons name="water" size={20} color={colors.magenta} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.statusTitle}>Period day {info.dayNumber}</Text>
              <Text style={styles.statusLine}>
                {rangeText(episode.start, episode.end)} · {recordedText(episode.recordedDays)}
              </Text>
            </View>
          </View>
          <ActionRow icon="create-outline" label="Edit period" onPress={() => openRange(episode.start, episode.end, true)} />
          <ActionRow
            icon="trash-outline"
            label="Remove period from this day"
            onPress={() => {
              setError(null);
              setMode('remove');
            }}
          />
        </>
      )}

      {/* Not a period day yet: one tap to mark it, or log several days */}
      {mode === 'day' && info.status !== 'period' && (
        <>
          <Pressable
            onPress={() => setMarked((m) => !m)}
            style={[styles.checkRow, marked && styles.checkRowOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marked }}
            accessibilityLabel={checkLabel}
          >
            <View style={[styles.checkbox, marked && styles.checkboxOn]}>
              {marked && <Ionicons name="checkmark" size={18} color={colors.white} />}
            </View>
            <Text style={styles.checkLabel}>{checkLabel}</Text>
          </Pressable>

          {info.status === 'notPeriod' && (
            <View style={styles.inlineNote}>
              <Text style={styles.inlineNoteText}>You marked this day as no period.</Text>
              <Pressable
                onPress={() => void run(() => removePeriodDay(date), 'Answer cleared')}
                style={styles.link}
                accessibilityRole="button"
                accessibilityLabel="Clear the no period answer"
              >
                <Text style={styles.linkText}>Clear</Text>
              </Pressable>
            </View>
          )}

          <ActionRow icon="calendar-outline" label="Log several days" onPress={() => openRange(date, date, false)} />
        </>
      )}

      {/* Several days: start and end */}
      {mode === 'range' && (
        <>
          <Text style={styles.sectionTitle}>{editing ? 'Edit period' : 'Log several days'}</Text>
          <Text style={styles.hint}>Choose the first and last day of bleeding.</Text>
          <Stepper
            label="Start date"
            value={shortDate(start)}
            onPrev={() => setStart((s) => addDays(s, -1))}
            onNext={() => setStart((s) => addDays(s, 1))}
            canPrev={canStartBack}
            canNext={canStartForward}
          />
          <Stepper
            label="End date"
            value={shortDate(end)}
            onPrev={() => setEnd((e) => addDays(e, -1))}
            onNext={() => setEnd((e) => addDays(e, 1))}
            canPrev={canEndBack}
            canNext={canEndForward}
          />
          <Text style={styles.summary} accessibilityLiveRegion="polite">
            {length === 1 ? '1 day' : length + ' days'} · {rangeText(start, end)}
          </Text>
          <Pressable onPress={backToDay} style={styles.link} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        </>
      )}

      {/* Lightweight confirmation before removing */}
      {mode === 'remove' && (
        <>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remove period from this day?</Text>
            <Text style={styles.confirmText}>
              {formatLongDate(date)} goes back to Not tracked. Your other tracking for this day stays as it is.
            </Text>
          </View>
          <Pressable onPress={backToDay} style={styles.link} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        </>
      )}

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}
    </BottomSheet>
  );
}

function ActionRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={colors.magenta} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.navy} />
    </Pressable>
  );
}

function Stepper({
  label, value, onPrev, onNext, canPrev, canNext,
}: {
  label: string; value: string; onPrev: () => void; onNext: () => void; canPrev: boolean; canNext: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={onPrev}
          disabled={!canPrev}
          style={[styles.stepButton, !canPrev && styles.stepButtonOff]}
          accessibilityRole="button"
          accessibilityLabel={label + ', one day earlier'}
          accessibilityState={{ disabled: !canPrev }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.magenta} />
        </Pressable>
        <Text style={styles.stepperValue} accessibilityLabel={label + ': ' + value}>
          {value}
        </Text>
        <Pressable
          onPress={onNext}
          disabled={!canNext}
          style={[styles.stepButton, !canNext && styles.stepButtonOff]}
          accessibilityRole="button"
          accessibilityLabel={label + ', one day later'}
          accessibilityState={{ disabled: !canNext }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.magenta} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  dateBlock: { marginTop: spacing.xs, marginBottom: spacing.xs },
  dateRel: { fontSize: 13, fontWeight: '700', color: colors.magentaText },
  dateText: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 2 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  statusLine: { fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  checkRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  checkRowOn: { borderColor: colors.magenta, backgroundColor: colors.pinkVerySoft },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.toggleOff,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  checkLabel: { fontSize: 17, fontWeight: '700', color: colors.navy },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.navy },
  pressed: { opacity: 0.8 },
  inlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lavender,
    borderRadius: radius.sm,
    paddingLeft: spacing.md,
  },
  inlineNoteText: { flex: 1, fontSize: 13.5, color: colors.navy },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  hint: { fontSize: 13.5, color: colors.textSecondary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  stepperLabel: { fontSize: 14.5, fontWeight: '600', color: colors.navy },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonOff: { opacity: 0.35 },
  stepperValue: { minWidth: 104, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.navy },
  summary: { fontSize: 14, fontWeight: '600', color: colors.magentaText, textAlign: 'center', marginTop: spacing.xs },
  confirmCard: { backgroundColor: colors.pinkVerySoft, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  confirmText: { fontSize: 14, color: colors.navy, lineHeight: 20 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14.5, fontWeight: '700', color: colors.magentaText },
  error: { fontSize: 13.5, fontWeight: '600', color: colors.magentaText, lineHeight: 19 },
});
