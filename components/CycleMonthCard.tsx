import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, cycleColors } from '../constants/theme';

// "Your Cycle This Month": three markers + a one-dot-per-day timeline of the
// current cycle. All values are passed in from the cycle engine.

export type DayKind = 'period' | 'fertile' | 'ovulation' | 'other';

type Props = {
  periodText: string;
  fertileText: string;
  ovulationText: string;
  days: DayKind[];         // one entry per cycle day, day 1 first
  todayIndex: number | null;
  onViewCalendar: () => void;
};

const COLOR: Record<DayKind, string> = {
  period: cycleColors.period,
  fertile: cycleColors.fertile,
  ovulation: cycleColors.ovulation,
  other: cycleColors.other,
};

export default function CycleMonthCard({ periodText, fertileText, ovulationText, days, todayIndex, onViewCalendar }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header">
          Your Cycle This Month
        </Text>
        <Pressable
          onPress={onViewCalendar}
          hitSlop={10}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="View calendar"
        >
          <Text style={styles.linkText}>View Calendar</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.magenta} />
        </Pressable>
      </View>

      <View style={styles.markers}>
        <Marker label="PERIOD" value={periodText} color={cycleColors.period} />
        <Marker label="EST. FERTILE WINDOW" value={fertileText} color={cycleColors.ovulation} />
        <Marker label="EST. OVULATION" value={ovulationText} color={cycleColors.ovulation} />
      </View>

      {/* Timeline: one dot per cycle day */}
      <View
        accessible
        accessibilityLabel={
          'Cycle timeline. Period ' + periodText + '. Estimated fertile window ' + fertileText +
          '. Estimated ovulation ' + ovulationText + (todayIndex !== null ? '. Today is cycle day ' + (todayIndex + 1) : '')
        }
      >
        <View style={styles.dotsRow}>
          {days.map((kind, i) => (
            <View key={i} style={styles.cell}>
              {i === todayIndex && <View style={styles.todayRing} />}
              <View style={[styles.dot, { backgroundColor: COLOR[kind] }]} />
            </View>
          ))}
        </View>
        <View style={styles.dotsRow}>
          {days.map((_, i) => (
            <View key={i} style={styles.labelCell}>
              {i === todayIndex ? <Text style={styles.todayLabel}>Today</Text> : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.legend}>
        <LegendItem color={cycleColors.period} label="Period" />
        <LegendItem color={cycleColors.fertile} label="Estimated fertile window" />
        <LegendItem color={cycleColors.ovulation} label="Estimated ovulation" />
        <LegendItem color={cycleColors.other} label="Other days" />
      </View>
    </View>
  );
}

function Marker({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.marker}>
      <Text style={[styles.markerLabel, { color }]}>{label}</Text>
      <Text style={styles.markerValue}>{value}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const DOT = 9;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 20,
    shadowColor: colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontSize: 20, fontWeight: '800', color: colors.navy },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.magenta },

  markers: { flexDirection: 'row', gap: 10 },
  marker: { flex: 1, gap: 4 },
  markerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  markerValue: { fontSize: 14.5, fontWeight: '600', color: colors.navy },

  dotsRow: { flexDirection: 'row' },
  cell: { flex: 1, height: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  todayRing: {
    position: 'absolute',
    width: DOT + 9,
    height: DOT + 9,
    borderRadius: (DOT + 9) / 2,
    borderWidth: 2,
    borderColor: colors.navy,
  },
  labelCell: { flex: 1, alignItems: 'center', overflow: 'visible' },
  todayLabel: { width: 52, textAlign: 'center', fontSize: 12.5, fontWeight: '700', color: colors.navy, marginTop: 4 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: colors.textSecondary },
});
