import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  selected: boolean;
  onPress: () => void;
};

export default function SymptomRow({ icon, label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${label.toLowerCase()} symptom`}
      accessibilityState={{ selected }}
    >
      <Ionicons name={icon} size={18} color={colors.magenta} />
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
        {label}
      </Text>
      {selected ? (
        <View style={styles.checkFilled}>
          <Ionicons name="checkmark" size={13} color={colors.white} />
        </View>
      ) : (
        <View style={styles.checkEmpty} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  rowSelected: {
    backgroundColor: colors.pinkVerySoft,
    borderColor: colors.magenta,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.navy,
  },
  labelSelected: {
    color: colors.magenta,
  },
  checkEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  checkFilled: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});