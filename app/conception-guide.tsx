import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';

// Trying to conceive: plain-language education. General information only;
// no promises, and VIVA's dates are always described as estimates.

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Your fertile window',
    body: [
      'The fertile window is the few days before ovulation and the day of ovulation itself.',
      'Sperm can survive for up to about 5 days in the reproductive tract, while an egg survives for about a day after it is released. That is why the days before estimated ovulation matter most.',
    ],
  },
  {
    title: 'Timing sex',
    body: [
      'Sex every 1–2 days during the fertile window helps make sure sperm are present when an egg is released.',
      "There is no need to aim for one exact day, and trying to do so can add stress. Even with good timing, it's normal for pregnancy to take several cycles.",
    ],
  },
  {
    title: 'If your cycle varies',
    body: [
      'Ovulation timing can change from cycle to cycle, and every woman’s fertile window is different. When your cycle length varies, calendar estimates are less precise.',
      'Body signs such as clear, slippery cervical mucus, or a positive LH/ovulation test, can give extra information about your own cycle.',
    ],
  },
  {
    title: 'When to talk to a health worker',
    body: [
      'Consider speaking to a doctor or nurse if you have been trying for 12 months without becoming pregnant, or after 6 months if you are 35 or older.',
      'Speak to someone sooner if your periods are very irregular or absent, or if you have any health concerns.',
    ],
  },
];

export default function ConceptionGuideScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Trying to conceive
            </Text>
            <Text style={styles.subtitle}>How the fertile window works, and how to use it.</Text>
          </View>

          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.card}>
              <Text style={styles.cardTitle}>{s.title}</Text>
              {s.body.map((p, i) => (
                <Text key={i} style={i === 0 ? styles.cardBody : styles.cardSupport}>
                  {p}
                </Text>
              ))}
            </View>
          ))}

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.noticeText}>
              VIVA's fertile-window dates are estimates and cannot guarantee when ovulation occurs. This information is
              general and does not replace advice from a health professional.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.screenH, paddingTop: spacing.sm, paddingBottom: 40, gap: spacing.lg },
  back: { alignSelf: 'flex-start' },
  header: { gap: 8, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', color: colors.navy, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, lineHeight: 23, color: colors.textSecondary },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  cardBody: { fontSize: 15.5, lineHeight: 22, color: colors.navySoft },
  cardSupport: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  notice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: 14,
    padding: 12,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
