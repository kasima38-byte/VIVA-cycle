// VIVA Cycle - Privacy & Security (opened from Profile).
// Explains, truthfully, how the app handles data (text: lib/privacyContent.ts) and offers
// "Delete all my data". Opening this screen never deletes anything: deletion needs two
// confirmations (lib/useDeleteAllData.ts -> lib/deleteFlow.ts -> lib/dataDeletionService.ts).

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IntroCard from '../components/IntroCard';
import SettingsRow from '../components/SettingsRow';
import VivaToggle from '../components/VivaToggle';
import { colors, radius, spacing } from '../constants/theme';
import { syncReminders } from '../lib/notifications';
import {
  DISCREET, DiscreetNotice, InfoItem, MANAGE_DATA, PERMISSIONS, PRIVACY_HEADER, YOUR_DATA, discreetNotice,
} from '../lib/privacyContent';
import { useDeleteAllData } from '../lib/useDeleteAllData';
import { useAppLock } from '../lib/appLockSession';
import { APP_LOCK } from '../lib/appLockText';
import BiometricUnlockSettings from '../components/BiometricUnlockSettings';
import { getVivaState, setDiscreetNotifications, useVivaStore } from '../lib/vivaStore';

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

/** Discreet Notifications switch. Changing it saves the setting, then rebuilds the scheduled
 *  reminders with the new text. It never asks for notification permission. */
function DiscreetNotificationsCard() {
  const { discreetNotifications } = useVivaStore();
  const [notice, setNotice] = useState<DiscreetNotice | null>(null);
  const busy = useRef(false);

  const resync = async () => {
    const result = await syncReminders(getVivaState());
    setNotice(discreetNotice(true, result));
  };

  const change = async (next: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    try {
      const saved = await setDiscreetNotifications(next);
      if (saved) await resync();
      else setNotice(discreetNotice(false, null));
    } finally {
      busy.current = false;
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeading title={DISCREET.sectionTitle} subtitle={DISCREET.sectionSubtitle} />
      <View style={styles.groupedCard}>
        <Pressable
          onPress={() => void change(!discreetNotifications)}
          style={styles.toggleRow}
          accessibilityRole="switch"
          accessibilityLabel={DISCREET.title + '. ' + DISCREET.description}
          accessibilityState={{ checked: discreetNotifications }}
        >
          <View style={styles.infoIcon}>
            <Ionicons name="eye-off-outline" size={22} color={colors.magenta} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.infoTitle}>{DISCREET.title}</Text>
            <Text style={styles.infoBody}>{DISCREET.description}</Text>
          </View>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <VivaToggle value={discreetNotifications} onValueChange={(v) => void change(v)} />
          </View>
        </Pressable>
      </View>
      <Text style={styles.note}>{discreetNotifications ? DISCREET.onNote : DISCREET.offNote}</Text>
      <Text style={styles.note}>{DISCREET.scope}</Text>
      {notice && (
        <View
          style={notice.kind === 'error' ? styles.errorBox : styles.infoBox}
          accessibilityLiveRegion={notice.kind === 'error' ? 'assertive' : 'polite'}
        >
          <Ionicons
            name={notice.kind === 'error' ? 'alert-circle' : 'information-circle'}
            size={18}
            color={notice.kind === 'error' ? colors.magentaText : colors.navy}
          />
          <View style={styles.flex}>
            <Text style={styles.errorBody}>{notice.text}</Text>
            {notice.canRetry && (
              <Pressable onPress={() => void resync()} accessibilityRole="button" hitSlop={8} style={styles.retry}>
                <Text style={styles.retryText}>{DISCREET.retry}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/** App Lock: set up, change or turn off the PIN. Every change happens on the PIN screen,
 *  which checks the current PIN first; nothing changes just by opening this screen. */
function AppLockSection() {
  const { lockOn } = useAppLock();
  const open = (mode: 'setup' | 'change' | 'disable') => router.push({ pathname: '/app-lock-pin', params: { mode } });
  return (
    <View style={styles.section}>
      <SectionHeading title={APP_LOCK.sectionTitle} subtitle={APP_LOCK.sectionSubtitle} />
      {lockOn === false && (
        <SettingsRow icon="keypad" title={APP_LOCK.turnOn} subtitle={APP_LOCK.turnOnBody} onPress={() => open('setup')} />
      )}
      {lockOn === true && (
        <>
          <SettingsRow icon="keypad" title={APP_LOCK.change} subtitle={APP_LOCK.changeBody} onPress={() => open('change')} />
          <SettingsRow icon="lock-open" title={APP_LOCK.turnOff} subtitle={APP_LOCK.turnOffBody} onPress={() => open('disable')} />
        </>
      )}
      {lockOn === true && <BiometricUnlockSettings />}
      <Text style={styles.note} accessibilityLiveRegion="polite">
        {lockOn === true ? APP_LOCK.statusOn : lockOn === false ? APP_LOCK.statusOff : APP_LOCK.statusUnknown}
      </Text>
      <Text style={styles.note}>{APP_LOCK.note}</Text>
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

          {/* ---------- Discreet Notifications ---------- */}
          <DiscreetNotificationsCard />

          {/* ---------- App Lock ---------- */}
          <AppLockSection />

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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.lavender,
  },
  retry: { marginTop: 6, alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  retryText: { fontSize: 14.5, fontWeight: '700', color: colors.magentaText },
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
