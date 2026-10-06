import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

// Calendar = estimate. LH test = hormone surge BEFORE ovulation.
// BBT = sustained rise AFTER ovulation (looking back). Educational only.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const METHODS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'flask-outline',
    title: 'LH / Ovulation Test',
    body: 'An LH test can detect the hormone surge that usually happens shortly before ovulation.',
  },
  {
    icon: 'thermometer-outline',
    title: 'Basal Body Temperature',
    body: 'A sustained rise in basal body temperature can provide evidence that ovulation has already occurred.',
  },
];

type Props = { onLearnHow: () => void };

export default function ConfirmOvulationCard({ onLearnHow }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Want to confirm ovulation?
      </Text>
      <Text style={styles.intro}>
        Your calendar can estimate when ovulation may happen, but it cannot confirm that ovulation occurred.
      </Text>

      <View style={styles.methods}>
        {METHODS.map((m) => (
          <View key={m.title} style={styles.method}>
            <View style={styles.iconCircle}>
              <Ionicons name={m.icon} size={18} color={colors.magenta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>{m.title}</Text>
              <Text style={styles.methodBody}>{m.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        No single sign or home method is perfect. Combining cycle tracking with body signs can give you more
        information about your cycle.
      </Text>

      <Pressable
        onPress={onLearnHow}
        hitSlop={10}
        style={styles.link}
        accessibilityRole="button"
        accessibilityLabel="Learn how to track ovulation"
      >
        <Text style={styles.linkText}>Learn how to track</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.magenta} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E6DAFB',
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy },
  intro: { fontSize: 15.5, lineHeight: 22, fontWeight: '600', color: colors.navy },
  methods: { gap: 12, marginTop: 2 },
  method: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pinkVerySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  methodBody: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 2 },
  note: { fontSize: 12.5, lineHeight: 17, color: colors.textSecondary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.magenta },
});
