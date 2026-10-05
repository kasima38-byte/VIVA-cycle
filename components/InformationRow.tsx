import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

export type InformationRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress?: () => void;
  isLast?: boolean;
};

export default function InformationRow({ icon, label, value, onPress, isLast }: InformationRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !isLast && styles.divider]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={22} color={colors.magenta} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>

      <Ionicons name="chevron-forward" size={22} color={colors.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  label: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.navy,
  },
  value: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
});