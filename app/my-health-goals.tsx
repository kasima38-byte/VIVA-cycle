// VIVA Cycle - My Health Goals (opened from Profile).
// Shows and changes her ONE saved goal (lib/vivaStore.ts `goal`, options in lib/goals.ts) - the
// same setting as Cycle Settings > My goal. A goal changes what Home shows and how guidance is
// worded; it never changes period history or the cycle estimates themselves.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IntroCard from '../components/IntroCard';
import { colors, radius, spacing } from '../constants/theme';
import type { Goal } from '../lib/cycleEngine';
import { GOAL_OPTIONS, goalSaveMessage } from '../lib/goals';
import { setGoal, useVivaStore } from '../lib/vivaStore';

export default function MyHealthGoalsScreen() {
  const { goal } = useVivaStore();
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  const choose = async (next: Goal) => {
    if (busy.current || next === goal) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const msg = goalSaveMessage(await setGoal(next), next);
      setMessage(msg);
      AccessibilityInfo.announceForAccessibility(msg.text);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable onPress={() => router.back()} hitSlop={14} accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={26} color={colors.navy} />
              </Pressable>
              {/* VIVA Cycle logo reserved here once the official asset is supplied */}
              <View style={{ width: 90, height: 40 }} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              My Health Goals
            </Text>
            <Text style={styles.subtitle}>Choose what you want to focus on.</Text>
          </View>

          <IntroCard
            icon="flag"
            title="Your goal shapes VIVA"
            description="It changes what Home shows and how guidance is worded. Your dates stay the same."
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Your goal
            </Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {GOAL_OPTIONS.map((o) => {
                const selected = goal === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => void choose(o.key)}
                    disabled={saving}
                    style={[styles.option, selected && styles.optionSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: saving }}
                    accessibilityLabel={o.label + '. ' + o.detail}
                    accessibilityHint={selected ? undefined : 'Makes this your goal.'}
                  >
                    <View style={styles.optionTop}>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                      </View>
                      <View style={styles.flex}>
                        <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{o.label}</Text>
                        <Text style={styles.optionDetail}>{o.detail}</Text>
                      </View>
                    </View>
                    <Text style={styles.changes}>{o.changes}</Text>
                  </Pressable>
                );
              })}
            </View>
            {goal === null && <Text style={styles.note}>You haven't chosen a goal yet.</Text>}
            {message && (
              <View
                style={message.kind === 'error' ? styles.errorBox : styles.infoBox}
                accessibilityLiveRegion={message.kind === 'error' ? 'assertive' : 'polite'}
              >
                <Ionicons
                  name={message.kind === 'error' ? 'alert-circle' : 'checkmark-circle'}
                  size={18}
                  color={message.kind === 'error' ? colors.magentaText : colors.green}
                />
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            )}
          </View>

          <View style={[styles.groupedCard, styles.textCard]}>
            <Text style={styles.body}>
              Changing your goal never changes your period history or your cycle estimates. Estimates come from
              calendar dates and can vary. VIVA Cycle can't diagnose fertility or pregnancy, and its estimates are
              not contraception.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.screenH, paddingBottom: 40, gap: spacing.xl },
  header: { gap: 6 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  subtitle: { fontSize: 18, color: colors.textSecondary, textAlign: 'center' },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.navy },
  options: { gap: spacing.md },
  option: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  optionSelected: { borderColor: colors.magenta, backgroundColor: colors.pinkVerySoft },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.mutedGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  optionTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  optionTitleSelected: { color: colors.magentaText },
  optionDetail: { fontSize: 14.5, color: colors.textSecondary, marginTop: 2 },
  changes: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19, marginLeft: 40 },
  note: { fontSize: 13.5, color: colors.textSecondary },
  groupedCard: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  textCard: { padding: spacing.lg },
  body: { fontSize: 14.5, color: colors.textSecondary, lineHeight: 20 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.pinkSoft,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.lightGreen,
  },
  messageText: { flex: 1, fontSize: 14, color: colors.navy, lineHeight: 19 },
});
