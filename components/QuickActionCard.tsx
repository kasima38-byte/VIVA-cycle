import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  cardBg: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export default function QuickActionCard({ icon, iconBg, iconColor, cardBg, title, subtitle, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: cardBg }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.navy} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 108,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15.5, fontWeight: '700', color: colors.navy, marginTop: 8 },
  subtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});