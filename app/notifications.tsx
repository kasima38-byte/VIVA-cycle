import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IntroCard from '../components/IntroCard';
import NotificationRow, { NotificationRowProps } from '../components/NotificationRow';
import PrivacyInfoCard from '../components/PrivacyInfoCard';
import { colors, spacing } from '../constants/theme';

type RowConfig = Omit<NotificationRowProps, 'value' | 'onValueChange' | 'isLast'> & { key: string };

const cycleReminders: RowConfig[] = [
  {
    key: 'period',
    icon: 'water',
    iconBg: colors.pinkSoft,
    iconColor: colors.magenta,
    title: 'Period reminder',
    description: 'Get notified before your period is due.',
  },
  {
    key: 'ovulation',
    icon: 'calendar',
    iconBg: colors.pinkSoft,
    iconColor: colors.magenta,
    title: 'Estimated ovulation reminder',
    description: 'Get notified before your estimated fertile window.',
  },
  {
    key: 'fertile',
    icon: 'heart',
    iconBg: colors.pinkSoft,
    iconColor: colors.magenta,
    title: 'Estimated fertile window reminder',
    description: 'Know when your estimated fertile window is coming.',
  },
  {
    key: 'summary',
    icon: 'document-text',
    iconBg: colors.pinkSoft,
    iconColor: colors.magenta,
    title: 'Cycle summary',
    description: 'Get a monthly recap of your cycle.',
  },
];

const lifestyleReminders: RowConfig[] = [
  {
    key: 'medication',
    icon: 'link',
    iconBg: colors.lavender,
    iconColor: colors.purpleIcon,
    title: 'Medication reminders',
    description: 'Reminders for birth control or other medication.',
  },
  {
    key: 'water',
    icon: 'water-outline',
    iconBg: colors.lightBlue,
    iconColor: colors.blue,
    title: 'Water reminder',
    description: 'Stay hydrated throughout the day.',
  },
  {
    key: 'activity',
    icon: 'walk',
    iconBg: colors.lightGreen,
    iconColor: colors.green,
    title: 'Activity reminder',
    description: 'Gentle nudges to stay active.',
  },
  {
    key: 'selfcare',
    icon: 'flower',
    iconBg: colors.lavender,
    iconColor: colors.purpleIcon,
    title: 'Self-care reminder',
    description: 'Take time for your mental wellbeing.',
  },
];

const appUpdates: RowConfig[] = [
  {
    key: 'tips',
    icon: 'megaphone',
    iconBg: colors.pinkSoft,
    iconColor: colors.magenta,
    title: 'Tips and expert advice',
    description: 'Get helpful tips, articles and feature updates.',
  },
];

const initialState: Record<string, boolean> = {
  period: true,
  ovulation: true,
  fertile: true,
  summary: true,
  medication: true,
  water: false,
  activity: false,
  selfcare: true,
  tips: true,
};

function GroupedRows({
  rows,
  values,
  onToggle,
}: {
  rows: RowConfig[];
  values: Record<string, boolean>;
  onToggle: (key: string, next: boolean) => void;
}) {
  return (
    <View style={styles.groupedCard}>
      {rows.map((row, i) => (
        <NotificationRow
          {...row}
          value={values[row.key]}
          onValueChange={(next) => onToggle(row.key, next)}
          isLast={i === rows.length - 1}
        />
      ))}
    </View>
  );
}

export default function NotificationsScreen() {
  const [values, setValues] = useState(initialState);

  const handleToggle = (key: string, next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={26} color={colors.navy} />
              </Pressable>
              {/* VIVA Cycle logo reserved here once the official asset is supplied */}
              <View style={{ width: 90, height: 40 }} />
            </View>

            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>Reminders that support your journey.</Text>
          </View>

          <IntroCard
            icon="notifications"
            title="Stay on track"
            description="Get gentle reminders and never miss what matters."
          />

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Cycle reminders</Text>
              <Text style={styles.sectionSubtitle}>Get notified about key dates in your cycle.</Text>
            </View>
            <GroupedRows rows={cycleReminders} values={values} onToggle={handleToggle} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Lifestyle reminders</Text>
              <Text style={styles.sectionSubtitle}>Build healthy habits.</Text>
            </View>
            <GroupedRows rows={lifestyleReminders} values={values} onToggle={handleToggle} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>App updates</Text>
              <Text style={styles.sectionSubtitle}>Stay informed about new features and tips.</Text>
            </View>
            <GroupedRows rows={appUpdates} values={values} onToggle={handleToggle} />
          </View>

          <PrivacyInfoCard
            title="You're in control"
            body="You can turn notifications on or off at any time."
          />
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
    paddingBottom: 40,
    gap: spacing.xl,
  },
  header: { gap: 6 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: { gap: spacing.md },
  sectionHeading: { gap: 2 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
  },
  sectionSubtitle: {
    fontSize: 15.5,
    color: colors.textSecondary,
  },
  groupedCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});