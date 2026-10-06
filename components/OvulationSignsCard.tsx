import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

// Educational only: possible body signs around ovulation. VIVA does not track
// or detect these, and no single sign confirms ovulation.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SIGNS: { icon: IconName; text: string; prominent: boolean }[] = [
  { icon: 'water-outline', text: 'Clear, slippery cervical mucus', prominent: true },
  { icon: 'flask-outline', text: 'Positive LH/ovulation test', prominent: true },
  { icon: 'thermometer-outline', text: 'A slight rise in basal body temperature after ovulation', prominent: false },
  { icon: 'ellipse-outline', text: 'Some women notice mild pelvic discomfort', prominent: false },
];

const DISCLAIMER =
  'Signs vary between people, and not every sign occurs in every cycle. No single sign confirms ovulation on its own.';

type Props = { onPress?: () => void };

export default function OvulationSignsCard({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={
        'Signs you may be approaching ovulation. ' + SIGNS.map((s) => s.text).join('. ') + '. ' + DISCLAIMER
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="water" size={18} color={colors.magenta} />
        </View>
        <Text style={styles.title}>Signs you may be approaching ovulation</Text>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} /> : null}
      </View>

      <View style={styles.list}>
        {SIGNS.map((s) => (
          <View key={s.text} style={[styles.row, s.prominent && styles.rowProminent]}>
            <Ionicons name={s.icon} size={16} color={s.prominent ? colors.magenta : colors.textSecondary} />
            <Text style={[styles.rowText, s.prominent && styles.rowTextProminent]}>{s.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F8DCEA',
    padding: 20,
    gap: 14,
  },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '800', color: colors.navy },
  list: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 12 },
  rowProminent: { backgroundColor: colors.white, borderRadius: 14, paddingVertical: 10 },
  rowText: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
  rowTextProminent: { fontSize: 15, fontWeight: '700', color: colors.navy },
  disclaimer: { fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
});
