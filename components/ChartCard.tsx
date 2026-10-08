import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import MiniBarChart, { BarDatum } from './MiniBarChart';

type Props = {
  title: string;
  subtitle: string;
  data: BarDatum[];
  averageText: string;
  withinRange: boolean | null; // null = no logged data yet: no range verdict
  rangeText: string;
  chartLabel: string;
  onSeeDetails?: () => void;
  statusText?: string;  // replaces "Within / Outside typical range" when given
  emptyText?: string;   // replaces "No logged data yet" when given
  notes?: string[];     // small lines under the card (e.g. what the average is based on)
};

export default function ChartCard({
  title,
  subtitle,
  data,
  averageText,
  withinRange,
  rangeText,
  chartLabel,
  onSeeDetails,
  statusText,
  emptyText,
  notes,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Pressable
          style={styles.linkRow}
          onPress={onSeeDetails}
          accessibilityRole="button"
          accessibilityLabel={`View detailed ${title.toLowerCase()}`}
        >
          <Text style={styles.linkText}>See Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.magenta} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.chartWrap}>
          <MiniBarChart data={data} accessibilityLabel={chartLabel} />
        </View>

        <View style={styles.average} accessibilityLabel={`Average ${averageText}`}>
          <Text style={styles.averageLabel}>Average</Text>
          <Text style={styles.averageValue}>{averageText}</Text>
          {withinRange === null ? (
            <Text style={styles.statusText}>{emptyText ?? 'No logged data yet'}</Text>
          ) : (
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: withinRange ? colors.fertilityGreen : colors.risingOrange },
                ]}
              />
              <Text style={styles.statusText}>
                {statusText ?? (withinRange ? 'Within typical range' : 'Outside typical range')}
              </Text>
            </View>
          )}
          <Text style={styles.rangeText}>{rangeText}</Text>
        </View>
      </View>

      {notes && notes.length > 0 ? (
        <View style={styles.notes}>
          {notes.map((n) => (
            <Text key={n} style={styles.noteText}>
              {n}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  headingText: { flex: 1, paddingRight: spacing.sm },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkText: { color: colors.magenta, fontWeight: '600', fontSize: 13 },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  chartWrap: { flex: 1.6 },
  average: {
    flex: 1,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  averageLabel: { fontSize: 13, fontWeight: '600', color: colors.navy },
  averageValue: { fontSize: 22, fontWeight: '800', color: colors.magenta, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
  rangeText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  notes: { marginTop: spacing.md, gap: 2 },
  noteText: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 17 },
});