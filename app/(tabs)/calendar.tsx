import { sexualActivityDates } from '../../lib/sexualActivity';
import { mucusByDate } from '../../lib/mucusTracking';
import { bleedingMarks, latestPeriodSummary, periodPreviewLines } from '../../lib/periodTracking';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarLegend from '../../components/CalendarLegend';
import CycleCalendar from '../../components/CycleCalendar';
import CycleInsightsSection from '../../components/CycleInsightsSection';
import MonthSelector from '../../components/MonthSelector';
import SettingsRow from '../../components/SettingsRow';
import { monthLabel } from '../../constants/cycleData';
import { buildCalendarMonth } from '../../constants/calendarModel';
import { colors, radius, spacing } from '../../constants/theme';
import { formatMonthDay } from '../../lib/dailyTracking';
import { togglePeriodDay } from '../../lib/periodService';
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
  const sexDates: string[] = sexualActivityDates(viva.dailyLogs); // recorded activity only - one source

  const [year, setYear] = useState(todayDate.getFullYear());
  const [monthIndex, setMonthIndex] = useState(todayDate.getMonth());

  const days = useMemo(
    () => buildCalendarMonth(year, monthIndex, viva.periods, est, sexDates, today, bleedingMarks(viva.dailyLogs), { mucus: mucusByDate(viva.dailyLogs) }),
    [year, monthIndex, viva.periods, viva.dailyLogs, est, today]
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

  // "Period started Oct 7 / 4 bleeding days logged" - from logged bleeding days only
  const preview = useMemo(() => periodPreviewLines(latestPeriodSummary(viva.dailyLogs)), [viva.dailyLogs]);

  const goToday = () => {
    setYear(todayDate.getFullYear());
    setMonthIndex(todayDate.getMonth());
  };

  // ---------- Tap a day to record (or remove) bleeding ----------
  // Uses the same bleeding days as Log Period, Daily Tracking, Period History and Insights.
  const [tapMessage, setTapMessage] = useState<{ text: string; error: boolean } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapBusy = useRef(false);

  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    []
  );

  const showTapMessage = (text: string, error = false) => {
    setTapMessage({ text, error });
    AccessibilityInfo.announceForAccessibility(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setTapMessage(null), error ? 5000 : 3000);
  };

  const onDayPress = async (dateKey: string) => {
    if (tapBusy.current) return; // one tap = one change
    if (dateKey > today) {
      showTapMessage('Bleeding can only be recorded for today or earlier.', true);
      return;
    }
    tapBusy.current = true;
    try {
      const { result, action, recordedDays } = await togglePeriodDay(dateKey);
      const day = formatMonthDay(dateKey);
      if (result === 'saved') {
        if (action === 'removed') showTapMessage('Bleeding removed from ' + day);
        else
          showTapMessage(
            'Bleeding recorded on ' + day +
              (recordedDays ? ' · ' + recordedDays + (recordedDays === 1 ? ' day recorded' : ' days recorded') : '')
          );
      } else if (result === 'lastOne') {
        showTapMessage("This is your only recorded period day, so it can't be removed here. You can change it in Period History.", true);
      } else if (result === 'future') {
        showTapMessage('Bleeding can only be recorded for today or earlier.', true);
      } else if (result === 'failed' || result === 'invalid') {
        showTapMessage("Couldn't save. Please try again.", true);
      }
    } finally {
      tapBusy.current = false;
    }
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

          <View style={styles.trackBlock}>
            <View style={styles.trackCard} accessible accessibilityRole="text">
              <View style={styles.trackIcon}>
                <Ionicons name="water" size={16} color={colors.magenta} />
              </View>
              <View style={styles.trackTextWrap}>
                <Text style={styles.trackTitle}>Track your period</Text>
                <Text style={styles.trackText}>Tap each day you have bleeding to record your period length.</Text>
                {preview && (
                  <View style={styles.preview}>
                    <Text style={styles.previewStrong}>{preview[0]}</Text>
                    <Text style={styles.previewText}>{preview[1]}</Text>
                  </View>
                )}
              </View>
            </View>
            {tapMessage && (
              <Text style={[styles.tapMessage, tapMessage.error && styles.tapMessageError]} accessibilityLiveRegion="polite">
                {tapMessage.text}
              </Text>
            )}
          </View>

          <View>
            <CycleCalendar days={days} onDayPress={(k) => void onDayPress(k)} />
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
            onPressInsight={(id) => {
              if (id === 'fertile') router.push('/fertility');
            }}
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
  trackBlock: { gap: spacing.sm },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  trackIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackTextWrap: { flex: 1 },
  trackTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  trackText: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  preview: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.pinkSoft },
  previewStrong: { fontSize: 13.5, fontWeight: '700', color: colors.navy },
  previewText: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  tapMessage: { fontSize: 13.5, fontWeight: '600', color: colors.navy, paddingHorizontal: spacing.xs },
  tapMessageError: { color: colors.magentaText },
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