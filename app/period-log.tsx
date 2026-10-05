import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateFieldCard from '../components/DateFieldCard';
import FlowIntensityCard from '../components/FlowIntensityCard';
import NotesInput from '../components/NotesInput';
import SymptomRow from '../components/SymptomRow';
import { todayLocal } from '../lib/cycleEngine';
import { formatLongDate } from '../constants/cycleData';
import { PeriodLogResult } from '../lib/cycleEngine';
import { correctPeriodStart, logPeriod } from '../lib/vivaStore';
import { colors, radius, spacing } from '../constants/theme';

type Flow = 'light' | 'moderate' | 'heavy' | 'veryHeavy';

const flowOptions: { key: Flow; label: string; drops: number }[] = [
  { key: 'light', label: 'Light', drops: 1 },
  { key: 'moderate', label: 'Moderate', drops: 2 },
  { key: 'heavy', label: 'Heavy', drops: 3 },
  { key: 'veryHeavy', label: 'Very heavy', drops: 4 },
];

const symptomOptions: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'cramps', label: 'Cramps', icon: 'flash' },
  { key: 'headache', label: 'Headache', icon: 'person' },
  { key: 'bloating', label: 'Bloating', icon: 'ellipse' },
  { key: 'backPain', label: 'Back pain', icon: 'body' },
  { key: 'moodChanges', label: 'Mood changes', icon: 'happy' },
  { key: 'fatigue', label: 'Fatigue', icon: 'battery-half' },
  { key: 'acne', label: 'Acne', icon: 'ellipsis-horizontal-circle' },
  { key: 'breastTenderness', label: 'Breast tenderness', icon: 'heart-half' },
  { key: 'foodCravings', label: 'Food cravings', icon: 'restaurant' },
];

export default function PeriodLogScreen() {
  const [dateKey, setDateKey] = useState(todayLocal());
  const [flow, setFlow] = useState<Flow>('light');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const toggleSymptom = (key: string) => {
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  // Shows what happened; returns true when the history was changed.
  const explain = (r: PeriodLogResult, date: string): boolean => {
    switch (r.kind) {
      case 'added':
      case 'replaced':
        return true;
      case 'duplicate':
        Alert.alert('Already logged', 'A period starting ' + formatLongDate(date) + ' is already saved.');
        return false;
      case 'future':
        Alert.alert('That date is in the future', 'You can only log a period that has already started.');
        return false;
      case 'invalid':
        Alert.alert('Please check the date', 'That date could not be saved.');
        return false;
      case 'tooClose':
        Alert.alert(
          'Is this a correction?',
          'You already logged a period starting ' + formatLongDate(r.existing) + ', only ' + r.daysApart +
            (r.daysApart === 1 ? ' day' : ' days') + ' apart. If that date was wrong, you can replace it.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace ' + formatLongDate(r.existing),
              onPress: () => {
                if (explain(correctPeriodStart(r.existing, date), date)) router.back();
              },
            },
          ]
        );
        return false;
    }
  };

  const handleSave = () => {
    // An ACTUAL period start: becomes Cycle Day 1 if it is the latest; older logs are kept.
    if (explain(logPeriod(dateKey), dateKey)) router.back();
  };
  
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.magenta} />
            </Pressable>
            <Text style={styles.title}>Log Period</Text>
            <Text style={styles.subtitle}>Record when your period starts.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Start date</Text>
            <Text style={styles.sectionSubtitle}>Select the first day of your period.</Text>
            <DateFieldCard dateKey={dateKey} onChange={setDateKey} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Flow</Text>
            <Text style={styles.sectionSubtitle}>How was your flow on the first day?</Text>
            <View style={styles.flowRow}>
              {flowOptions.map((option) => (
                <FlowIntensityCard
                  key={option.key}
                  label={option.label}
                  dropletCount={option.drops}
                  selected={flow === option.key}
                  onPress={() => setFlow(option.key)}
                />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.headingRow}>
              <Text style={styles.sectionTitle}>Symptoms</Text>
              <Text style={styles.optionalText}> (optional)</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Select any symptoms you're experiencing.</Text>
            <View style={styles.symptomGrid}>
              {Array.from({ length: Math.ceil(symptomOptions.length / 3) }).map((_, rowIdx) => (
                <View key={rowIdx} style={styles.symptomRow}>
                  {symptomOptions.slice(rowIdx * 3, rowIdx * 3 + 3).map((s) => (
                    <SymptomRow
                      key={s.key}
                      icon={s.icon}
                      label={s.label}
                      selected={symptoms.includes(s.key)}
                      onPress={() => toggleSymptom(s.key)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.headingRow}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.optionalText}> (optional)</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Add any additional notes.</Text>
            <NotesInput value={notes} onChangeText={setNotes} placeholder="Write a note..." />
          </View>

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save period log"
          >
            <Text style={styles.saveButtonText}>Save Period Log</Text>
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
    gap: spacing.lg,
  },
  header: { alignItems: 'center', gap: 4 },
  backButton: { alignSelf: 'flex-start', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  card: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headingRow: { flexDirection: 'row', alignItems: 'baseline' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.navy },
  sectionSubtitle: { fontSize: 13.5, color: colors.textSecondary, marginTop: -2 },
  optionalText: { fontSize: 14, color: colors.textSecondary },
  flowRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  symptomGrid: { gap: spacing.sm, marginTop: 4 },
  symptomRow: { flexDirection: 'row', gap: spacing.sm },
  saveButton: {
    backgroundColor: colors.magenta,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 17 },
});