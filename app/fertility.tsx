import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CycleMonthCard, { DayKind } from '../components/CycleMonthCard';
import CycleRing from '../components/CycleRing';
import SegmentedTabs from '../components/SegmentedTabs';
import TryingToConceiveCard from '../components/TryingToConceiveCard';
import OvulationSignsCard from '../components/OvulationSignsCard';
import WhyItMattersCard from '../components/WhyItMattersCard';
import { colors, spacing } from '../constants/theme';
import { addDays, calculateCycle, CycleEstimate, diffDays } from '../lib/cycleEngine';
import { useToday } from '../lib/useToday';
import { useVivaStore } from '../lib/vivaStore';

// Fertility — section 1: header, tabs and the estimated fertile window card.
// Every date comes from lib/cycleEngine.ts and is presented as an ESTIMATE.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (k: string) => Number(k.slice(8, 10));
const mon = (k: string) => MONTHS[Number(k.slice(5, 7)) - 1];
const short = (k: string) => day(k) + ' ' + mon(k);
const full = (a: string, b: string) => (a === b ? short(a) : short(a) + ' – ' + short(b));
/** "12–17 Oct", or "29 Oct – 3 Nov" across months */
const range = (a: string, b: string) => (mon(a) === mon(b) ? day(a) + '–' + short(b) : short(a) + ' – ' + short(b));

type CardContent = {
  eyebrow: string;
  dates: string;
  support: string;
  ovulation: string;
};

function cardContent(est: CycleEstimate | null, today: string): CardContent {
  if (!est) {
    return { eyebrow: 'GET STARTED', dates: '—', support: 'Log a period to see your estimates.', ovulation: '—' };
  }
  if (!est.upcomingFertileWindow) {
    // Period is late: no window can be estimated until she logs it
    return {
      eyebrow: 'PERIOD LATE',
      dates: 'Not available',
      support: 'Timing is uncertain until you log your period.',
      ovulation: 'Not available',
    };
  }
  const w = est.upcomingFertileWindow;
  const shift = diffDays(w.end, est.estimatedFertileWindow.end); // 0 this cycle, cycle length if next
  const margin = diffDays(est.ovulationRange.end, est.estimatedOvulation);
  const ovulation = est.ovulationIsVariable
    ? 'Around ' + range(addDays(w.end, -margin), addDays(w.end, margin))
    : short(w.end);

  if (est.fertileWindowStatus === 'current') {
    const left = diffDays(w.end, today);
    return {
      eyebrow: 'NOW',
      dates: range(w.start, w.end),
      support: left === 0 ? 'Estimated to end today' : 'Estimated to end in ' + left + (left === 1 ? ' day' : ' days'),
      ovulation,
    };
  }
  const inDays = diffDays(w.start, today);
  return {
    eyebrow: shift > 0 ? 'NEXT CYCLE' : 'COMING UP',
    dates: range(w.start, w.end),
    support: inDays === 1 ? 'May start tomorrow' : 'May start in about ' + inDays + ' days',
    ovulation,
  };
}

export default function FertilityScreen() {
  const [activeTab, setActiveTab] = useState('Overview');
  const viva = useVivaStore();
  const today = useToday();
  const est = useMemo(() => calculateCycle(viva.baseline, viva.periods, today), [viva.baseline, viva.periods, today]);
  const card = cardContent(est, today);

  const ring = est
    ? {
        cycleLength: est.cycleLengthUsed,
        periodDays: est.periodLengthUsed,
        fertileStartDay: diffDays(est.estimatedFertileWindow.start, est.currentCycleStart) + 1,
        fertileEndDay: diffDays(est.estimatedFertileWindow.end, est.currentCycleStart) + 1,
        ovulationDay: diffDays(est.estimatedOvulation, est.currentCycleStart) + 1,
        todayDay: est.currentCycleDay,
      }
    : null;

  // Section 2: this cycle's markers and one-dot-per-day timeline (current cycle)
  const month = useMemo(() => {
    if (!est) return null;
    const start = est.currentCycleStart;
    const periodEnd = addDays(start, est.periodLengthUsed - 1);
    const fw = est.estimatedFertileWindow;
    // While late, extend the line so today stays on it
    const length = Math.max(est.cycleLengthUsed, est.currentCycleDay);
    const days: DayKind[] = [];
    for (let i = 0; i < length; i++) {
      const d = addDays(start, i);
      if (d === est.estimatedOvulation) days.push('ovulation');
      else if (diffDays(d, fw.start) >= 0 && diffDays(fw.end, d) >= 0) days.push('fertile');
      else if (diffDays(periodEnd, d) >= 0) days.push('period');
      else days.push('other');
    }
    return {
      periodText: full(start, periodEnd),
      fertileText: full(fw.start, fw.end),
      ovulationText: est.ovulationIsVariable
        ? 'Around ' + range(est.ovulationRange.start, est.ovulationRange.end)
        : short(est.estimatedOvulation),
      days,
      todayIndex: est.currentCycleDay - 1,
    };
  }, [est]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.back}
            >
              <Ionicons name="chevron-back" size={26} color={colors.navy} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              Fertility
            </Text>
            <Text style={styles.subtitle}>Understand your estimated fertile window and what it means.</Text>
          </View>

          <SegmentedTabs tabs={['Overview', 'Signs', 'Tips']} activeTab={activeTab} onChange={setActiveTab} />

          {/* Primary fertility card */}
          <View
            style={styles.card}
            accessible
            accessibilityLabel={
              'Estimated fertile window, ' + card.dates + '. ' + card.support + '. Estimated ovulation, ' + card.ovulation +
              '. These dates are calendar-based estimates. Your body may vary from cycle to cycle.'
            }
          >
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>{card.eyebrow}</Text>
                <Text style={styles.cardHeading}>Estimated fertile window</Text>
                <Text style={styles.dates} adjustsFontSizeToFit numberOfLines={1}>
                  {card.dates}
                </Text>
                <Text style={styles.support}>{card.support}</Text>
              </View>
              {ring ? <CycleRing {...ring} /> : null}
            </View>

            <View style={styles.divider} />

            <View style={styles.ovulationRow}>
              <View style={styles.ovulationDot} />
              <View>
                <Text style={styles.ovulationLabel}>Estimated ovulation</Text>
                <Text style={styles.ovulationValue}>{card.ovulation}</Text>
              </View>
            </View>

            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.noticeText}>
                These dates are calendar-based estimates. Your body may vary from cycle to cycle.
              </Text>
            </View>
          </View>

          {month ? (
            <CycleMonthCard
              periodText={month.periodText}
              fertileText={month.fertileText}
              ovulationText={month.ovulationText}
              days={month.days}
              todayIndex={month.todayIndex}
              onViewCalendar={() => router.push('/(tabs)/calendar')}
            />
          ) : null}

          {/* Section 3: why these days matter (educational) */}
          <WhyItMattersCard onPress={() => setActiveTab('Tips')} />

          {/* Section 4: possible signs (educational; VIVA does not track or detect these) */}
          <OvulationSignsCard onPress={() => setActiveTab('Signs')} />

          {/* Section 5: practical, goal-labelled guidance */}
          <TryingToConceiveCard onLearnMore={() => router.push('/conception-guide')} />
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
    paddingTop: spacing.sm,
    paddingBottom: 40,
    gap: spacing.xxl,
  },
  header: { gap: 8 },
  back: { alignSelf: 'flex-start', marginBottom: 8 },
  title: { fontSize: 34, fontWeight: '800', color: colors.navy, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, lineHeight: 23, color: colors.textSecondary },

  card: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F8DCEA',
    padding: 22,
    shadowColor: colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { fontSize: 12.5, fontWeight: '800', letterSpacing: 1.4, color: colors.magenta },
  cardHeading: { fontSize: 19, fontWeight: '700', color: colors.navy, marginTop: 6 },
  dates: { fontSize: 40, fontWeight: '800', color: colors.magenta, letterSpacing: -0.8, marginTop: 4 },
  support: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },

  divider: { height: 1, backgroundColor: '#F3D9E6', marginVertical: 18 },

  ovulationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ovulationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.ovulationPurple,
    borderWidth: 3,
    borderColor: colors.lightPurple,
  },
  ovulationLabel: { fontSize: 13.5, color: colors.textSecondary },
  ovulationValue: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 1 },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 18,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
