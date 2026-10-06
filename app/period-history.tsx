import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet from '../components/BottomSheet';
import { formatLongDate } from '../constants/cycleData';
import { colors, radius, spacing } from '../constants/theme';
import { calculateCycle, diffDays, isPlausibleCycleLength, PeriodLogResult } from '../lib/cycleEngine';
import { useToday } from '../lib/useToday';
import { correctPeriodStart, removePeriod, useVivaStore } from '../lib/vivaStore';

// Period History: the ONLY place a logged period's date can be edited or deleted.
// Settings never change these dates. Predictions are recalculated automatically.

const toDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export default function PeriodHistoryScreen() {
  const { periods, baseline } = useVivaStore();
  const today = useToday();
  const est = useMemo(() => calculateCycle(baseline, periods, today), [baseline, periods, today]);

  // Newest first, each with the cycle it started
  const rows = useMemo(() => {
    const starts = periods.map((p) => p.start).sort();
    return starts
      .map((start, i) => {
        const next = starts[i + 1];
        const length = next ? diffDays(next, start) : null;
        return { start, length, isCurrent: !next };
      })
      .reverse();
  }, [periods]);

  const [editing, setEditing] = useState<{ start: string; date: Date } | null>(null);

  const explain = (r: PeriodLogResult, date: string): boolean => {
    switch (r.kind) {
      case 'replaced':
      case 'added':
        return true;
      case 'duplicate':
        Alert.alert('Already logged', 'A period starting ' + formatLongDate(date) + ' is already saved.');
        return false;
      case 'future':
        Alert.alert('That date is in the future', 'Please choose today or an earlier date.');
        return false;
      case 'tooClose':
        Alert.alert(
          'Too close to another period',
          formatLongDate(date) + ' is only ' + r.daysApart + (r.daysApart === 1 ? ' day' : ' days') +
            ' from your period starting ' + formatLongDate(r.existing) +
            '. Periods usually start at least 15 days apart. If that other date is wrong, edit or delete it first.'
        );
        return false;
      default:
        Alert.alert('Please check the date', 'That date could not be saved.');
        return false;
    }
  };

  const saveEdit = (oldStart: string, newDate: Date) => {
    const newKey = toKey(newDate);
    if (newKey === oldStart) {
      setEditing(null);
      return;
    }
    if (explain(correctPeriodStart(oldStart, newKey), newKey)) setEditing(null);
  };

  const confirmDelete = (start: string) => {
    Alert.alert(
      'Delete this period?',
      'The period starting ' + formatLongDate(start) + ' will be removed. Your cycle and predictions will be recalculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (removePeriod(start) === 'lastOne') {
              Alert.alert('This is your only logged period', 'You need at least one period for predictions. You can edit its date instead.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} hitSlop={14} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Period history</Text>
            <Text style={styles.subtitle}>
              The periods you have logged. If a date was entered wrong, edit or delete it here.
            </Text>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.subtitle}>No periods logged yet.</Text>
          ) : (
            <View style={styles.list}>
              {rows.map((r) => (
                <View key={r.start} style={styles.row}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="water" size={20} color={colors.magenta} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{formatLongDate(r.start)}</Text>
                    <Text style={styles.rowSubtitle}>
                      {r.isCurrent
                        ? 'Current cycle' + (est && est.currentCycleStart === r.start ? ' · day ' + est.currentCycleDay : '')
                        : r.length !== null && isPlausibleCycleLength(r.length)
                        ? r.length + '-day cycle'
                        : r.length + ' days to next log (not counted as a cycle)'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setEditing({ start: r.start, date: toDate(r.start) })}
                    hitSlop={8}
                    style={styles.action}
                    accessibilityRole="button"
                    accessibilityLabel={'Edit period starting ' + formatLongDate(r.start)}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.navy} />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(r.start)}
                    hitSlop={8}
                    style={styles.action}
                    accessibilityRole="button"
                    accessibilityLabel={'Delete period starting ' + formatLongDate(r.start)}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.magenta} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footnote}>
            Cycle length is counted from one period start to the next. Changing your usual cycle length in Settings never
            changes these dates.
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* iOS: date wheel in a sheet with Save. Android: the system date dialog. */}
      {Platform.OS === 'ios' ? (
        <BottomSheet visible={editing !== null} title="Change start date" onClose={() => setEditing(null)}>
          {editing ? (
            <View>
              <DateTimePicker
                value={editing.date}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_: any, d?: Date) => d && setEditing({ ...editing, date: d })}
              />
              <Pressable
                style={styles.saveButton}
                onPress={() => saveEdit(editing.start, editing.date)}
                accessibilityRole="button"
              >
                <Text style={styles.saveButtonText}>Save date</Text>
              </Pressable>
            </View>
          ) : null}
        </BottomSheet>
      ) : editing ? (
        <DateTimePicker
          value={editing.date}
          mode="date"
          maximumDate={new Date()}
          onChange={(e: any, d?: Date) => {
            const current = editing;
            setEditing(null);
            if (e?.type === 'set' && d && current) saveEdit(current.start, d);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: { paddingHorizontal: spacing.screenH, paddingTop: spacing.sm, paddingBottom: 40, gap: spacing.lg },
  header: { gap: 6 },
  title: { fontSize: 30, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  rowSubtitle: { fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  action: { padding: 6 },
  footnote: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  saveButton: {
    marginTop: spacing.md,
    backgroundColor: colors.magenta,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
