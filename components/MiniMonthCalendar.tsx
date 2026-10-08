import { useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { WEEKDAY_INITIALS, buildMiniMonth } from '../lib/yearOverview';

type Props = {
  year: number;
  monthIndex: number; // 0-11
  periodDays?: ReadonlySet<number>; // actual logged period days in this month
  predictedDays?: ReadonlySet<number>; // predicted period days (actual always wins)
  fertileDays?: ReadonlySet<number>; // fertile window days - a band drawn behind, like the Calendar
  ovulationDays?: ReadonlySet<number>; // estimated ovulation day(s) - informational only
  isCurrentMonth?: boolean;
  onPress?: (monthIndex: number) => void;
  style?: StyleProp<ViewStyle>;
};

const NONE: ReadonlySet<number> = new Set<number>();

/** One compact month: name, M T W T F S S, and its real dates. Used for all 12 months. */
export default function MiniMonthCalendar({ year, monthIndex, periodDays = NONE, predictedDays = NONE, fertileDays = NONE, ovulationDays = NONE, isCurrentMonth, onPress, style }: Props) {
  const month = useMemo(() => buildMiniMonth(year, monthIndex), [year, monthIndex]);
  const count = periodDays.size;
  const predictedCount = [...predictedDays].filter((d) => !periodDays.has(d)).length;
  const label =
    month.name + ' ' + year +
    (count > 0 ? ', ' + count + (count === 1 ? ' logged period day' : ' logged period days') : '') +
    (predictedCount > 0 ? ', ' + predictedCount + (predictedCount === 1 ? ' predicted period day' : ' predicted period days') : '') +
    (fertileDays.size > 0 ? ', ' + fertileDays.size + (fertileDays.size === 1 ? ' fertile window day' : ' fertile window days') : '') +
    (ovulationDays.size > 0 ? ', estimated ovulation on day ' + [...ovulationDays].sort((a, b) => a - b).join(' and ') : '');

  return (
    <Pressable
      onPress={onPress ? () => onPress(monthIndex) : undefined}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, isCurrentMonth && styles.cardCurrent, pressed && styles.cardPressed, style]}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={label}
      accessibilityHint={onPress ? 'Opens this month in the calendar' : undefined}
    >
      <Text style={[styles.monthName, isCurrentMonth && styles.monthNameCurrent]} maxFontSizeMultiplier={1.4}>
        {month.name}
      </Text>
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        {WEEKDAY_INITIALS.map((w, i) => (
          <Text key={'w' + i} style={styles.weekday} maxFontSizeMultiplier={1.2}>
            {w}
          </Text>
        ))}
      </View>
      {month.weeks.map((week, wi) => (
        <View key={'r' + wi} style={styles.row} importantForAccessibility="no-hide-descendants">
          {week.map((d, di) => {
            const period = d !== null && periodDays.has(d);
            const predicted = !period && d !== null && predictedDays.has(d); // actual always wins
            const ovulation = !period && !predicted && d !== null && ovulationDays.has(d); // ring on top of the fertile band
            // Fertile window: band BEHIND the day (period circles stay on top), joined across neighbours
            const fertile = d !== null && fertileDays.has(d);
            const prev = di > 0 ? week[di - 1] : null;
            const next = di < 6 ? week[di + 1] : null;
            const joinLeft = fertile && prev !== null && fertileDays.has(prev);
            const joinRight = fertile && next !== null && fertileDays.has(next);
            return (
              <View
                key={wi + '-' + di}
                style={[styles.cell, fertile && styles.fertileBand, fertile && !joinLeft && styles.bandStart, fertile && !joinRight && styles.bandEnd]}
              >
                <View style={period ? styles.periodMark : predicted ? styles.predictedMark : ovulation ? styles.ovulationMark : undefined}>
                  <Text style={[styles.day, period && styles.periodText, predicted && styles.predictedText, ovulation && styles.ovulationText]} maxFontSizeMultiplier={1.2}>
                    {d === null ? '' : d}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  cell: { width: '14.28%', height: 14, alignItems: 'center', justifyContent: 'center' },
  // Same meaning as the detailed Calendar's actual period day: solid magenta, white number
  periodMark: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: { textAlign: 'center', fontSize: 9, lineHeight: 12, color: colors.navy },
  periodText: { color: colors.white, fontWeight: '800', fontSize: 8.5 },
  // Same meaning as the detailed Calendar's predicted period day: light pink, outlined
  predictedMark: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: colors.pinkSoft,
    borderWidth: 1,
    borderColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictedText: { color: colors.magentaText, fontWeight: '700', fontSize: 8.5 },
  // Same meaning as the Calendar's fertile window: a lavender band behind the days
  fertileBand: { backgroundColor: colors.lightPurple },
  bandStart: { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  bandEnd: { borderTopRightRadius: 7, borderBottomRightRadius: 7 },
  // Same colour meaning as the Calendar's estimated ovulation day; white centre stands out on the band
  ovulationMark: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: colors.ovulationPurple,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovulationText: { color: colors.navy, fontWeight: '800', fontSize: 8.5 },
});
