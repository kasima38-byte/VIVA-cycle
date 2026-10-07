// VIVA Cycle - Medications sheet (Daily Tracking)
// Records what she took (lib/medicationService.ts). Several entries per day; each saves on its own.
// No suggestions, no dose calculations, no reminders.

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { formatLongDate, relativeDayName } from '../lib/dailyTracking';
import {
  MedicationInput, MedicationResult, addMedication, clearMedications, deleteMedication, updateMedication,
} from '../lib/medicationService';
import {
  MEDICATION_LIMITS, MedicationEntry, UNIT_SUGGESTIONS, describeMedication, formatDose, formatTime, timeFromDate,
} from '../lib/medications';
import { useVivaStore } from '../lib/vivaStore';
import BottomSheet from './BottomSheet';

type Tone = 'success' | 'error' | 'info';
type Mode = 'list' | 'form' | 'confirmDelete' | 'confirmClear';

type Props = {
  visible: boolean;
  date: string;
  today: string;
  onClose: () => void;
  onFeedback: (text: string, tone: Tone) => void;
};

const ERRORS: Partial<Record<MedicationResult, string>> = {
  future: 'Medications can only be recorded for today or earlier.',
  invalid: "That time isn't valid. Please set it again.",
  tooMany: 'You can record up to ' + MEDICATION_LIMITS.entriesPerDay + ' medications per day.',
  notFound: 'That entry was already removed.',
  failed: "Couldn't save. Please try again.",
};

export default function MedicationsSheet({ visible, date, today, onClose, onFeedback }: Props) {
  const { dailyLogs } = useVivaStore();
  const entries: MedicationEntry[] = dailyLogs[date]?.medications ?? [];
  const { height } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('');
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  // Every time the sheet opens, start at the list for the selected date
  useEffect(() => {
    if (!visible) return;
    setMode('list');
    setEditingId(null);
    setTargetId(null);
    setShowPicker(false);
    setNameError(false);
    setBusy(false);
    setError(null);
    setFlash(null);
    setChanged(false);
  }, [visible, date]);

  const rel = relativeDayName(date, today);
  const isToday = date === today;

  const fillForm = (e: MedicationEntry | null) => {
    setEditingId(e?.id ?? null);
    setName(e?.name ?? '');
    setDose(e?.dose ?? '');
    setUnit(e?.unit ?? '');
    setTime(e?.time ?? null);
    setNote(e?.note ?? '');
    setShowPicker(false);
    setNameError(false);
    setError(null);
    setFlash(null);
    setMode('form');
  };

  const done = (message: string) => {
    setChanged(true);
    setFlash(message);
    AccessibilityInfo.announceForAccessibility(message);
    setShowPicker(false);
    setMode('list');
  };

  const handle = (result: MedicationResult, message: string) => {
    if (result === 'saved') done(message);
    else if (result === 'unchanged') setMode('list');
    else if (result === 'missingName') setNameError(true);
    else setError(ERRORS[result] ?? "Couldn't save. Please try again.");
  };

  const saveForm = async () => {
    if (busy) return;
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setBusy(true);
    setError(null);
    const input: MedicationInput = { name, dose, unit, time, note };
    const result = editingId
      ? await updateMedication(date, editingId, input)
      : (await addMedication(date, input)).result;
    setBusy(false);
    handle(result, editingId ? 'Medication updated' : 'Medication saved');
  };

  const removeOne = async () => {
    if (busy || !targetId) return;
    setBusy(true);
    const result = await deleteMedication(date, targetId);
    setBusy(false);
    setTargetId(null);
    handle(result, 'Medication removed');
  };

  const removeAll = async () => {
    if (busy) return;
    setBusy(true);
    const result = await clearMedications(date);
    setBusy(false);
    handle(result, 'All medications removed');
  };

  const onPickTime = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'set' && picked) setTime(timeFromDate(picked));
  };

  const pickerValue = (() => {
    const d = new Date();
    if (time) {
      const [h, m] = time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  })();

  const target = entries.find((e) => e.id === targetId) ?? null;

  let primaryLabel = 'Done';
  let onPrimary: () => void = () => {
    onClose();
    if (changed) onFeedback('Medications updated', 'success');
  };
  if (mode === 'form') {
    primaryLabel = 'Save medication';
    onPrimary = () => void saveForm();
  } else if (mode === 'confirmDelete') {
    primaryLabel = 'Remove';
    onPrimary = () => void removeOne();
  } else if (mode === 'confirmClear') {
    primaryLabel = 'Remove all';
    onPrimary = () => void removeAll();
  }

  return (
    <BottomSheet
      visible={visible}
      title="Medications"
      onClose={onClose}
      primaryLabel={busy ? 'Saving…' : primaryLabel}
      onPrimary={onPrimary}
      primaryDisabled={busy}
    >
      <Text style={styles.subtitle}>{isToday ? 'What did you take today?' : 'What did you take on this day?'}</Text>
      <View
        style={styles.dateBlock}
        accessible
        accessibilityLabel={'Selected date: ' + (rel ? rel + ', ' : '') + formatLongDate(date)}
      >
        {rel && <Text style={styles.dateRel}>{rel}</Text>}
        <Text style={styles.dateText}>{formatLongDate(date)}</Text>
      </View>

      {/* ---------- List ---------- */}
      {mode === 'list' && (
        <>
          {flash && (
            <View style={styles.flash} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={styles.flashText}>{flash}</Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: height * 0.4 }} contentContainerStyle={styles.list} nestedScrollEnabled>
            {entries.length === 0 && (
              <Text style={styles.empty}>
                {isToday ? 'No medications recorded today.' : 'No medications recorded for this day.'}
              </Text>
            )}
            {entries.map((e) => {
              const details = [formatDose(e), formatTime(e.time)].filter(Boolean).join(' · ');
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable
                    onPress={() => fillForm(e)}
                    style={({ pressed }) => [styles.entryMain, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={'Medication: ' + describeMedication(e)}
                    accessibilityHint="Opens this entry to edit"
                  >
                    <Text style={styles.entryName}>{e.name}</Text>
                    {details ? <Text style={styles.entryDetail}>{details}</Text> : null}
                    {e.note ? (
                      <Text style={styles.entryNote} numberOfLines={1}>
                        {e.note}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setTargetId(e.id);
                      setError(null);
                      setMode('confirmDelete');
                    }}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={'Delete ' + e.name}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.magenta} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          {entries.length < MEDICATION_LIMITS.entriesPerDay && (
            <Pressable
              onPress={() => fillForm(null)}
              style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Add medication"
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.magenta} />
              <Text style={styles.addText}>Add medication</Text>
            </Pressable>
          )}

          {entries.length > 0 && (
            <Pressable
              onPress={() => {
                setError(null);
                setMode('confirmClear');
              }}
              style={styles.link}
              accessibilityRole="button"
              accessibilityLabel="Clear all medications for this date"
            >
              <Text style={styles.linkText}>Clear all</Text>
            </Pressable>
          )}
        </>
      )}

      {/* ---------- Add / edit form ---------- */}
      {mode === 'form' && (
        <ScrollView
          style={{ maxHeight: height * 0.5 }}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <Text style={styles.sectionTitle}>{editingId ? 'Edit medication' : 'Add medication'}</Text>

          <Text style={styles.fieldLabel}>Medication name</Text>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (t.trim()) setNameError(false);
            }}
            maxLength={MEDICATION_LIMITS.name}
            placeholder="e.g. Ibuprofen"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, nameError && styles.inputError]}
            accessibilityLabel="Medication name, required"
            autoCapitalize="words"
          />
          {nameError && (
            <Text style={styles.fieldError} accessibilityLiveRegion="assertive">
              Enter a medication name.
            </Text>
          )}

          <View style={styles.row2}>
            <View style={styles.flex}>
              <Text style={styles.fieldLabel}>Dose (optional)</Text>
              <TextInput
                value={dose}
                onChangeText={setDose}
                maxLength={MEDICATION_LIMITS.dose}
                placeholder="e.g. 400"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                accessibilityLabel="Dose, optional"
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.fieldLabel}>Unit (optional)</Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                maxLength={MEDICATION_LIMITS.unit}
                placeholder="e.g. mg"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
                accessibilityLabel="Unit, optional"
              />
            </View>
          </View>
          <View style={styles.chips}>
            {UNIT_SUGGESTIONS.map((u) => (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                hitSlop={6}
                style={[styles.chip, unit === u && styles.chipOn]}
                accessibilityRole="button"
                accessibilityLabel={'Use unit ' + u}
                accessibilityState={{ selected: unit === u }}
              >
                <Text style={[styles.chipText, unit === u && styles.chipTextOn]}>{u}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Time (optional)</Text>
          <View style={styles.timeRow}>
            <Text style={styles.timeValue}>{formatTime(time) ?? 'Not set'}</Text>
            <Pressable
              onPress={() => setShowPicker((s) => !s)}
              style={styles.smallButton}
              accessibilityRole="button"
              accessibilityLabel={time ? 'Change time' : 'Set time'}
            >
              <Text style={styles.smallButtonText}>{time ? 'Change' : 'Set time'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setTime(timeFromDate(new Date()))}
              style={styles.smallButton}
              accessibilityRole="button"
              accessibilityLabel="Use the current time"
            >
              <Text style={styles.smallButtonText}>Now</Text>
            </Pressable>
            {time && (
              <Pressable
                onPress={() => setTime(null)}
                style={styles.smallButton}
                accessibilityRole="button"
                accessibilityLabel="Clear time"
              >
                <Text style={styles.smallButtonText}>Clear</Text>
              </Pressable>
            )}
          </View>
          {showPicker && (
            <View>
              <DateTimePicker
                value={pickerValue}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickTime}
                themeVariant="light"
              />
              {Platform.OS === 'ios' && (
                <Pressable onPress={() => setShowPicker(false)} style={styles.link} accessibilityRole="button">
                  <Text style={styles.linkText}>Done</Text>
                </Pressable>
              )}
            </View>
          )}

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={MEDICATION_LIMITS.note}
            placeholder="e.g. taken after food"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            accessibilityLabel="Note, optional"
          />
          <Text style={styles.counter}>
            {note.length}/{MEDICATION_LIMITS.note}
          </Text>

          <View style={styles.formLinks}>
            <Pressable
              onPress={() => {
                setShowPicker(false);
                setMode('list');
              }}
              style={styles.link}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
            {editingId && (
              <Pressable
                onPress={() => {
                  setTargetId(editingId);
                  setShowPicker(false);
                  setMode('confirmDelete');
                }}
                style={styles.link}
                accessibilityRole="button"
                accessibilityLabel={'Delete ' + (name || 'this medication')}
              >
                <Text style={styles.linkText}>Delete medication</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}

      {/* ---------- Confirmations ---------- */}
      {(mode === 'confirmDelete' || mode === 'confirmClear') && (
        <>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {mode === 'confirmClear'
                ? 'Remove all medications recorded for this date?'
                : 'Remove ' + (target?.name ?? 'this medication') + ' from this date?'}
            </Text>
            <Text style={styles.confirmText}>Your other tracking for this day stays as it is.</Text>
          </View>
          <Pressable
            onPress={() => {
              setTargetId(null);
              setMode('list');
            }}
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        </>
      )}

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  dateBlock: { marginTop: spacing.xs, marginBottom: spacing.xs },
  dateRel: { fontSize: 13, fontWeight: '700', color: colors.magenta },
  dateText: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 2 },
  flash: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flashText: { fontSize: 13.5, fontWeight: '600', color: colors.navy },
  list: { gap: spacing.sm },
  empty: { fontSize: 14, color: colors.textSecondary, paddingVertical: spacing.sm },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  entryMain: { flex: 1, minHeight: 56, justifyContent: 'center', paddingVertical: spacing.sm, paddingLeft: spacing.lg },
  entryName: { fontSize: 16, fontWeight: '700', color: colors.navy },
  entryDetail: { fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  entryNote: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  addRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.magenta,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.pinkVerySoft,
  },
  addText: { fontSize: 15.5, fontWeight: '700', color: colors.magenta },
  form: { gap: 6, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginBottom: 4 },
  fieldLabel: { fontSize: 13.5, fontWeight: '600', color: colors.navy, marginTop: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.navy,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.magenta },
  fieldError: { fontSize: 13, fontWeight: '600', color: colors.magenta },
  row2: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.pinkVerySoft,
    borderWidth: 1,
    borderColor: colors.pinkSoft,
  },
  chipOn: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.navy },
  chipTextOn: { color: colors.white },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  timeValue: { fontSize: 15, fontWeight: '600', color: colors.navy, minWidth: 80 },
  smallButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.pinkSoft,
  },
  smallButtonText: { fontSize: 13.5, fontWeight: '700', color: colors.magenta },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: colors.textSecondary },
  formLinks: { flexDirection: 'row', justifyContent: 'space-between' },
  confirmCard: { backgroundColor: colors.pinkVerySoft, borderRadius: radius.md, padding: spacing.lg, gap: 6 },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  confirmText: { fontSize: 14, color: colors.navy, lineHeight: 20 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14.5, fontWeight: '700', color: colors.magenta },
  error: { fontSize: 13.5, fontWeight: '600', color: colors.magenta, lineHeight: 19 },
});
