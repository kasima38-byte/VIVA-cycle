import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DailyHeroCard from '../components/DailyHeroCard';
import DateSelector, { DateItem } from '../components/DateSelector';
import EnergySlider from '../components/EnergySlider';
import MoodSelector, { MoodValue } from '../components/MoodSelector';
import TrackingCard from '../components/TrackingCard';
import { colors, radius, spacing } from '../constants/theme';
import { saveDailyLog } from '../constants/cycleStore';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeek(centerDate: Date, dotDays: number[]): DateItem[] {
  const start = new Date(centerDate);
  start.setDate(start.getDate() - 3);
  const items: DateItem[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    items.push({
      key: d.toISOString().slice(0, 10),
      weekday: WEEKDAY_NAMES[d.getDay()],
      day: d.getDate(),
      hasDot: dotDays.includes(d.getDate()),
    });
  }
  return items;
}

export default function DailyTrackingScreen() {
  const [centerDate, setCenterDate] = useState(new Date(2026, 8, 17));
  const dates = useMemo(() => buildWeek(centerDate, [15, 16, 18]), [centerDate]);
  const [selectedKey, setSelectedKey] = useState(centerDate.toISOString().slice(0, 10));

  const [mood, setMood] = useState<MoodValue>('good');
  const [energy, setEnergy] = useState(50);

  const goPrevWeek = () => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() - 7);
    setCenterDate(d);
  };

  const goNextWeek = () => {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + 7);
    setCenterDate(d);
  };

  const energyLabel = energy < 25 ? 'Very low' : energy < 50 ? 'Low' : energy < 75 ? 'Moderate' : 'Very high';

  const trackingItems: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    status: string;
    onPress?: () => void;
  }[] = [
    { icon: 'water', title: 'Period', status: 'Not today' },
    { icon: 'water-outline', title: 'Flow / Spotting', status: 'Not today' },
    { icon: 'flash', title: 'Symptoms', status: '1 selected' },
    { icon: 'happy', title: 'Mood', status: mood === 'good' ? 'Good' : mood === 'great' ? 'Great' : mood === 'okay' ? 'Okay' : mood === 'low' ? 'Low' : 'Very low' },
    { icon: 'battery-half', title: 'Energy', status: energyLabel },
    { icon: 'ellipse-outline', title: 'Cervical Mucus', status: 'Not tracked' },
    { icon: 'heart', title: 'Sexual Activity', status: 'Not today', onPress: () => router.push('/sexual-activity') },
    { icon: 'medical', title: 'Medication', status: 'Not today' },
  ];

  const handleSave = () => {
    saveDailyLog(selectedKey, { mood, energy });
    router.back();
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
              <View style={{ width: 90, height: 40 }} />
            </View>

            <Text style={styles.title}>Daily Tracking</Text>
            <Text style={styles.subtitle}>Small details. A healthier, happier you.</Text>
          </View>

          <DateSelector
            dates={dates}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onPrev={goPrevWeek}
            onNext={goNextWeek}
          />

          <DailyHeroCard title="Track your day" subtitle="How are you feeling today?" />

          <View style={styles.grid}>
            {trackingItems.map((item) => (
              <View key={item.title} style={styles.gridItem}>
                <TrackingCard icon={item.icon} title={item.title} status={item.status} onPress={item.onPress} />
              </View>
            ))}
          </View>

          <View style={styles.moodCard}>
            <Text style={styles.cardTitle}>Mood Today</Text>
            <Text style={styles.cardSubtitle}>How are you feeling overall?</Text>
            <View style={{ marginTop: spacing.md }}>
              <MoodSelector value={mood} onChange={setMood} />
            </View>
          </View>

          <View style={styles.moodCard}>
            <Text style={styles.cardTitle}>Energy Level</Text>
            <Text style={styles.cardSubtitle}>How would you rate your energy?</Text>
            <View style={{ marginTop: spacing.lg }}>
              <EnergySlider value={energy} onChange={setEnergy} />
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save today's data"
          >
            <Text style={styles.saveButtonText}>Save Today's Data</Text>
          </Pressable>
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
    fontSize: 32,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 17,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48.5%',
  },
  moodCard: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
  },
  cardSubtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 3,
  },
  saveButton: {
    backgroundColor: colors.magenta,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 17,
  },
});