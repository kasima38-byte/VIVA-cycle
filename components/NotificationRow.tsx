import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import VivaToggle from './VivaToggle';

export type NotificationRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  onPress?: () => void;
  isLast?: boolean;
};

export default function NotificationRow({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  value,
  onValueChange,
  onPress,
  isLast,
}: NotificationRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !isLast && styles.divider]}
      accessibilityLabel={`${title}: ${value ? 'on' : 'off'}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <View style={styles.controls}>
        <VivaToggle value={value} onValueChange={onValueChange} />
        <Ionicons name="chevron-forward" size={22} color={colors.navy} />
      </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    marginLeft: spacing.lg,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.navy,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});