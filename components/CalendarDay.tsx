import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DayInfo } from '../constants/cycleData';
import { colors } from '../constants/theme';

type DayProps = DayInfo & { isPredictedPeriod?: boolean; cycleDay?: number | null };

type Props = {
  day: DayProps;
  bandStart?: boolean;
  bandEnd?: boolean;
  onPress?: (dateKey: string) => void;
};

const CIRCLE = 40;

function describe(day: DayProps) {
  const parts: string[] = [String(day.day)];
  if (day.isToday) parts.push('today');
  if (day.cycleDay) parts.push('cycle day ' + day.cycleDay);
  if (day.isPeriod) parts.push('logged period');
  if (day.isPredictedPeriod) parts.push('predicted period');
  if (day.isOvulation) parts.push('estimated ovulation');
  else if (day.isFertile) parts.push('estimated fertile window');
  if (day.isSexLogged) parts.push('intimacy logged');
  return parts.join(', ');
}

export default function CalendarDay({ day, bandStart, bandEnd, onPress }: Props) {
  const dimmed = !day.isCurrentMonth;

  let circleStyle = null;
  let textColor = dimmed ? colors.mutedGray : colors.navy;

  if (day.isPeriod) {
    circleStyle = styles.periodCircle;
    textColor = colors.white;
  } else if (day.isOvulation) {
    circleStyle = styles.ovulationCircle;
    textColor = colors.white;
  } else if (day.isPredictedPeriod) {
    circleStyle = styles.predictedCircle;
    textColor = colors.magenta;
  } else if (day.isToday) {
    circleStyle = styles.todayCircle;
    textColor = colors.magenta;
  }

  return (
    <Pressable
      onPress={() => onPress?.(day.dateKey)}
      style={[
        styles.cell,
        day.isFertile && styles.band,
        day.isFertile && bandStart && styles.bandStart,
        day.isFertile && bandEnd && styles.bandEnd,
      ]}
      accessibilityRole="button"
      accessibilityLabel={describe(day)}
      accessibilityHint={onPress ? (day.isPeriod ? 'Removes bleeding on this day' : 'Records bleeding on this day') : undefined}
    >
      <View style={[styles.circleBase, circleStyle]}>
        <Text style={[styles.dayText, { color: textColor }]}>{day.day}</Text>
      </View>

      <View style={styles.indicatorRow}>
        {day.isSexLogged ? (
          <Ionicons name="heart" size={10} color={colors.magenta} />
        ) : day.isPeriod ? (
          <View style={styles.dot} />
        ) : null}
      </View>

      <View style={styles.labelRow}>
        {day.isToday ? <Text style={styles.todayLabel}>Today</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    marginVertical: 2,
  },
  band: { backgroundColor: colors.lightPurple },
  bandStart: { borderTopLeftRadius: 22, borderBottomLeftRadius: 22 },
  bandEnd: { borderTopRightRadius: 22, borderBottomRightRadius: 22 },
  circleBase: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCircle: { backgroundColor: colors.magenta },
  ovulationCircle: { backgroundColor: colors.ovulationPurple },
  predictedCircle: { backgroundColor: colors.pinkSoft, borderWidth: 1, borderColor: colors.magenta + '55' },
  todayCircle: {
    borderWidth: 1.5,
    borderColor: colors.magenta,
    borderStyle: 'dashed',
  },
  dayText: { fontSize: 15.5, fontWeight: '600' },
  indicatorRow: {
    height: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.magenta,
  },
  labelRow: { height: 13, justifyContent: 'center' },
  todayLabel: { fontSize: 10.5, fontWeight: '600', color: colors.magenta },
});