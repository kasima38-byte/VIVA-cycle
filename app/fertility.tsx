import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CycleTimeline, { TimelineDay } from '../components/CycleTimeline';
import FertilityHeroCard from '../components/FertilityHeroCard';
import FertilityIndicatorCard from '../components/FertilityIndicatorCard';
import FertilityLegend from '../components/FertilityLegend';
import SegmentedTabs from '../components/SegmentedTabs';
import TipCard from '../components/TipCard';
import { colors, spacing } from '../constants/theme';

const timelineDays: TimelineDay[] = [
  { key: 'd1', type: 'period' },
  { key: 'd2', type: 'period' },
  { key: 'd3', type: 'period' },
  { key: 'd4', type: 'period' },
  { key: 'd5', type: 'period' },
  { key: 'd6', type: 'normal' },
  { key: 'd7', type: 'normal' },
  { key: 'd8', type: 'normal' },
  { key: 'd9', type: 'normal' },
  { key: 'd10', type: 'fertile' },
  { key: 'd11', type: 'fertile' },
  { key: 'd12', type: 'ovulation' },
  { key: 'd13', type: 'fertile' },
  { key: 'd14', type: 'fertile' },
  { key: 'd15', type: 'normal' },
  { key: 'd16', type: 'normal' },
  { key: 'd17', type: 'normal' },
  { key: 'd18', type: 'normal' },
  { key: 'd19', type: 'today' },
  { key: 'd20', type: 'normal' },
];

const brackets = [
  { label: 'Period', sublabel: 'Sep 5 - 9', color: colors.magenta, startIndex: 0, endIndex: 4 },
  {
    label: 'Fertile window',
    sublabel: 'Sep 15 - 19',
    color: colors.ovulationPurple,
    startIndex: 9,
    endIndex: 13,
  },
  { label: 'Ovulation', sublabel: 'Sep 17', color: colors.ovulationPurple, startIndex: 11, endIndex: 11 },
];

const navTabs: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
];
const navTabsRight: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'insights', label: 'Insights', icon: 'stats-chart' },
  { key: 'learn', label: 'Learn', icon: 'book' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export default function FertilityScreen() {
  const [activeTab, setActiveTab] = useState('Overview');

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

            <Text style={styles.title}>Fertility</Text>
            <Text style={styles.subtitle}>Understand your fertile window.</Text>
          </View>

          <SegmentedTabs tabs={['Overview', 'Signs', 'Tips']} activeTab={activeTab} onChange={setActiveTab} />

          <FertilityHeroCard dateRange="15 - 19 Sep 2026" daysLeft={5} />

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Your Cycle This Month</Text>
              <Pressable style={styles.linkRow} onPress={() => router.push('/(tabs)/calendar')}>
                <Text style={styles.linkText}>View Calendar</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.magenta} />
              </Pressable>
            </View>

            <CycleTimeline days={timelineDays} brackets={brackets} />
            <FertilityLegend />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Fertility Indicators</Text>
              <View style={styles.linkRow}>
                <Text style={styles.linkText}>Learn More</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.magenta} />
              </View>
            </View>

            <View style={styles.indicatorsGrid}>
              <FertilityIndicatorCard
                icon="water"
                title="Cervical Mucus"
                description="Fertile type detected"
                statusLabel="Fertile"
                statusColor={colors.fertilityGreen}
              />
              <FertilityIndicatorCard
                icon="thermometer"
                title="Basal Body Temp"
                description="Slight increase"
                statusLabel="Rising"
                statusColor={colors.risingOrange}
              />
            </View>
            <View style={styles.indicatorsGrid}>
              <FertilityIndicatorCard
                icon="body"
                title="Cervical Position"
                description="Softer & higher"
                statusLabel="Fertile"
                statusColor={colors.fertilityGreen}
              />
              <FertilityIndicatorCard
                icon="heart"
                title="Sexual Activity"
                description="Logged"
                dateLabel="16 Sep 2026"
              />
            </View>
          </View>

          <TipCard
            title="Tip for today"
            body="Sperm can live up to 5 days in the reproductive tract. Having intercourse during your fertile window increases your chances of pregnancy."
          />
        </ScrollView>
      </SafeAreaView>

      <View style={styles.bottomBar}>
        {navTabs.map((tab) => (
          <View key={tab.key} style={styles.navItem}>
            <Ionicons name={tab.icon} size={24} color={colors.navySoft} />
            <Text style={styles.navLabel}>{tab.label}</Text>
          </View>
        ))}

        <View style={styles.fabSlot}>
          <View style={styles.fab}>
            <Ionicons name="add" size={28} color={colors.white} />
          </View>
        </View>

        {navTabsRight.map((tab) => (
          <View key={tab.key} style={styles.navItem}>
            <Ionicons name={tab.icon} size={24} color={colors.navySoft} />
            <Text style={styles.navLabel}>{tab.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.sm,
    paddingBottom: 24,
    gap: spacing.xl,
  },
  header: { gap: 6, marginBottom: 2 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: { gap: spacing.md },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.navy,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    color: colors.magenta,
    fontWeight: '600',
    fontSize: 14,
  },
  indicatorsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  navLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.navySoft,
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    shadowColor: colors.magenta,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});