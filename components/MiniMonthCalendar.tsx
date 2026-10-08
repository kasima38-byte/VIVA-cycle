import { useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { WEEKDAY_INITIALS, buildMiniMonth } from '../lib/yearOverview';

type Props = {
  year: number;
  monthIndex: number; // 0-11
  periodDays?: ReadonlySet<number>; // actual logged period days in this month
  isCurrentMonth?: boolean;
  onPress?: (monthIndex: number) => void;
  style?: StyleProp<ViewStyle>;
};

const NONE: ReadonlySet<number> = new Set<number>();

/** One compact month: name, M T W T F S S, and its real dates. Used for all 12 months. */
export default function MiniMonthCalendar({ year, monthIndex, periodDays = NONE, isCurrentMonth, onPress, style }: Props) {
  const month = useMemo(() => buildMiniMonth(year, monthIndex), [year, monthIndex]);
  const count = periodDays.size;
  const label =
    month.name + ' ' + year + (count > 0 ? ', ' + count + (count === 1 ? ' logged period day' : ' logged period days') : '');

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
            return (
              <View key={wi + '-' + di} style={styles.cell}>
                <View style={period ? styles.periodMark : undefined}>
                  <Text style={[styles.day, period && styles.periodText]} maxFontSizeMultiplier={1.2}>
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
});
