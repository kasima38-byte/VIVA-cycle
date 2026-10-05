import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

export type SettingsRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  value?: string;
  onPress?: () => void;
};

export default function SettingsRow({ icon, title, subtitle, value, onPress }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}: ${value}` : title}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={24} color={colors.magenta} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {value ? <Text style={styles.value}>{value}</Text> : null}

      <Ionicons name="chevron-forward" size={23} color={colors.navy} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    marginLeft: spacing.lg,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.navy,
    marginRight: 4,
  },
  chevron: {
    flexShrink: 0,
  },
});