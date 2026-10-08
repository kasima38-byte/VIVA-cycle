import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getToday } from '../constants/dateUtils';
import { colors, radius, spacing } from '../constants/theme';
import { setPendingMonth } from '../lib/calendarNavigation';
import { WEEKDAY_INITIALS, buildYearOverview, parseYearParam } from '../lib/yearOverview';

export default function YearOverviewScreen() {
  const params = useLocalSearchParams<{ year?: string }>();
  const today = getToday();
  const thisYear = Number(today.slice(0, 4));
  const year = parseYearParam(params.year, thisYear);
  const months = useMemo(() => buildYearOverview(year), [year]);
  const currentMonth = year === thisYear ? Number(today.slice(5, 7)) - 1 : -1;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/calendar' as Href);
  };
  const openMonth = (monthIndex: number) => {
    setPendingMonth(year, monthIndex);
    close();
  };

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
          <Text style={styles.year} accessibilityRole="header">
            {year}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            {months.map((m) => (
              <Pressable
                key={m.monthIndex}
                onPress={() => openMonth(m.monthIndex)}
                style={({ pressed }) => [styles.card, m.monthIndex === currentMonth && styles.cardCurrent, pressed && styles.cardPressed]}
                accessibilityRole="button"
                accessibilityLabel={m.name + ' ' + year}
                accessibilityHint="Opens this month in the calendar"
              >
                <Text style={[styles.monthName, m.monthIndex === currentMonth && styles.monthNameCurrent]} maxFontSizeMultiplier={1.4}>
                  {m.name}
                </Text>
                <View style={styles.row} importantForAccessibility="no-hide-descendants">
                  {WEEKDAY_INITIALS.map((w, i) => (
                    <Text key={'w' + i} style={styles.weekday} maxFontSizeMultiplier={1.2}>
                      {w}
                    </Text>
                  ))}
                </View>
                {m.weeks.map((week, wi) => (
                  <View key={'r' + wi} style={styles.row} importantForAccessibility="no-hide-descendants">
                    {week.map((d, di) => (
                      <Text key={wi + '-' + di} style={styles.day} maxFontSizeMultiplier={1.2}>
                        {d === null ? '' : d}
                      </Text>
                    ))}
                  </View>
                ))}
              </Pressable>
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
  year: { fontSize: 40, fontWeight: '800', color: colors.navy },
  content: { paddingHorizontal: spacing.screenH, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  card: {
    width: '32%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
  },
  cardCurrent: { borderColor: colors.magenta, borderWidth: 1.5 },
  cardPressed: { opacity: 0.7 },
  monthName: { fontSize: 13, fontWeight: '700', color: colors.navy, marginBottom: 4, paddingHorizontal: 2 },
  monthNameCurrent: { color: colors.magentaText },
  row: { flexDirection: 'row' },
  weekday: { width: '14.28%', textAlign: 'center', fontSize: 8, fontWeight: '700', color: colors.textSecondary },
  day: { width: '14.28%', textAlign: 'center', fontSize: 9, lineHeight: 13, color: colors.navy },
});
