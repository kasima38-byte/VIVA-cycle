import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileStatsCard from '../../components/ProfileStatsCard';
import SettingsRow from '../../components/SettingsRow';
import { PREGNANCY_LINK, getProfileStats } from '../../constants/profileData';
import { useVivaStore } from '../../lib/vivaStore';
import { useProfile } from '../../constants/profileStore';
import { colors, radius, spacing } from '../../constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Row = { icon: IconName; title: string; subtitle: string; route?: string };

const accountRows: Row[] = [
  { icon: 'person', title: 'Personal Information', subtitle: 'Your profile and personal details', route: '/personal-information' },
  { icon: 'options', title: 'Cycle Settings', subtitle: 'Cycle length, period length and predictions', route: '/cycle-settings' },
  { icon: 'notifications', title: 'Notifications & Reminders', subtitle: 'Period, fertility and tracking reminders', route: '/notifications' },
];

const healthRows: Row[] = [
  { icon: 'water', title: 'Period history', subtitle: 'See, edit or delete the periods you logged', route: '/period-history' },
  { icon: 'flag', title: 'My Health Goals', subtitle: 'Set and track your health goals' },
  { icon: 'bar-chart', title: 'My Data', subtitle: 'View, export and manage your data' },
  { icon: 'lock-closed', title: 'Privacy & Security', subtitle: 'Privacy, permissions and account security', route: '/privacy-security' },
];

const supportRows: Row[] = [
  { icon: 'help-circle', title: 'Help & Support', subtitle: 'FAQs, support and contact us' },
  { icon: 'share-social', title: 'Share VIVA Cycle', subtitle: 'Help more women discover better health' },
];


function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
export default function ProfileScreen() {
  const userProfile = useProfile();
  const { periods } = useVivaStore();
  const profileStats = getProfileStats(periods);
  const stats: { icon: IconName; value: string; label: string }[] = [
    { icon: 'calendar', value: String(profileStats.cyclesTracked), label: 'Cycles Tracked' },
    { icon: 'stats-chart', value: profileStats.averageCycle, label: 'Average Cycle' },
    { icon: 'heart', value: profileStats.averagePeriod, label: 'Average Period' },
    { icon: 'water', value: String(periods.length), label: 'Periods Logged' },
  ];
  const go = (route?: string) => {
    if (route) router.push(route as any);
  };

  const openPregnancy = async () => {
    try {
      await Linking.openURL(PREGNANCY_LINK);
    } catch {
      Alert.alert('VIVA Pregnancy', "We couldn't open VIVA Pregnancy on this device.");
    }
  };

  // No Log Out: VIVA Cycle has no accounts, so there is nothing to log out of. Her data stays on
  // this phone; deleting it is an explicit action in Privacy & Security.

  const renderRows = (rows: Row[]) => (
    <View style={styles.rowList}>
      {rows.map((r) => (
        <SettingsRow
          key={r.title}
          icon={r.icon}
          title={r.title}
          subtitle={r.subtitle}
          onPress={() => go(r.route)}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.logoRow}>
            {/* VIVA Cycle logo reserved here once the official asset is supplied */}
            <View style={{ width: 90, height: 40 }} />
          </View>

          <View style={styles.profileRow}>
            <View style={[styles.avatar, { overflow: 'hidden' }]}>
              {userProfile.photoUri ? (
                <Image source={{ uri: userProfile.photoUri }} style={{ width: 72, height: 72 }} />
              ) : (
                <Text style={styles.initials}>{initialsOf(userProfile.name)}</Text>
              )}
            </View>
            <View style={styles.nameWrap}>
              <Text style={styles.name} numberOfLines={1}>
                {userProfile.name}
              </Text>
              <Text style={styles.tagline} numberOfLines={1}>
                {userProfile.tagline}
              </Text>
            </View>
            <Pressable
              style={styles.editPill}
              onPress={() => go('/personal-information')}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <Text style={styles.editText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.magenta} />
            </Pressable>
          </View>

          <View style={styles.intro}>
            <Text style={styles.introTitle}>Small steps today,{'\n'}a healthier tomorrow.</Text>
            <Text style={styles.introBody}>Your cycle, your body, your journey.</Text>
          </View>

          <ProfileStatsCard stats={stats} />

          <Text style={styles.sectionTitle}>Account & Personal</Text>
          {renderRows(accountRows)}

          <Text style={styles.sectionTitle}>Health & Data</Text>
          {renderRows(healthRows)}

          <Pressable
            style={styles.pregnancy}
            onPress={openPregnancy}
            accessibilityRole="button"
            accessibilityLabel="Open VIVA Pregnancy"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.pregnancyTitle}>VIVA Pregnancy</Text>
              <Text style={styles.pregnancyBody}>Continue your journey with VIVA Pregnancy</Text>
              <Text style={styles.pregnancyLink}>Open VIVA Pregnancy →</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionTitle}>Support</Text>
          {renderRows(supportRows)}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 40,
    gap: spacing.md,
  },
  logoRow: { alignItems: 'flex-end' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 24, fontWeight: '700', color: colors.magenta },
  nameWrap: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', color: colors.navy },
  tagline: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pinkSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editText: { color: colors.magenta, fontWeight: '600', fontSize: 12.5 },
  intro: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  introTitle: { fontSize: 16.5, fontWeight: '700', color: colors.navy },
  introBody: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
    marginTop: spacing.sm,
  },
  rowList: { gap: spacing.sm },
  pregnancy: {
        flexDirection: 'row',
    backgroundColor: colors.lightPurple,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pregnancyTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  pregnancyBody: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  pregnancyLink: { fontSize: 13, fontWeight: '600', color: colors.ovulationPurple, marginTop: 8 },
});