import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export type TimelineDay = {
  key: string;
  type: 'period' | 'fertile' | 'ovulation' | 'today' | 'normal';
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
        {days.map((day) => (
          <View key={day.key} style={styles.dotWrap}>
            {day.type === 'today' && <View style={styles.todayRing} />}
            <View style={[styles.dot, { backgroundColor: dotColor(day.type) }]} />
          </View>
        ))}
      </View>

      <View style={styles.todayLabelRow}>
        {days.map((day) =>
          day.type === 'today' ? (
            <Text key={day.key + '-label'} style={styles.todayLabel}>
              Today
            </Text>
          ) : null
        )}
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
  dotWrap: {
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT - 4,
    height: DOT - 4,
    borderRadius: (DOT - 4) / 2,
  },
  todayRing: {
    position: 'absolute',
    width: DOT + 8,
    height: DOT + 8,
    borderRadius: (DOT + 8) / 2,
    borderWidth: 1.5,
    borderColor: colors.magenta,
  },
  todayLabelRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  todayLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.magenta,
  },
});