import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Stat = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
};

export default function ProfileStatsCard({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.card}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.item, i > 0 && styles.divider]}>
          <View style={styles.iconCircle}>
            <Ionicons name={s.icon} size={16} color={colors.magenta} />
          </View>
          <Text style={styles.value}>{s.value}</Text>
          <Text style={styles.label} numberOfLines={2}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.pinkSoft },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 14.5, fontWeight: '700', color: colors.navy },
  label: { fontSize: 10.5, color: colors.textSecondary, textAlign: 'center' },
});