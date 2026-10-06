import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CycleTimeline, { TimelineDay } from '../components/CycleTimeline';
import FertilityHeroCard from '../components/FertilityHeroCard';
import FertilityLegend from '../components/FertilityLegend';
import SegmentedTabs from '../components/SegmentedTabs';
import TipCard from '../components/TipCard';
import { formatLongDate } from '../constants/cycleData';
import { colors, spacing } from '../constants/theme';
import { addDays, calculateCycle, cycleDayOn, diffDays, Goal } from '../lib/cycleEngine';
import { useToday } from '../lib/useToday';
import { useVivaStore } from '../lib/vivaStore';

// Everything on this screen comes from lib/cycleEngine.ts. Calendar estimates
// only: VIVA does not track or detect mucus, temperature or other body signs.

const navTabs: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
];

const navTabsRight: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'insights', label: 'Insights', icon: 'stats-chart' },
  { key: 'learn', label: 'Learn', icon: 'book' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (key: string) => {
  const [, m, d] = key.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1];
};
const range = (a: string, b: string) => (a === b ? short(a) : short(a) + ' – ' + short(b));

function tipFor(goal: Goal | null): string {
  switch (goal) {
    case 'conceive':
      return 'Sperm can survive up to about 5 days and the egg about a day, so the days before estimated ovulation matter most. Pregnancy is never guaranteed, and ovulation can vary from cycle to cycle.';
    case 'avoid':
      return 'A calendar estimate cannot tell you that a day is safe. If you want to avoid pregnancy, use an effective contraceptive method; calendar dates should not be your only method.';
    case 'understand':
      return 'Your cycle runs: period → follicular phase → estimated fertile window → estimated ovulation → luteal phase → next period. Calendar dates estimate these phases; they cannot pinpoint them.';
    default:
      return 'The fertile window is a range of days, not a single day: sperm can survive several days, and the egg about a day after ovulation.';
  }
}

export default function FertilityScreen() {
  const [activeTab, setActiveTab] = useState('Overview');
  const viva = useVivaStore();
  const today = useToday();
  const est = useMemo(() => calculateCycle(viva.baseline, viva.periods, today), [viva.baseline, viva.periods, today]);

  // Hero card text
  let hero = { eyebrow: 'Your', heading: 'Estimated fertile window', body: 'Log a period to see estimates', dates: '–', detail: '' };
  if (est) {
    const w = est.upcomingFertileWindow;
    const dates = w.start.slice(5, 7) === w.end.slice(5, 7)
      ? Number(w.start.slice(8)) + '–' + short(w.end)
      : range(w.start, w.end);
    if (est.fertileWindowStatus === 'current') {
      const left = diffDays(w.end, today) + 1;
      hero = {
        eyebrow: 'You may be in your',
        heading: 'Estimated fertile window',
        body: viva.goal === 'conceive' ? 'Higher estimated chance of conception' : 'Pregnancy is possible on these days',
        dates,
        detail: left === 1 ? 'Estimated to end today' : 'About ' + left + ' days left (estimate)',
      };
    } else {
      const inDays = diffDays(w.start, today);
      hero = {
        eyebrow: est.fertileWindowStatus === 'passed' ? 'Next cycle' : 'Coming up',
        heading: 'Estimated fertile window',
        body: est.fertileWindowStatus === 'passed' ? "This cycle's estimated window has passed" : 'Calendar-based estimate',
        dates,
        detail: inDays === 1 ? 'May start tomorrow' : 'May start in about ' + inDays + ' days',
      };
    }
  }

  // Timeline: up to 20 days of the current cycle around the estimated fertile window
  const timeline = useMemo(() => {
    if (!est) return { days: [] as TimelineDay[], brackets: [] as any[] };
    const len = est.cycleLengthUsed;
    const ovCD = cycleDayOn(viva.periods, est.estimatedOvulation, today) ?? 1;
    const endCD = Math.min(len, ovCD + 5);
    const startCD = Math.max(1, endCD - 19);
    const fwStart = est.estimatedFertileWindow.start;
    const fwEnd = est.estimatedFertileWindow.end;
    const periodEnd = addDays(est.currentCycleStart, est.periodLengthUsed - 1);
    const days: TimelineDay[] = [];
    let todayIdx = -1;
    for (let cd = startCD; cd <= endCD; cd++) {
      const date = addDays(est.currentCycleStart, cd - 1);
      let type: TimelineDay['type'] = 'normal';
      if (diffDays(periodEnd, date) >= 0) type = 'period';
      if (diffDays(date, fwStart) >= 0 && diffDays(fwEnd, date) >= 0) type = 'fertile';
      if (date === est.estimatedOvulation) type = 'ovulation';
      const isToday = date === today;
      if (isToday) todayIdx = days.length;
      days.push({ key: date, type, isToday });
    }
    const brackets: { label: string; sublabel: string; color: string; startIndex: number; endIndex: number }[] = [];
    if (startCD <= est.periodLengthUsed) {
      brackets.push({ label: 'Period', sublabel: range(est.currentCycleStart, periodEnd), color: colors.magenta, startIndex: 0, endIndex: 0 });
    }
    brackets.push({ label: 'Est. fertile window', sublabel: range(fwStart, fwEnd), color: colors.ovulationPurple, startIndex: 0, endIndex: 0 });
    brackets.push({
      label: 'Est. ovulation',
      sublabel: est.ovulationIsVariable ? 'around ' + range(est.ovulationRange.start, est.ovulationRange.end) : short(est.estimatedOvulation),
      color: colors.ovulationPurple,
      startIndex: 0,
      endIndex: 0,
    });
    return { days, brackets, todayIdx };
  }, [est, viva.periods, today]);

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
            <Text style={styles.subtitle}>Understand your estimated fertile window.</Text>
          </View>

          <SegmentedTabs tabs={['Overview', 'Signs', 'Tips']} activeTab={activeTab} onChange={setActiveTab} />

          <FertilityHeroCard
            eyebrow={hero.eyebrow}
            heading={hero.heading}
            body={hero.body}
            dateRange={hero.dates}
            detail={hero.detail}
            onLogSymptoms={() => router.push('/daily-tracking')}
          />

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Your Cycle This Month</Text>
              <Pressable style={styles.linkRow} onPress={() => router.push('/(tabs)/calendar')}>
                <Text style={styles.linkText}>View Calendar</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.magenta} />
              </Pressable>
            </View>
            <CycleTimeline days={timeline.days} brackets={timeline.brackets} />
            <FertilityLegend />
            {est ? (
              <Text style={styles.subtitle}>
                {est.ovulationIsVariable
                  ? 'Your cycle length varies, so estimated ovulation is shown as a range. '
                  : ''}
                Estimated ovulation is cycle day {est.cycleLengthUsed - 14} (cycle length − 14), leaving about 14 days before your next estimated period on {formatLongDate(est.estimatedNextPeriod)}. It is an estimate, not a confirmed event.
              </Text>
            ) : null}
          </View>

          <TipCard title="Good to know" body={tipFor(viva.goal)} />
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