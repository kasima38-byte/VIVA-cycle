import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  statusLabel?: string;
  statusColor?: string;
  dateLabel?: string;
  onPress?: () => void;
};

export default function FertilityIndicatorCard({
  icon,
  title,
  description,
  statusLabel,
  statusColor,
  dateLabel,
  onPress,
}: Props) {
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={colors.magenta} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {statusLabel ? (
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      ) : null}

      {dateLabel ? (
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.navy} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.pinkSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.navy,
    marginTop: spacing.sm,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.navySoft,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});