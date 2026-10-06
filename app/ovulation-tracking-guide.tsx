import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';

// How each method relates to ovulation: estimate (before), surge (just before),
// temperature shift (after). General education only.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const METHODS: { icon: IconName; tag: string; title: string; body: string[] }[] = [
  {
    icon: 'calendar-outline',
    tag: 'ESTIMATE',
    title: 'Cycle tracking (VIVA)',
    body: [
      'VIVA estimates your fertile window from the period dates you log and your usual cycle length.',
      'It is a calendar estimate. It cannot tell whether or when ovulation actually happened, and it is less precise when your cycle length varies.',
    ],
  },
  {
    icon: 'flask-outline',
    tag: 'BEFORE OVULATION',
    title: 'LH / ovulation tests',
    body: [
      'These urine tests detect a rise in luteinising hormone (LH), which usually happens 1–2 days before ovulation.',
      'Start testing a few days before your estimated fertile window and follow the instructions on the pack. A positive test suggests ovulation may be coming soon; it does not prove that ovulation happened.',
    ],
  },
  {
    icon: 'thermometer-outline',
    tag: 'AFTER OVULATION',
    title: 'Basal body temperature (BBT)',
    body: [
      'Take your temperature every morning at the same time, before getting out of bed, using a thermometer that shows two decimal places.',
      'After ovulation, your temperature usually rises slightly (about 0.2–0.5°C) and stays up. A rise that lasts for about three days suggests ovulation has already happened. BBT looks back: it cannot warn you in advance, but over several cycles it can show your pattern.',
    ],
  },
  {
    icon: 'water-outline',
    tag: 'AROUND THE FERTILE DAYS',
    title: 'Cervical mucus',
    body: [
      'As ovulation gets closer, mucus often becomes clear, slippery and stretchy, a bit like raw egg white.',
      'Noticing this can help you recognise your most fertile days, although not every woman notices a clear change.',
    ],
  },
];

export default function OvulationTrackingGuideScreen() {
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
              How to track ovulation
            </Text>
            <Text style={styles.subtitle}>
              Each method tells you something different. Used together, they give a fuller picture of your cycle.
            </Text>
          </View>

          {METHODS.map((m) => (
            <View key={m.title} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Ionicons name={m.icon} size={18} color={colors.magenta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tag}>{m.tag}</Text>
                  <Text style={styles.cardTitle}>{m.title}</Text>
                </View>
              </View>
              {m.body.map((p, i) => (
                <Text key={i} style={i === 0 ? styles.cardBody : styles.cardSupport}>
                  {p}
                </Text>
              ))}
            </View>
          ))}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Confirming ovulation medically</Text>
            <Text style={styles.cardBody}>
              If you need to know for certain, a health worker can check with a blood test for progesterone in the
              second half of your cycle, or with an ultrasound scan.
            </Text>
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.noticeText}>
              No single sign or home method is perfect. This information is general and does not replace advice from a
              health professional.
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pinkVerySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.magenta },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  cardBody: { fontSize: 15.5, lineHeight: 22, color: colors.navySoft },
  cardSupport: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: colors.pinkVerySoft, borderRadius: 14, padding: 12 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
