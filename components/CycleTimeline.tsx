import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export type TimelineDay = {
  key: string;
  type: 'period' | 'fertile' | 'ovulation' | 'today' | 'normal';
  isToday?: boolean; // ring + label on top of the day's own colour
};

type Bracket = {
  label: string;
  sublabel: string;
  color: string;
  startIndex: number;
  endIndex: number;
};

type Props = {
  days: TimelineDay[];
  brackets: Bracket[];
};

const DOT = 20;

function dotColor(type: TimelineDay['type']) {
  switch (type) {
    case 'period':
      return colors.magenta;
    case 'fertile':
      return colors.lightPurple;
    case 'ovulation':
      return colors.ovulationPurple;
    case 'today':
      return colors.ovulationPurple;
    default:
      return colors.border;
  }
}

export default function CycleTimeline({ days, brackets }: Props) {
  return (
    <View>
      <View style={styles.bracketRow}>
        {brackets.map((b) => (
          <View key={b.label} style={styles.bracket}>
            <Text style={[styles.bracketLabel, { color: b.color }]}>{b.label}</Text>
            <Text style={styles.bracketSub}>{b.sublabel}</Text>
          </View>
        ))}
      </View>

      <View style={styles.dotsRow}>
        {days.map((day) => {
          const today = day.isToday || day.type === 'today';
          return (
            <View key={day.key} style={styles.dotWrap}>
              {today && <View style={styles.todayRing} />}
              <View style={[styles.dot, { backgroundColor: dotColor(day.type) }]} />
            </View>
          );
        })}
      </View>

      <View style={styles.todayLabelRow}>
        {days.map((day) => (
          <View key={day.key + '-label'} style={styles.labelCell}>
            {day.isToday || day.type === 'today' ? (
              <Text style={styles.todayLabel}>Today</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bracketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  bracket: {
    alignItems: 'center',
  },
  bracketLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  bracketSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Each day shares the row width equally, so 20+ days always fit the screen
  dotWrap: {
    flex: 1,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: '78%',
    maxWidth: DOT - 4,
    aspectRatio: 1,
    borderRadius: DOT,
  },
  todayRing: {
    position: 'absolute',
    width: '100%',
    maxWidth: DOT + 4,
    aspectRatio: 1,
    borderRadius: DOT,
    borderWidth: 1.5,
    borderColor: colors.magenta,
  },
  todayLabelRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
    overflow: 'visible',
  },
  todayLabel: {
    width: 64, // wider than its cell; centred under the dot
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.magenta,
  },
});