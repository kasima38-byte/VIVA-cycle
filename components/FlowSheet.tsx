// VIVA Cycle - Flow / Spotting sheet (Daily Tracking)
// Saves ONLY the flow field (lib/flowService.ts). It never changes the period record:
// spotting is not a period day unless she marks that day as a period herself.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { FlowValue, formatLongDate, relativeDayName } from '../lib/dailyTracking';
import { FlowResult, saveFlow } from '../lib/flowService';
import { useVivaStore } from '../lib/vivaStore';
import BottomSheet from './BottomSheet';

type Tone = 'success' | 'error' | 'info';
type Choice = FlowValue | null;

type Props = {
  visible: boolean;
  date: string;
  today: string;
  onClose: () => void;
  onFeedback: (text: string, tone: Tone) => void;
};

// drops: 0 = none, -1 = spotting dot, 1-3 = intensity
type Row = { value: Choice; label: string; drops: number };

const ROWS: Row[] = [
  { value: null, label: 'Not tracked', drops: 0 },
  { value: 'spotting', label: 'Spotting', drops: -1 },
  { value: 'light', label: 'Light', drops: 1 },
  { value: 'medium', label: 'Medium', drops: 2 },
  { value: 'heavy', label: 'Heavy', drops: 3 },
];

// Only shown when a day already has "No bleeding" saved (not forced into the UI)
const NO_BLEEDING: Row = { value: 'none', label: 'No bleeding', drops: 0 };

const ERRORS: Partial<Record<FlowResult, string>> = {
  future: 'Flow can only be recorded for today or earlier.',
  invalid: "That flow value isn't recognised.",
  failed: "Couldn't save. Please try again.",
};

export default function FlowSheet({ visible, date, today, onClose, onFeedback }: Props) {
  const { dailyLogs } = useVivaStore();
  const saved: Choice = dailyLogs[date]?.flow ?? null;
  const isPeriodDay = dailyLogs[date]?.period === 'yes';

  const [choice, setChoice] = useState<Choice>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every time the sheet opens, show what is saved for the selected date
  useEffect(() => {
    if (!visible) return;
    setChoice(dailyLogs[date]?.flow ?? null);
    setBusy(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, date]);

  const run = async (value: Choice, successText: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await saveFlow(date, value);
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

  const successText = choice === null ? 'Flow cleared' : saved === null ? 'Flow / spotting saved' : 'Flow updated';
  const rows = saved === 'none' ? [ROWS[0], NO_BLEEDING, ...ROWS.slice(1)] : ROWS;
  const rel = relativeDayName(date, today);
  const subtitle =
    date === today ? 'How much bleeding are you experiencing today?' : 'How much bleeding did you have on this day?';

  return (
    <BottomSheet
      visible={visible}
      title="Flow / Spotting"
      onClose={onClose}
      primaryLabel={busy ? 'Saving…' : 'Save'}
      onPrimary={() => void run(choice, successText)}
      primaryDisabled={busy || choice === saved}
    >
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View
        style={styles.dateBlock}
        accessible
        accessibilityLabel={'Selected date: ' + (rel ? rel + ', ' : '') + formatLongDate(date)}
      >
        {rel && <Text style={styles.dateRel}>{rel}</Text>}
        <Text style={styles.dateText}>{formatLongDate(date)}</Text>
      </View>

      <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Flow or spotting">
        {rows.map((row) => {
          const selected = row.value === choice;
          return (
            <Pressable
              key={row.value ?? 'untracked'}
              onPress={() => setChoice(row.value)}
              style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityLabel={row.label}
              accessibilityState={{ checked: selected, selected }}
              accessibilityHint={row.value === null ? 'No flow answer for this day' : undefined}
            >
              <View style={[styles.radio, selected && styles.radioOn]}>
                {selected && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
              <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{row.label}</Text>
              <Intensity drops={row.drops} />
            </Pressable>
          );
        })}
      </View>

      {choice === 'spotting' && !isPeriodDay && (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.purpleIcon} />
          <Text style={styles.noteText}>Spotting is different from a period. Your period record hasn't been changed.</Text>
        </View>
      )}

      {saved !== null && (
        <Pressable
          onPress={() => void run(null, 'Flow cleared')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Clear flow"
          accessibilityHint="Sets flow back to not tracked. Your period record is not changed."
        >
          <Text style={styles.linkText}>Clear</Text>
        </Pressable>
      )}

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}
    </BottomSheet>
  );
}

/** Small intensity cue next to the label (decorative - the label carries the meaning). */
function Intensity({ drops }: { drops: number }) {
  if (drops === 0) return null;
  return (
    <View style={styles.drops} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {drops < 0 ? (
        <Ionicons name="ellipse" size={7} color={colors.magenta} />
      ) : (
        Array.from({ length: drops }, (_, i) => <Ionicons key={i} name="water" size={14} color={colors.magenta} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, color: colors.textSecondary },
  dateBlock: { marginTop: spacing.xs, marginBottom: spacing.xs },
  dateRel: { fontSize: 13, fontWeight: '700', color: colors.magentaText },
  dateText: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 2 },
  list: { gap: spacing.sm },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  rowOn: { borderColor: colors.magenta, backgroundColor: colors.pinkVerySoft },
  pressed: { opacity: 0.85 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.toggleOff,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.navy },
  rowLabelOn: { fontWeight: '700' },
  drops: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lavender,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  noteText: { flex: 1, fontSize: 13.5, color: colors.navy, lineHeight: 19 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14.5, fontWeight: '700', color: colors.magentaText },
  error: { fontSize: 13.5, fontWeight: '600', color: colors.magentaText, lineHeight: 19 },
});
