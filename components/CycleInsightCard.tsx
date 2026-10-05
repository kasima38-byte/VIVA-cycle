import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  cardBg: string;
  value: string;
  unit?: string;
  label: string;
};

export default function CycleInsightCard({ icon, iconBg, iconColor, cardBg, value, unit, label }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 118,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  value: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.navy,
  },
  unit: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});