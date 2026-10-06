import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CycleProgressArc from '../../components/CycleProgressArc';
import MiniIconRow from '../../components/MiniIconRow';
import OutlinedButton from '../../components/OutlinedButton';
import { firstName, getHomeSummary, greeting } from '../../constants/homeData';
import { useToday } from '../../lib/useToday';
import { useVivaStore } from '../../lib/vivaStore';
import { colors, radius, spacing } from '../../constants/theme';

export default function HomeScreen() {
  const viva = useVivaStore();
  const today = useToday();
  const summary = getHomeSummary(viva, today);
  const name = firstName(viva.name);
  
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                {greeting()}, {'\n'}
                {name}
              </Text>
              <Text style={styles.subtitle}>Here's where you are in your cycle.</Text>
            </View>
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={styles.bellWrap}
            >
              <Ionicons name="notifications-outline" size={26} color={colors.navy} />
              <View style={styles.bellDot} />
            </Pressable>
          </View>

          <View style={styles.cycleCard}>
            <View style={styles.cycleTop}>
              <CycleProgressArc cycleDay={summary.cycleDay} cycleLength={summary.cycleLength} />

              <View style={styles.cycleInfo}>
                <View style={styles.phasePill}>
                  <Text style={styles.phaseText}>ESTIMATED</Text>
                </View>
                <Text style={styles.cycleHeadline}>{summary.phase}</Text>
                <Text style={styles.nextPeriodDetail}>{summary.phaseExplanation}</Text>

                <MiniIconRow icon="calendar" label="Estimated fertile window" value={summary.fertileRange} />
                <MiniIconRow icon="radio-button-on" label="Estimated ovulation" value={summary.ovulationText} />
                                <Text style={styles.nextPeriodDetail}>{summary.confidenceNote}</Text>
                                                {summary.goalNote ? <Text style={styles.nextPeriodDetail}>{summary.goalNote}</Text> : null}
              </View>
            </View>

            <OutlinedButton label="View calendar" onPress={() => router.push('/(tabs)/calendar')} />
          </View>
          
          <Pressable
            style={styles.nextPeriodCard}
            onPress={() => router.push('/(tabs)/calendar')}
            accessibilityRole="button"
            accessibilityLabel={summary.isLate ? 'Period may be late' : 'Next period in ' + summary.nextPeriodDays + ' days'}
          >
            <View style={styles.nextPeriodIconCircle}>
              <Ionicons name="calendar" size={20} color={colors.magenta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextPeriodLabel}>Next period</Text>
              <Text style={styles.nextPeriodValue}>
                {summary.isLate
                  ? 'About ' + summary.periodLateDays + ' days late'
                  : 'In ' + summary.nextPeriodDays + ' days'}
              </Text>
              <Text style={styles.nextPeriodDetail}>{summary.nextPeriodText}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.magenta} />
          </Pressable>

          <View style={styles.todayCard}>
            <View style={styles.todayIconCircle}>
              <Ionicons name="leaf" size={20} color={colors.ovulationPurple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayLabel}>Today</Text>
              <Text style={styles.todayBody}>Cycle day {summary.cycleDay}</Text>
              <Text style={styles.todayBody}>{summary.phase}</Text>
            </View>
            {summary.todayNote ? (
              <View style={styles.notePill}>
                <Text style={styles.notePillText}>{summary.todayNote}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionCard, { backgroundColor: colors.pinkVerySoft }]}
              onPress={() => router.push('/period-log')}
              accessibilityRole="button"
              accessibilityLabel="Log period"
            >
              <View style={styles.actionTopRow}>
                <View style={[styles.actionIconCircle, { backgroundColor: colors.pinkSoft }]}>
                  <Ionicons name="water" size={18} color={colors.magenta} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.magenta} />
              </View>
              <Text style={styles.actionTitle}>Log period</Text>
              <Text style={styles.actionSubtitle}>Record when your period starts.</Text>
            </Pressable>

            <Pressable
              style={[styles.actionCard, { backgroundColor: colors.lightPurple }]}
              onPress={() => router.push('/daily-tracking')}
              accessibilityRole="button"
              accessibilityLabel="Daily tracking"
            >
              <View style={styles.actionTopRow}>
                <View style={[styles.actionIconCircle, { backgroundColor: colors.white }]}>
                  <Ionicons name="document-text" size={18} color={colors.navy} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.navy} />
              </View>
              <Text style={styles.actionTitle}>Daily tracking</Text>
              <Text style={styles.actionSubtitle}>Log symptoms, mood and more.</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.sm,
    paddingBottom: 40,
    gap: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  greeting: { fontSize: 28, fontWeight: '800', color: colors.navy, lineHeight: 32 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  bellWrap: { padding: 2 },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.magenta,
  },
  cycleCard: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cycleTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cycleInfo: { flex: 1, gap: spacing.sm },
  phasePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.pinkSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phaseText: { fontSize: 11, fontWeight: '700', color: colors.magenta, letterSpacing: 0.5 },
  cycleHeadline: { fontSize: 16, fontWeight: '700', color: colors.navy },
  nextPeriodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  nextPeriodIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPeriodLabel: { fontSize: 14, fontWeight: '700', color: colors.navy },
  nextPeriodValue: { fontSize: 19, fontWeight: '800', color: colors.magenta, marginTop: 2 },
  nextPeriodDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.lightPurple,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  todayIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayLabel: { fontSize: 14, fontWeight: '700', color: colors.navy },
  todayBody: { fontSize: 13.5, color: colors.navy, fontWeight: '600', marginTop: 1 },
  notePill: {
    backgroundColor: colors.pinkSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 100,
  },
  notePillText: { fontSize: 11.5, fontWeight: '700', color: colors.magenta, textAlign: 'center' },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.navy },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 108,
    justifyContent: 'space-between',
  },
  actionTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 15.5, fontWeight: '700', color: colors.navy, marginTop: 8 },
  actionSubtitle: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});