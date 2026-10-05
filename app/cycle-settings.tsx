import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '../components/BottomSheet';
import { colors, radius, spacing } from '../constants/theme';
import { Goal, Regularity } from '../lib/cycleEngine';
import { setGoal, updateBaseline, useVivaStore } from '../lib/vivaStore';

// Settings change the BASELINE only. Confirmed period history is never touched.

type Open = 'goal' | 'cycle' | 'period' | 'regularity' | null;

const CYCLE_RANGE = { min: 21, max: 45, fallback: 28 };   // same as Welcome
const PERIOD_RANGE = { min: 2, max: 10, fallback: 5 };    // same as Welcome

const GOAL_OPTIONS: { key: Goal; label: string; detail: string }[] = [
  { key: 'understand', label: 'Understand my cycle', detail: 'Learn how your cycle works.' },
  { key: 'track', label: 'Track my cycle', detail: 'Keep a record of your periods and patterns.' },
  { key: 'conceive', label: 'Try to get pregnant', detail: 'Focus on your estimated fertile window and timing.' },
  { key: 'avoid', label: 'Avoid pregnancy', detail: 'Focus on days that may be fertile. Estimates are not contraception.' },
];

const REGULARITY_OPTIONS: { key: Regularity; label: string; detail: string }[] = [
  { key: 'regular', label: 'Regular', detail: 'Your cycle length is usually about the same.' },
  { key: 'somewhat_irregular', label: 'Somewhat irregular', detail: 'Your cycle length sometimes changes.' },
  { key: 'irregular', label: 'Irregular', detail: 'Your cycle length often changes.' },
  { key: 'not_sure', label: 'Not sure', detail: 'That’s fine — logging periods will show your pattern.' },
];

const goalLabel = (g: Goal | null) => GOAL_OPTIONS.find((o) => o.key === g)?.label ?? 'Not set';
const regularityLabel = (r: Regularity) => REGULARITY_OPTIONS.find((o) => o.key === r)?.label ?? 'Not sure';
const daysLabel = (n: number | null) => (n === null ? 'Not sure' : n + ' days');

export default function CycleSettingsScreen() {
  const { baseline, goal } = useVivaStore();
  const [open, setOpen] = useState<Open>(null);

  const step = (field: 'cycleLength' | 'periodLength', delta: number) => {
    const range = field === 'cycleLength' ? CYCLE_RANGE : PERIOD_RANGE;
    const current = baseline[field] ?? range.fallback;
    const next = Math.min(range.max, Math.max(range.min, current + delta));
    updateBaseline({ [field]: next });
  };

  const rows: { key: Exclude<Open, null>; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; value: string }[] = [
    { key: 'goal', icon: 'flag', title: 'My goal', subtitle: 'Tailors the guidance you see', value: goalLabel(goal) },
    { key: 'cycle', icon: 'sync', title: 'Usual cycle length', subtitle: 'Usually between 21 and 35 days', value: daysLabel(baseline.cycleLength) },
    { key: 'period', icon: 'water', title: 'Usual period length', subtitle: 'Usually between 2 and 7 days', value: daysLabel(baseline.periodLength) },
    { key: 'regularity', icon: 'pulse', title: 'Cycle regularity', subtitle: 'How much your cycle length changes', value: regularityLabel(baseline.regularity) },
  ];

  const renderOption = (key: string, label: string, detail: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{label}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.magenta} /> : null}
    </Pressable>
  );

  const stepper = (field: 'cycleLength' | 'periodLength', what: string) => (
    <View style={styles.stepper}>
      <Pressable style={styles.stepButton} onPress={() => step(field, -1)} accessibilityLabel={'Decrease ' + what}>
        <Ionicons name="remove" size={24} color={colors.magenta} />
      </Pressable>
      <Text style={styles.stepValue}>{daysLabel(baseline[field])}</Text>
      <Pressable style={styles.stepButton} onPress={() => step(field, 1)} accessibilityLabel={'Increase ' + what}>
        <Ionicons name="add" size={24} color={colors.magenta} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} hitSlop={14} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Cycle settings</Text>
            <Text style={styles.subtitle}>Set your cycle preferences and goals.</Text>
          </View>

          <View style={styles.list}>
            {rows.map((r) => (
              <Pressable
                key={r.key}
                style={styles.row}
                onPress={() => setOpen(r.key)}
                accessibilityRole="button"
                accessibilityLabel={r.title + ', ' + r.value}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={r.icon} size={22} color={colors.magenta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.rowSubtitle}>{r.subtitle}</Text>
                </View>
                <Text style={styles.rowValue}>{r.value}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.navy} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.footnote}>
            Changing these settings updates future estimates only. Periods you have already logged are never changed.
            Fertility information in VIVA Cycle is an estimate. It is not contraception and cannot confirm ovulation or
            pregnancy.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <BottomSheet visible={open === 'goal'} title="My goal" onClose={() => setOpen(null)}>
        {GOAL_OPTIONS.map((g) => renderOption(g.key, g.label, g.detail, goal === g.key, () => setGoal(g.key)))}
      </BottomSheet>

      <BottomSheet visible={open === 'cycle'} title="Usual cycle length" onClose={() => setOpen(null)}>
        {stepper('cycleLength', 'cycle length')}
        {renderOption('not_sure', 'I’m not sure', 'Estimates assume 28 days until you log your next period.',
          baseline.cycleLength === null, () => updateBaseline({ cycleLength: null }))}
        <Text style={styles.optionDetail}>
          Once you have logged a few periods, estimates use your own history instead.
        </Text>
      </BottomSheet>

      <BottomSheet visible={open === 'period'} title="Usual period length" onClose={() => setOpen(null)}>
        {stepper('periodLength', 'period length')}
        {renderOption('not_sure', 'I’m not sure', 'Estimates assume 5 days until you record more periods.',
          baseline.periodLength === null, () => updateBaseline({ periodLength: null }))}
      </BottomSheet>

      <BottomSheet visible={open === 'regularity'} title="Cycle regularity" onClose={() => setOpen(null)}>
        {REGULARITY_OPTIONS.map((r) =>
          renderOption(r.key, r.label, r.detail, baseline.regularity === r.key, () => updateBaseline({ regularity: r.key }))
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.screenH, paddingBottom: 40, gap: spacing.lg },
  header: { gap: 4 },
  title: { fontSize: 30, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  rowSubtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.magenta, maxWidth: 110, textAlign: 'right' },
  footnote: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionSelected: { borderColor: colors.magenta, backgroundColor: colors.pinkVerySoft },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  optionTitleSelected: { color: colors.magenta },
  optionDetail: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 26, fontWeight: '800', color: colors.navy, minWidth: 110, textAlign: 'center' },
});