import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

// Goal-specific practical guidance, clearly labelled. No promise of pregnancy.

type Props = { onLearnMore: () => void };

export default function TryingToConceiveCard({ onLearnMore }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="heart-outline" size={18} color={colors.magenta} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Trying to conceive?
        </Text>
      </View>

      <Text style={styles.body}>
        Sex every 1–2 days during the fertile window can help maximize the chance of pregnancy.
      </Text>
      <Text style={styles.support}>
        You don't need to have sex on one specific day. The fertile window covers several days because sperm can
        survive for several days in the reproductive tract.
      </Text>

      <Pressable
        onPress={onLearnMore}
        hitSlop={10}
        style={styles.link}
        accessibilityRole="button"
        accessibilityLabel="Learn more about trying to conceive"
      >
        <Text style={styles.linkText}>Learn more</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.magenta} />
      </Pressable>

      <Text style={styles.note}>
        VIVA's fertile-window dates are estimates and cannot guarantee when ovulation occurs.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.lavender,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F0D9F0',
    padding: 20,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.navy },
  body: { fontSize: 15.5, lineHeight: 22, fontWeight: '600', color: colors.navy },
  support: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.magenta },
  note: { fontSize: 12.5, lineHeight: 17, color: colors.textSecondary, marginTop: 2 },
});
