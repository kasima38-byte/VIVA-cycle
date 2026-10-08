import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MiniMonthCalendar from '../components/MiniMonthCalendar';
import { colors, radius, spacing } from '../constants/theme';
import { setPendingMonth } from '../lib/calendarNavigation';
import { calculateCycle } from '../lib/cycleEngine';
import { bleedingMarks } from '../lib/periodTracking';
import { useToday } from '../lib/useToday';
import { useVivaStore } from '../lib/vivaStore';
import { MAX_YEAR, MIN_YEAR, MONTH_NAMES, parseYearParam, stepYear } from '../lib/yearOverview';
import { yearCalendarMarks } from '../lib/yearPeriods';

export default function YearOverviewScreen() {
  const params = useLocalSearchParams<{ year?: string }>();
  const today = useToday();
  const thisYear = Number(today.slice(0, 4));
  // Starts on the year the Calendar was showing; the arrows change it here
  const [year, setYear] = useState(() => parseYearParam(params.year, thisYear));
  const isThisYear = year === thisYear;
  const currentMonth = isThisYear ? Number(today.slice(5, 7)) - 1 : -1;

  // Same source of truth as the detailed Calendar; everything below follows the selected year
  const viva = useVivaStore();
  const marks = useMemo(() => bleedingMarks(viva.dailyLogs), [viva.dailyLogs]);
  // Same prediction the detailed Calendar uses
  const est = useMemo(() => calculateCycle(viva.baseline, viva.periods, today), [viva.baseline, viva.periods, today]);
  const monthMarks = useMemo(
    () => yearCalendarMarks(year, viva.periods, est, marks, today),
    [year, viva.periods, est, marks, today]
  );

  // Stable handlers, so a data change never forces every month to redraw
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/calendar' as Href);
  }, []);
  const openMonth = useCallback(
    (monthIndex: number) => {
      setPendingMonth(year, monthIndex);
      close();
    },
    [year, close]
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={close}
            hitSlop={12}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back to calendar"
          >
            <Ionicons name="chevron-back" size={22} color={colors.magenta} />
            <Text style={styles.backText}>Calendar</Text>
          </Pressable>

          <View style={styles.yearRow}>
            <Pressable
              onPress={() => setYear((y) => stepYear(y, -1))}
              disabled={year <= MIN_YEAR}
              hitSlop={8}
              style={styles.yearArrow}
              accessibilityRole="button"
              accessibilityLabel={'Previous year, ' + (year - 1)}
            >
              <Ionicons name="chevron-back" size={24} color={year <= MIN_YEAR ? colors.border : colors.navy} />
            </Pressable>
            <Text style={styles.year} accessibilityRole="header" accessibilityLiveRegion="polite">
              {year}
            </Text>
            <Pressable
              onPress={() => setYear((y) => stepYear(y, 1))}
              disabled={year >= MAX_YEAR}
              hitSlop={8}
              style={styles.yearArrow}
              accessibilityRole="button"
              accessibilityLabel={'Next year, ' + (year + 1)}
            >
              <Ionicons name="chevron-forward" size={24} color={year >= MAX_YEAR ? colors.border : colors.navy} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {isThisYear ? (
              <Text style={styles.currentCaption}>Current year</Text>
            ) : (
              <Pressable
                onPress={() => setYear(thisYear)}
                style={styles.thisYearButton}
                accessibilityRole="button"
                accessibilityLabel={'This year, ' + thisYear}
              >
                <Text style={styles.thisYearText}>This year</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {MONTH_NAMES.map((_, monthIndex) => (
              <MiniMonthCalendar
                key={monthIndex}
                year={year}
                monthIndex={monthIndex}
                periodDays={monthMarks[monthIndex].period}
                predictedDays={monthMarks[monthIndex].predicted}
                fertileDays={monthMarks[monthIndex].fertile}
                ovulationDays={monthMarks[monthIndex].ovulation}
                isCurrentMonth={monthIndex === currentMonth}
                onPress={openMonth}
                style={styles.cell}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  header: { paddingHorizontal: spacing.screenH, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44 },
  backText: { fontSize: 16, fontWeight: '600', color: colors.magentaText, marginLeft: 2 },
  yearRow: { flexDirection: 'row', alignItems: 'center' },
  yearArrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  year: { fontSize: 40, fontWeight: '800', color: colors.navy, minWidth: 100, textAlign: 'center' },
  currentCaption: { fontSize: 13, color: colors.textSecondary },
  thisYearButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.magenta,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  thisYearText: { color: colors.magentaText, fontWeight: '600', fontSize: 14 },
  content: { paddingHorizontal: spacing.screenH, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  cell: { width: '32%' },
});
