// VIVA Cycle - Privacy & Security (opened from Profile).
// Explains, truthfully, how the app handles data (text: lib/privacyContent.ts) and offers
// "Delete all my data". Opening this screen never deletes anything: deletion needs two
// confirmations (lib/useDeleteAllData.ts -> lib/deleteFlow.ts -> lib/dataDeletionService.ts).

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IntroCard from '../components/IntroCard';
import { colors, radius, spacing } from '../constants/theme';
import { InfoItem, MANAGE_DATA, PERMISSIONS, PRIVACY_HEADER, YOUR_DATA } from '../lib/privacyContent';
import { useDeleteAllData } from '../lib/useDeleteAllData';

function InfoCard({ items }: { items: InfoItem[] }) {
  return (
    <View style={styles.groupedCard}>
      {items.map((item, i) => (
        <View
          key={item.title}
          style={[styles.infoRow, i > 0 && styles.infoDivider]}
          accessible
          accessibilityLabel={`${item.title}. ${item.body}`}
        >
          <View style={styles.infoIcon}>
            <Ionicons name={item.icon} size={22} color={colors.magenta} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.infoTitle}>{item.title}</Text>
            <Text style={styles.infoBody}>{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

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

export default function PrivacySecurityScreen() {
  const { requestDeleteAll, deleting, lastOutcome } = useDeleteAllData();
  // Only a failed or partial delete is shown here; a full delete moves on to Welcome
  const failure =
    lastOutcome?.kind === 'finished' && lastOutcome.result.dataDeleted !== 'all' ? lastOutcome.message : null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={26} color={colors.navy} />
              </Pressable>
              {/* VIVA Cycle logo reserved here once the official asset is supplied */}
              <View style={{ width: 90, height: 40 }} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {PRIVACY_HEADER.title}
            </Text>
            <Text style={styles.subtitle}>{PRIVACY_HEADER.subtitle}</Text>
          </View>

          <IntroCard icon="lock-closed" title={PRIVACY_HEADER.introTitle} description={PRIVACY_HEADER.introBody} />

          {/* ---------- A. Your Data ---------- */}
          <View style={styles.section}>
            <SectionHeading title={YOUR_DATA.title} subtitle={YOUR_DATA.subtitle} />
            <InfoCard items={YOUR_DATA.items} />
          </View>

          {/* ---------- B. Permissions ---------- */}
          <View style={styles.section}>
            <SectionHeading title={PERMISSIONS.title} subtitle={PERMISSIONS.subtitle} />
            <InfoCard items={PERMISSIONS.items} />
            <Pressable
              onPress={() => void Linking.openSettings().catch(() => {})}
              style={styles.outlineButton}
              accessibilityRole="button"
              accessibilityLabel={PERMISSIONS.settingsButton}
              accessibilityHint="Opens VIVA Cycle in your phone settings, where you can change permissions."
            >
              <Ionicons name="settings-outline" size={18} color={colors.navy} />
              <Text style={styles.outlineButtonText}>{PERMISSIONS.settingsButton}</Text>
            </Pressable>
          </View>

          {/* ---------- C. Manage Your Data ---------- */}
          <View style={styles.section}>
            <SectionHeading title={MANAGE_DATA.title} subtitle={MANAGE_DATA.subtitle} />
            <Pressable
              onPress={() => void requestDeleteAll()}
              disabled={deleting}
              style={({ pressed }) => [styles.dangerCard, pressed && styles.dangerPressed]}
              accessibilityRole="button"
              accessibilityLabel={deleting ? MANAGE_DATA.deletingLabel : MANAGE_DATA.deleteTitle}
              accessibilityHint="Opens a confirmation. Nothing is deleted until you confirm twice."
              accessibilityState={{ disabled: deleting, busy: deleting }}
            >
              <View style={styles.dangerIcon}>
                {deleting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Ionicons name="trash-outline" size={22} color={colors.white} />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.dangerTitle}>{deleting ? MANAGE_DATA.deletingLabel : MANAGE_DATA.deleteTitle}</Text>
                <Text style={styles.dangerBody}>{MANAGE_DATA.deleteBody}</Text>
              </View>
            </Pressable>
            <Text style={styles.note}>{MANAGE_DATA.note}</Text>

            {failure && (
              <View style={styles.errorBox} accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle" size={18} color={colors.magentaText} />
                <View style={styles.flex}>
                  <Text style={styles.errorTitle}>{failure.title}</Text>
                  <Text style={styles.errorBody}>{failure.body}</Text>
                </View>
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
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 40,
    gap: spacing.xl,
  },
  header: { gap: 6 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  infoDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  infoBody: { fontSize: 14.5, color: colors.textSecondary, marginTop: 3, lineHeight: 20 },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.navy,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
  },
  outlineButtonText: { fontSize: 15.5, fontWeight: '600', color: colors.navy },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 72,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.magenta,
    backgroundColor: colors.pinkVerySoft,
  },
  dangerPressed: { backgroundColor: colors.pinkSoft },
  dangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTitle: { fontSize: 17, fontWeight: '700', color: colors.magentaText },
  dangerBody: { fontSize: 14.5, color: colors.textSecondary, marginTop: 2, lineHeight: 20 },
  note: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.pinkSoft,
  },
  errorTitle: { fontSize: 15, fontWeight: '700', color: colors.magentaText },
  errorBody: { fontSize: 14, color: colors.navy, marginTop: 2, lineHeight: 19 },
});
