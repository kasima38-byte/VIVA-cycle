import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  value: string;
  detail?: string;
  onPress?: () => void;
};

export default function InsightSummaryCard({ icon, title, value, detail, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}${detail ? ', ' + detail : ''}`}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={colors.magenta} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 8,
    minHeight: 84,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: colors.navy },
  value: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
  detail: { fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
});