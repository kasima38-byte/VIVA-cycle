// VIVA Cycle - My Data (opened from Profile).
// A read-only summary of what is saved, an export of her own records, and a link to
// Privacy & Security for deleting. Opening this screen never changes or deletes anything.
// All numbers come live from the canonical store, so Calendar edits show up straight away.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IntroCard from '../components/IntroCard';
import SettingsRow from '../components/SettingsRow';
import { colors, radius, spacing } from '../constants/theme';
import { GOAL_LABELS, REGULARITY_LABELS, formatDate, getMyDataSummary } from '../lib/myData';
import { useExportData } from '../lib/useExportData';
import { useVivaStore } from '../lib/vivaStore';

const days = (n: number | null) => (n === null ? 'Not set' : n + (n === 1 ? ' day' : ' days'));

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StatCard({ rows }: { rows: [string, string][] }) {
  return (
    <View style={styles.groupedCard}>
      {rows.map(([label, value], i) => (
        <View key={label} style={[styles.statRow, i > 0 && styles.divider]} accessible accessibilityLabel={`${label}: ${value}`}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function MyDataScreen() {
  const state = useVivaStore();
  const s = getMyDataSummary(state);
  const { requestExport, exporting, message } = useExportData();

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
              My Data
            </Text>
            <Text style={styles.subtitle}>What VIVA Cycle has saved for you.</Text>
          </View>

          <IntroCard icon="bar-chart" title="Your data at a glance" description="A summary of your records, and a copy you can keep." />

          {/* ---------- A. Menstrual Tracking ---------- */}
          <View style={styles.section}>
            <SectionHeading title="Menstrual Tracking" subtitle="Only days you recorded. Predictions are not counted." />
            <StatCard
              rows={[
                ['Periods recorded', String(s.periodsRecorded)],
                ['Most recent period started', formatDate(s.latestPeriodStart)],
                ['Bleeding days recorded', String(s.bleedingDays)],
                ['Usual cycle length', days(s.usualCycleLength)],
                ['Usual period length', days(s.usualPeriodLength)],
                ['Cycle regularity', REGULARITY_LABELS[s.regularity] ?? 'Not sure'],
                ['Goal', s.goal ? GOAL_LABELS[s.goal] : 'Not set'],
              ]}
            />
          </View>

          {/* ---------- B. Daily Tracking ---------- */}
          <View style={styles.section}>
            <SectionHeading title="Daily Tracking" subtitle="Days with symptoms, mood or other entries." />
            <StatCard
              rows={[
                ['Days with entries', String(s.trackingDays)],
                ['Most recent entry', formatDate(s.latestTrackingDate)],
              ]}
            />
          </View>

          {/* ---------- C. Data Storage ---------- */}
          <View style={styles.section}>
            <SectionHeading title="Data Storage" subtitle="Where your records are kept." />
            <View style={[styles.groupedCard, styles.textCard]}>
              <Text style={styles.body}>
                Your records are saved on this phone in the app's local storage (AsyncStorage). VIVA Cycle has no
                account and no VIVA server. Local storage is not end-to-end encryption.
              </Text>
            </View>
            <SettingsRow
              icon="lock-closed"
              title="Privacy & Security"
              subtitle="Backups, permissions, and deleting all your data"
              onPress={() => router.push('/privacy-security')}
            />
          </View>

          {/* ---------- D. Export My Data ---------- */}
          <View style={styles.section}>
            <SectionHeading title="Export My Data" subtitle="A copy of your records as a JSON file." />
            <Pressable
              onPress={() => void requestExport()}
              disabled={exporting}
              style={({ pressed }) => [styles.exportButton, pressed && styles.exportPressed]}
              accessibilityRole="button"
              accessibilityLabel={exporting ? 'Preparing export' : 'Export my data'}
              accessibilityHint="Shows what the file contains first. Nothing is shared until you choose where it goes."
              accessibilityState={{ disabled: exporting, busy: exporting }}
            >
              {exporting ? (
                <ActivityIndicator color={colors.magenta} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.magenta} />
              )}
              <Text style={styles.exportText}>{exporting ? 'Preparing…' : 'Export my data'}</Text>
            </Pressable>
            <Text style={styles.note}>
              You'll see what the file contains before anything is created. It may contain sensitive
              reproductive-health information, so only share it with people and apps you trust. Exporting doesn't
              change or delete your records.
            </Text>
            {message && (
              <View
                style={message.kind === 'error' ? styles.errorBox : styles.infoBox}
                accessibilityLiveRegion={message.kind === 'error' ? 'assertive' : 'polite'}
              >
                <Ionicons
                  name={message.kind === 'error' ? 'alert-circle' : 'information-circle'}
                  size={18}
                  color={message.kind === 'error' ? colors.magentaText : colors.navy}
                />
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.screenH, paddingBottom: 40, gap: spacing.xl },
  header: { gap: 6 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  subtitle: { fontSize: 18, color: colors.textSecondary, textAlign: 'center' },
  section: { gap: spacing.md },
  sectionHeading: { gap: 2 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.navy },
  sectionSubtitle: { fontSize: 15.5, color: colors.textSecondary },
  groupedCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  textCard: { padding: spacing.lg },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  statLabel: { flex: 1, fontSize: 15.5, color: colors.textSecondary },
  statValue: { fontSize: 15.5, fontWeight: '700', color: colors.navy, textAlign: 'right', flexShrink: 1 },
  body: { fontSize: 14.5, color: colors.textSecondary, lineHeight: 20 },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.magenta,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
  },
  exportPressed: { backgroundColor: colors.pinkVerySoft },
  exportText: { fontSize: 16, fontWeight: '700', color: colors.magentaText },
  note: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
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
    backgroundColor: colors.lavender,
  },
  messageText: { flex: 1, fontSize: 14, color: colors.navy, lineHeight: 19 },
});
