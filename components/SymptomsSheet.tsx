// VIVA Cycle - Symptoms sheet (Daily Tracking)
// Multi-select from the central library (lib/symptoms.ts). Saves ONLY the symptoms field
// (lib/symptomService.ts): period, flow and other answers are never touched.

import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { formatLongDate, relativeDayName } from '../lib/dailyTracking';
import { SymptomResult, saveSymptoms } from '../lib/symptomService';
import { SYMPTOM_CATEGORIES, normalizeSymptomIds, symptomPreview, symptomsInCategory } from '../lib/symptoms';
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

const ERRORS: Partial<Record<SymptomResult, string>> = {
  future: 'Symptoms can only be recorded for today or earlier.',
  invalid: "One of those symptoms isn't recognised.",
  failed: "Couldn't save. Please try again.",
};

export default function SymptomsSheet({ visible, date, today, onClose, onFeedback }: Props) {
  const { dailyLogs } = useVivaStore();
  const saved = dailyLogs[date]?.symptoms ?? null;
  const { height } = useWindowDimensions();

  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every time the sheet opens, load what is saved for the selected date
  useEffect(() => {
    if (!visible) return;
    setSelected(dailyLogs[date]?.symptoms ?? []);
    setBusy(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, date]);

  const toggle = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const normalized = useMemo(() => normalizeSymptomIds(selected), [selected]);
  const unchanged = JSON.stringify(normalized) === JSON.stringify(saved ?? []);
  const isToday = date === today;
  const rel = relativeDayName(date, today);

  const successText =
    normalized.length === 0 ? 'Symptoms cleared' : !saved || saved.length === 0 ? 'Symptoms saved' : 'Symptoms updated';

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await saveSymptoms(date, normalized.length > 0 ? normalized : null);
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

  return (
    <BottomSheet
      visible={visible}
      title="Symptoms"
      onClose={onClose}
      primaryLabel={busy ? 'Saving…' : 'Save Symptoms'}
      onPrimary={() => void save()}
      primaryDisabled={busy || unchanged}
    >
      <Text style={styles.subtitle}>{isToday ? 'How are you feeling today?' : 'How were you feeling on this day?'}</Text>
      <View
        style={styles.dateBlock}
        accessible
        accessibilityLabel={'Selected date: ' + (rel ? rel + ', ' : '') + formatLongDate(date)}
      >
        {rel && <Text style={styles.dateRel}>{rel}</Text>}
        <Text style={styles.dateText}>{formatLongDate(date)}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summary} numberOfLines={2} accessibilityLiveRegion="polite">
          {normalized.length === 0 ? (
            isToday ? 'No symptoms recorded today.' : 'No symptoms recorded for this day.'
          ) : (
            <>
              <Text style={styles.summaryLabel}>Selected: </Text>
              {symptomPreview(normalized)}
            </>
          )}
        </Text>
        {normalized.length > 0 && (
          <Pressable
            onPress={() => setSelected([])}
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel="Clear all symptoms"
            accessibilityHint="Deselects every symptom. Tap Save Symptoms to confirm."
          >
            <Text style={styles.linkText}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ maxHeight: height * 0.45 }}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
      >
        {SYMPTOM_CATEGORIES.map((cat) => {
          const items = symptomsInCategory(cat.id, saved ?? []);
          if (items.length === 0) return null;
          return (
            <View key={cat.id} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {cat.label}
              </Text>
              <View style={styles.chips}>
                {items.map((s) => (
                  <Chip key={s.id} id={s.id} label={s.label} selected={selected.includes(s.id)} onToggle={toggle} />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}
    </BottomSheet>
  );
}

const Chip = memo(function Chip({
  id, label, selected, onToggle,
}: { id: string; label: string; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
        size={18}
        color={selected ? colors.white : colors.magenta}
      />
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, color: colors.textSecondary },
  dateBlock: { marginTop: spacing.xs },
  dateRel: { fontSize: 13, fontWeight: '700', color: colors.magenta },
  dateText: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.sm,
    paddingLeft: spacing.md,
  },
  summary: { flex: 1, fontSize: 14, color: colors.navy, paddingVertical: spacing.sm },
  summaryLabel: { fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.magenta },
  scrollContent: { gap: spacing.lg, paddingBottom: spacing.xs },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.pinkVerySoft,
    borderWidth: 1,
    borderColor: colors.pinkSoft,
  },
  chipOn: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  pressed: { opacity: 0.85 },
  chipText: { fontSize: 14.5, fontWeight: '600', color: colors.navy },
  chipTextOn: { color: colors.white },
  error: { fontSize: 13.5, fontWeight: '600', color: colors.magenta, lineHeight: 19 },
});
