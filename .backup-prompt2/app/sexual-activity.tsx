import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotesInput from '../components/NotesInput';
import SexualActivityInfoCard from '../components/SexualActivityInfoCard';
import SymptomCard from '../components/SymptomCard';
import VivaToggle from '../components/VivaToggle';
import YesNoSelector from '../components/YesNoSelector';
import { colors, radius, spacing } from '../constants/theme';
import { saveSexualActivity } from '../constants/cycleStore';

type ActivityType = 'vaginal' | 'oral' | 'anal' | 'manual' | 'other';
type Protection = 'none' | 'condom' | 'pill' | 'iud' | 'other';

const activityTypes: { key: ActivityType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'vaginal', label: 'Vaginal', icon: 'people' },
  { key: 'oral', label: 'Oral', icon: 'happy-outline' },
  { key: 'anal', label: 'Anal', icon: 'heart-circle' },
  { key: 'manual', label: 'Manual', icon: 'hand-left' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const protectionOptions: { key: Protection; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'none', label: 'No protection', icon: 'shield-checkmark' },
  { key: 'condom', label: 'Condom', icon: 'ellipse' },
  { key: 'pill', label: 'Pill', icon: 'medical' },
  { key: 'iud', label: 'IUD', icon: 'remove' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

export default function SexualActivityScreen() {
  const [hadActivity, setHadActivity] = useState(true);
  const [types, setTypes] = useState<ActivityType[]>(['vaginal']);
  const [protection, setProtection] = useState<Protection>('none');
  const [tryingToConceive, setTryingToConceive] = useState(false);
  const [feltPleasure, setFeltPleasure] = useState(true);
  const [notes, setNotes] = useState('');

  const toggleType = (key: ActivityType) => {
    setTypes((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  };

  const handleSave = () => {
    const date = new Date().toISOString().slice(0, 10);
    saveSexualActivity(date, hadActivity);
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
              {/* VIVA Cycle logo reserved here once the official asset is supplied */}
              <View style={{ width: 90, height: 40 }} />
            </View>

            <Text style={styles.title}>Sexual Activity</Text>
            <Text style={styles.subtitle}>Track your intimate moments.</Text>
          </View>

          <SexualActivityInfoCard
            title="Your health. Your choices."
            body="Tracking sexual activity helps you understand your fertility and overall health."
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Did you have sexual activity today?</Text>
            <YesNoSelector value={hadActivity} onChange={setHadActivity} />
          </View>

          {hadActivity && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Type of activity</Text>
                <Text style={styles.sectionSubtitle}>You can select more than one.</Text>
                <View style={styles.grid}>
                  {activityTypes.map((t) => (
                    <SymptomCard
                      key={t.key}
                      icon={t.icon}
                      label={t.label}
                      selected={types.includes(t.key)}
                      onPress={() => toggleType(t.key)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Protection</Text>
                <View style={styles.grid}>
                  {protectionOptions.map((p) => (
                    <SymptomCard
                      key={p.key}
                      icon={p.icon}
                      label={p.label}
                      selected={protection === p.key}
                      onPress={() => setProtection(p.key)}
                    />
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.toggleCard}>
            <View style={styles.toggleIconCircle}>
              <Ionicons name="sparkles" size={20} color={colors.magenta} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Trying to conceive?</Text>
              <Text style={styles.toggleBody}>This helps us give you more relevant insights.</Text>
            </View>
            <VivaToggle value={tryingToConceive} onValueChange={setTryingToConceive} />
          </View>

          <View style={styles.toggleCard}>
            <View style={styles.toggleIconCircle}>
              <Ionicons name="heart" size={20} color={colors.magenta} />
            </View>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>Felt pleasure?</Text>
              <Text style={styles.toggleBody}>Helps you track your wellbeing.</Text>
            </View>
            <VivaToggle value={feltPleasure} onValueChange={setFeltPleasure} />
          </View>

          <View style={styles.section}>
            <View style={styles.notesHeadingRow}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.optionalText}> (optional)</Text>
            </View>
            <NotesInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note (e.g. how you felt, any details...)"
            />
          </View>

          <Pressable
            onPress={handleSave}
            style={styles.saveButton}
            accessibilityRole="button"
            accessibilityLabel="Save sexual activity"
          >
            <Text style={styles.saveButtonText}>Save Sexual Activity</Text>
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
  section: { gap: spacing.md },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.navy,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -6,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  notesHeadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  optionalText: {
    fontSize: 14.5,
    color: colors.textSecondary,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightPurple,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  toggleIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextWrap: {
    flex: 1,
    marginLeft: spacing.lg,
    marginRight: spacing.sm,
  },
  toggleTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.navy,
  },
  toggleBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
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