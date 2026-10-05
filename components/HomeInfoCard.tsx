import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  cardBg: string;
  borderColor?: string;
  label: string;
  value: string;
  detail: string;
  onPress?: () => void;
};

export default function HomeInfoCard({
  icon,
  iconBg,
  iconColor,
  cardBg,
  borderColor,
  label,
  value,
  detail,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: cardBg },
        borderColor ? { borderWidth: 1, borderColor } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}, ${detail}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 19, fontWeight: '800', color: colors.navy, marginTop: 2 },
  detail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});