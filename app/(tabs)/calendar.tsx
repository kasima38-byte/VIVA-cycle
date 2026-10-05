import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarLegend from '../../components/CalendarLegend';
import CycleCalendar from '../../components/CycleCalendar';
import CycleInsightsSection from '../../components/CycleInsightsSection';
import MonthSelector from '../../components/MonthSelector';
import SettingsRow from '../../components/SettingsRow';
import TipCard from '../../components/TipCard';
import { monthLabel } from '../../constants/cycleData';
import { buildCalendarMonth } from '../../constants/calendarModel';
import { colors, spacing } from '../../constants/theme';
import { calculateCycle } from '../../lib/cycleEngine';
import { useToday } from '../../lib/useToday';
import { useVivaStore } from '../../lib/vivaStore';

export default function CalendarScreen() {
  const today = useToday();
  const todayDate = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [today]);

  // Single source of truth: saved setup + confirmed periods → the one engine
  const viva = useVivaStore();
  const est = useMemo(
    () => calculateCycle(viva.baseline, viva.periods, today),
    [viva.baseline, viva.periods, today]
  );

  // Sexual activity is not an approved VIVA feature: no markers are drawn
  const sexDates: string[] = [];

  const [year, setYear] = useState(todayDate.getFullYear());
  const [monthIndex, setMonthIndex] = useState(todayDate.getMonth());

  const days = useMemo(
    () => buildCalendarMonth(year, monthIndex, viva.periods, est, sexDates, today),
    [year, monthIndex, viva.periods, est, today]
  );

  const goPrevMonth = () => {
    if (monthIndex === 0) {
      setMonthIndex(11);
      setYear((y) => y - 1);
    } else {
      setMonthIndex((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (monthIndex === 11) {
      setMonthIndex(0);
      setYear((y) => y + 1);
    } else {
      setMonthIndex((m) => m + 1);
    }
  };

  const goToday = () => {
    setYear(todayDate.getFullYear());
    setMonthIndex(todayDate.getMonth());
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>Calendar</Text>
                <Text style={styles.subtitle}>Track, plan and understand your cycle.</Text>
              </View>
              <View style={{ width: 90, height: 40 }} />
            </View>
          </View>

          <MonthSelector
            label={monthLabel(year, monthIndex)}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onToday={goToday}
          />

          <View>
            <CycleCalendar days={days} />
            <CalendarLegend />
          </View>

          <CycleInsightsSection
            today={today}
            cycleLength={est ? est.cycleLengthUsed : 28}
            periodLength={est ? est.periodLengthUsed : 5}
            fertileWindow={est ? est.estimatedFertileWindow : null}
            ovulationDate={est ? est.estimatedOvulation : null}
            nextPeriod={est ? est.estimatedNextPeriod : null}
            onViewDetails={() => router.push('/fertility')}
          />

          <TipCard
            title="Tip of the day"
            body="Stay hydrated and get enough sleep for a healthier cycle."
          />
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
    gap: spacing.xl,
  },
  header: { gap: 6 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: { flex: 1 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: { gap: spacing.md },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
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
    fontSize: 14.5,
  },
  insightsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupedCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});