import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  label: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export default function MonthSelector({ label, onPrevMonth, onNextMonth, onToday }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPrevMonth} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month">
        <Ionicons name="chevron-back" size={22} color={colors.navy} />
      </Pressable>

      <View style={styles.pill}>
        <Text style={styles.pillText}>{label}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.magenta} style={{ marginLeft: 6 }} />
      </View>

      <Pressable onPress={onNextMonth} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next month">
        <Ionicons name="chevron-forward" size={22} color={colors.navy} />
      </Pressable>

      <Pressable onPress={onToday} style={styles.todayButton} accessibilityRole="button">
        <Text style={styles.todayText}>Today</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  pillText: {
    color: colors.magenta,
    fontWeight: '700',
    fontSize: 16,
  },
  todayButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.magenta,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: spacing.sm,
  },
  todayText: {
    color: colors.magenta,
    fontWeight: '600',
    fontSize: 14,
  },
});