import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '../components/BottomSheet';
import { Goal, updateSettings, useSettings } from '../constants/settingsStore';
import { colors, radius, spacing } from '../constants/theme';

type Open = 'goal' | 'cycle' | 'period' | null;

const GOAL_OPTIONS: { key: Goal; label: string; detail: string }[] = [
  { key: 'conceive', label: 'Trying to conceive', detail: 'Focus on your estimated fertile window and timing.' },
  { key: 'avoid', label: 'Avoiding pregnancy', detail: 'Focus on days that may be fertile. Estimates are not contraception.' },
  { key: null, label: 'Not set', detail: 'Just track your cycle for now.' },
];

function goalLabel(goal: Goal) {
  if (goal === 'conceive') return 'Trying to conceive';
  if (goal === 'avoid') return 'Avoiding pregnancy';
  return 'Not set';
}

export default function CycleSettingsScreen() {
  const settings = useSettings();
  const [open, setOpen] = useState<Open>(null);

  const step = (field: 'cycleLength' | 'periodLength', delta: number, min: number, max: number) => {
    const next = Math.min(max, Math.max(min, settings[field] + delta));
    updateSettings({ [field]: next });
  };

  const rows: { key: Exclude<Open, null>; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; value: string }[] = [
    { key: 'goal', icon: 'flag', title: 'My goal', subtitle: 'Tailors the guidance you see', value: goalLabel(settings.goal) },
    { key: 'cycle', icon: 'sync', title: 'Typical cycle length', subtitle: 'Usually between 21 and 35 days', value: settings.cycleLength + ' days' },
    { key: 'period', icon: 'water', title: 'Typical period length', subtitle: 'Usually between 2 and 7 days', value: settings.periodLength + ' days' },
  ];
  
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
            Fertility information in VIVA Cycle is an estimate based on your cycle history. It is not contraception and
            cannot confirm ovulation or pregnancy.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <BottomSheet visible={open === 'goal'} title="My goal" onClose={() => setOpen(null)}>
        {GOAL_OPTIONS.map((g) => {
          const selected = settings.goal === g.key;
          return (
            <Pressable
              key={String(g.key)}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => updateSettings({ goal: g.key })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{g.label}</Text>
                <Text style={styles.optionDetail}>{g.detail}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.magenta} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>

      <BottomSheet visible={open === 'cycle'} title="Typical cycle length" onClose={() => setOpen(null)}>
        <View style={styles.stepper}>
          <Pressable style={styles.stepButton} onPress={() => step('cycleLength', -1, 21, 35)} accessibilityLabel="Decrease cycle length">
            <Ionicons name="remove" size={24} color={colors.magenta} />
          </Pressable>
          <Text style={styles.stepValue}>{settings.cycleLength} days</Text>
          <Pressable style={styles.stepButton} onPress={() => step('cycleLength', 1, 21, 35)} accessibilityLabel="Increase cycle length">
            <Ionicons name="add" size={24} color={colors.magenta} />
          </Pressable>
        </View>
        <Text style={styles.optionDetail}>
          Once you have logged several periods, estimates use your own history instead.
        </Text>
      </BottomSheet>

      <BottomSheet visible={open === 'period'} title="Typical period length" onClose={() => setOpen(null)}>
        <View style={styles.stepper}>
          <Pressable style={styles.stepButton} onPress={() => step('periodLength', -1, 2, 7)} accessibilityLabel="Decrease period length">
            <Ionicons name="remove" size={24} color={colors.magenta} />
          </Pressable>
          <Text style={styles.stepValue}>{settings.periodLength} days</Text>
          <Pressable style={styles.stepButton} onPress={() => step('periodLength', 1, 2, 7)} accessibilityLabel="Increase period length">
            <Ionicons name="add" size={24} color={colors.magenta} />
          </Pressable>
        </View>
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