// VIVA Cycle - Daily Tracking Settings
// Settings control what appears in Daily Tracking. Hiding never deletes anything,
// and recorded data still counts in Insights.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '../components/BottomSheet';
import { colors, radius, spacing } from '../constants/theme';
import { DEFAULT_TRACKING_SETTINGS, SettingKey } from '../lib/dailyTrackingSettings';
import { resetSettings, updateSetting, useTrackingSettings } from '../lib/dailyTrackingSettingsService';
import { clearAllTrackingData, getClearSummary } from '../lib/dailyTrackingService';
import { useVivaStore } from '../lib/vivaStore';

const ROWS: { key: SettingKey; label: string; note?: string }[] = [
  { key: 'periodEnabled', label: 'Period', note: 'Needed for your cycle, Calendar and Insights.' },
  { key: 'flowEnabled', label: 'Flow / Spotting' },
  { key: 'symptomsEnabled', label: 'Symptoms' },
  { key: 'moodEnabled', label: 'Mood' },
  { key: 'energyEnabled', label: 'Energy' },
  { key: 'cervicalMucusEnabled', label: 'Cervical Mucus' },
  { key: 'sexualActivityEnabled', label: 'Sexual Activity', note: 'Private. Only shown inside the app.' },
  { key: 'medicationsEnabled', label: 'Medications', note: 'Private. Only shown inside the app.' },
];

export default function DailyTrackingSettingsScreen() {
  const { settings } = useTrackingSettings();
  useVivaStore(); // keeps the "Clear" summary up to date
  const summary = getClearSummary();
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_TRACKING_SETTINGS);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const say = (text: string) => {
    setMessage(text);
    AccessibilityInfo.announceForAccessibility(text);
  };

  const toggle = async (key: SettingKey, value: boolean) => {
    setError(null);
    setMessage(null);
    const result = await updateSetting(key, value);
    if (result === 'failed') setError("We couldn't save this setting. Please try again.");
  };

  const reset = async () => {
    setError(null);
    const result = await resetSettings();
    if (result === 'failed') setError("We couldn't save this setting. Please try again.");
    else if (result === 'saved') say('Tracking settings restored to default.');
  };

  const clear = async () => {
    if (clearing) return;
    setClearing(true);
    setError(null);
    const result = await clearAllTrackingData();
    setClearing(false);
    setConfirmOpen(false);
    if (result === 'failed') setError("We couldn't clear your data. Please try again.");
    else if (result === 'saved') say('Daily Tracking data cleared.');
  };

  const days = summary.daysAffected;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back to Daily Tracking"
          >
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          <Text style={styles.title} accessibilityRole="header">
            Daily Tracking Settings
          </Text>
          <Text style={styles.subtitle}>Choose what appears in Daily Tracking.</Text>

          {/* ---------- Tracking categories ---------- */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            TRACKING CATEGORIES
          </Text>
          <View style={styles.card}>
            {ROWS.map((row, i) => {
              const core = row.key === 'periodEnabled';
              const on = settings[row.key];
              return (
                <Pressable
                  key={row.key}
                  disabled={core}
                  onPress={() => void toggle(row.key, !on)}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                  accessibilityRole={core ? 'text' : 'switch'}
                  accessibilityLabel={row.label + (core ? ', required' : on ? ', on' : ', off') + (row.note ? '. ' + row.note : '')}
                  accessibilityState={core ? undefined : { checked: on }}
                  accessibilityHint={
                    core ? undefined : on ? 'Hides it from Daily Tracking. Nothing you recorded is deleted.' : 'Shows it in Daily Tracking again.'
                  }
                >
                  <View style={styles.flex}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    {row.note ? <Text style={styles.rowNote}>{row.note}</Text> : null}
                  </View>
                  {core ? (
                    <View style={styles.requiredPill}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  ) : (
                    <View style={styles.switchWrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                      <Text style={[styles.stateText, on && styles.stateOn]}>{on ? 'On' : 'Off'}</Text>
                      <Switch
                        value={on}
                        onValueChange={(v) => void toggle(row.key, v)}
                        trackColor={{ false: colors.border, true: colors.magenta }}
                        thumbColor={colors.white}
                        ios_backgroundColor={colors.border}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>
            Hiding a category only removes it from the Daily Tracking screen. Nothing you recorded is deleted, and it still
            counts in Insights.
          </Text>
          {!isDefault && (
            <Pressable
              onPress={() => void reset()}
              style={styles.link}
              accessibilityRole="button"
              accessibilityLabel="Reset Tracking Settings"
              accessibilityHint="Shows every category again. Nothing you recorded is changed."
            >
              <Text style={styles.linkText}>Reset Tracking Settings</Text>
            </Pressable>
          )}

          {/* ---------- Data ---------- */}
          <Text style={styles.sectionTitle} accessibilityRole="header">
            DATA
          </Text>
          <View style={styles.card}>
            <Pressable
              onPress={() => {
                setError(null);
                setMessage(null);
                setConfirmOpen(true);
              }}
              disabled={days === 0}
              style={[styles.row, days === 0 && styles.rowDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Clear Daily Tracking Data"
              accessibilityHint={days === 0 ? 'Nothing to clear' : 'Opens a confirmation. Nothing is removed until you confirm.'}
              accessibilityState={{ disabled: days === 0 }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.magenta} />
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, styles.danger]}>Clear Daily Tracking Data</Text>
                <Text style={styles.rowNote}>
                  {days === 0 ? 'Nothing to clear.' : 'Removes what you recorded in Daily Tracking. Period days are kept.'}
                </Text>
              </View>
            </Pressable>
          </View>
          <Text style={styles.note}>Export and backup aren't available yet.</Text>

          {message && (
            <View style={styles.message} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="assertive">
              {error}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>

      <BottomSheet
        visible={confirmOpen}
        title="Clear Daily Tracking Data?"
        onClose={() => setConfirmOpen(false)}
        primaryLabel={clearing ? 'Clearing…' : 'Clear Data'}
        onPrimary={() => void clear()}
        primaryDisabled={clearing}
      >
        <Text style={styles.confirmText}>
          This will permanently remove what you recorded in Daily Tracking on {days} {days === 1 ? 'day' : 'days'}: flow
          and spotting, symptoms, mood, energy, cervical mucus, sexual activity and medications.
        </Text>
        <Text style={styles.confirmText}>Your Insights will no longer include this data.</Text>
        <Text style={styles.confirmText}>
          Kept: your period days, so your Calendar, cycle history and cycle statistics stay as they are. To change period
          history, use Period History.
        </Text>
        <Text style={[styles.confirmText, styles.confirmStrong]}>This can't be undone.</Text>
        <Pressable
          onPress={() => setConfirmOpen(false)}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Cancel. Nothing is removed."
        >
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.screenH, paddingBottom: 40, gap: spacing.md },
  backButton: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowDisabled: { opacity: 0.55 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: colors.navy },
  rowNote: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  danger: { color: colors.magenta },
  requiredPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.pinkSoft,
  },
  requiredText: { fontSize: 12.5, fontWeight: '700', color: colors.magenta },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stateText: { fontSize: 13.5, fontWeight: '600', color: colors.textSecondary, minWidth: 26, textAlign: 'right' },
  stateOn: { color: colors.navy },
  note: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14.5, fontWeight: '700', color: colors.magenta },
  message: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  messageText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  error: { fontSize: 14, fontWeight: '600', color: colors.magenta },
  confirmText: { fontSize: 14.5, color: colors.navy, lineHeight: 21 },
  confirmStrong: { fontWeight: '700' },
});
