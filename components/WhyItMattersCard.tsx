import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

// Short, educational explanation of why the estimated fertile window matters.
// Informational only: no promise of pregnancy, no confirmed ovulation.

type Props = { onPress?: () => void };

export default function WhyItMattersCard({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={
        'Why it matters. Pregnancy is most likely when sperm are present in the days leading up to ovulation and around ovulation. ' +
        'Sperm can survive for several days in the reproductive tract, which is why the days before estimated ovulation can also be fertile.'
      }
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="bulb-outline" size={20} color={colors.magenta} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>Why it matters</Text>
          <Text style={styles.body}>
            Pregnancy is most likely when sperm are present in the days leading up to ovulation and around ovulation.
          </Text>
          <Text style={styles.support}>
            Sperm can survive for several days in the reproductive tract, which is why the days before estimated
            ovulation can also be fertile.
          </Text>
        </View>
      </View>
      {onPress ? (
        <View style={styles.chevronRow}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.lavender,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#EADCFB',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', gap: 14 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy },
  body: { fontSize: 15.5, lineHeight: 22, color: colors.navySoft },
  support: { fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  chevronRow: { alignItems: 'flex-end', marginTop: 4 },
});
