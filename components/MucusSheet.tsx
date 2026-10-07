// VIVA Cycle - Cervical Mucus sheet (Daily Tracking)
// Records what she observed (lib/mucusService.ts). Only this observation changes;
// every other answer for the day is left exactly as it was.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { MUCUS_NOTE_MAX, MUCUS_OBSERVATIONS, normalizeMucusNote } from '../lib/cervicalMucus';
import type { MucusValue } from '../lib/cervicalMucus';
import { formatLongDate, relativeDayName } from '../lib/dailyTracking';
import { MucusResult, saveMucus } from '../lib/mucusService';
import { useVivaStore } from '../lib/vivaStore';
import BottomSheet from './BottomSheet';

type Tone = 'success' | 'error' | 'info';

type Props = {
  visible: boolean;
  date: string;
  today: string;
  onClose: () => void;
  onFeedback: (text: string, tone: Tone) => void;
};

const ERRORS: Partial<Record<MucusResult, string>> = {
  future: 'Observations can only be recorded for today or earlier.',
  invalid: "That observation isn't recognised.",
  failed: "Couldn't save. Please try again.",
};

export default function MucusSheet({ visible, date, today, onClose, onFeedback }: Props) {
  const { dailyLogs } = useVivaStore();
  const savedValue = dailyLogs[date]?.cervicalMucus ?? null;
  const savedNote = dailyLogs[date]?.cervicalMucusNote ?? null;
  const { height } = useWindowDimensions();

  const [choice, setChoice] = useState<MucusValue | null>(savedValue);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every time the sheet opens, show what is saved for the selected date
  useEffect(() => {
    if (!visible) return;
    setChoice(dailyLogs[date]?.cervicalMucus ?? null);
    setNote(dailyLogs[date]?.cervicalMucusNote ?? '');
    setBusy(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, date]);

  const cleanNote = choice === 'other' ? normalizeMucusNote(note) : null;
  const unchanged = choice === savedValue && cleanNote === savedNote;
  const rel = relativeDayName(date, today);
  const isToday = date === today;

  const run = async (value: MucusValue | null, noteText: string | null, successText: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await saveMucus(date, value, noteText);
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

  const successText =
    choice === null ? 'Observation cleared' : savedValue === null ? 'Cervical mucus saved' : 'Cervical mucus updated';

  return (
    <BottomSheet
      visible={visible}
      title="Cervical Mucus"
      onClose={onClose}
      primaryLabel={busy ? 'Saving…' : 'Save'}
      onPrimary={() => void run(choice, cleanNote, successText)}
      primaryDisabled={busy || unchanged}
    >
      <Text style={styles.subtitle}>{isToday ? 'What did you notice today?' : 'What did you notice on this day?'}</Text>
      <View
        style={styles.dateBlock}
        accessible
        accessibilityLabel={'Selected date: ' + (rel ? rel + ', ' : '') + formatLongDate(date)}
      >
        {rel && <Text style={styles.dateRel}>{rel}</Text>}
        <Text style={styles.dateText}>{formatLongDate(date)}</Text>
      </View>

      <ScrollView style={{ maxHeight: height * 0.42 }} contentContainerStyle={styles.list} nestedScrollEnabled>
        <View accessibilityRole="radiogroup" accessibilityLabel="Cervical mucus observation" style={styles.list}>
          {MUCUS_OBSERVATIONS.map((o) => {
            const selected = o.id === choice;
            return (
              <Pressable
                key={o.id}
                onPress={() => setChoice(o.id)}
                style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && styles.pressed]}
                accessibilityRole="radio"
                accessibilityLabel={o.label + ' cervical mucus. ' + o.description}
                accessibilityState={{ checked: selected, selected }}
              >
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected && <Ionicons name="checkmark" size={16} color={colors.white} />}
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>{o.label}</Text>
                  <Text style={styles.optionDesc}>{o.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {choice === 'other' && (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={MUCUS_NOTE_MAX}
            multiline
            textAlignVertical="top"
            placeholder="e.g. thicker than usual"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            returnKeyType="done"
            accessibilityLabel="Optional note about this observation"
          />
          <Text style={styles.counter}>
            {note.length}/{MUCUS_NOTE_MAX}
          </Text>
        </View>
      )}

      {savedValue !== null && (
        <Pressable
          onPress={() => void run(null, null, 'Observation cleared')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Clear observation"
          accessibilityHint="Sets cervical mucus back to not tracked"
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  dateBlock: { marginTop: spacing.xs, marginBottom: spacing.xs },
  dateRel: { fontSize: 13, fontWeight: '700', color: colors.magenta },
  dateText: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 2 },
  list: { gap: spacing.sm },
  option: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  optionOn: { borderColor: colors.magenta, backgroundColor: colors.pinkVerySoft },
  pressed: { opacity: 0.85 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.mutedGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  optionLabel: { fontSize: 16, fontWeight: '600', color: colors.navy },
  optionLabelOn: { fontWeight: '700' },
  optionDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  noteBox: { gap: 4 },
  noteLabel: { fontSize: 13.5, fontWeight: '600', color: colors.navy },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.navy,
    backgroundColor: colors.white,
  },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: colors.textSecondary },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14.5, fontWeight: '700', color: colors.magenta },
  error: { fontSize: 13.5, fontWeight: '600', color: colors.magenta, lineHeight: 19 },
});
