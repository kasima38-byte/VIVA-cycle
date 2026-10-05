import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import CalendarDay from './CalendarDay';

type Day = React.ComponentProps<typeof CalendarDay>['day'];

type Props = {
  days: Day[];
  onDayPress?: (dateKey: string) => void;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function chunkIntoWeeks(days: Day[]) {
  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export default function CycleCalendar({ days, onDayPress }: Props) {
  const weeks = chunkIntoWeeks(days);

  return (
    <View style={styles.card}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={styles.weekRow}>
          {week.map((day, i) => (
            <CalendarDay
              key={day.dateKey}
              day={day}
              bandStart={!week[i - 1]?.isFertile}
              bandEnd={!week[i + 1]?.isFertile}
              onPress={onDayPress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.navySoft,
    fontWeight: '600',
    fontSize: 14,
  },
  weekRow: {
    flexDirection: 'row',
  },
});