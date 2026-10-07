// VIVA Cycle - Daily Tracking input sheet
// One bottom sheet for the card she tapped. Every tap updates the draft immediately.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import {
  DailyTrackingRecord, FLOW_OPTIONS, MEDICATION_OPTIONS, MUCUS_OPTIONS, Option, PERIOD_OPTIONS,
  SEXUAL_ACTIVITY_OPTIONS, SYMPTOM_OPTIONS, TrackedField,
} from '../lib/dailyTracking';
import BottomSheet from './BottomSheet';

export type SheetField = Exclude<TrackedField, 'mood' | 'energy'>;

type SetField = <F extends TrackedField>(field: F, value: DailyTrackingRecord[F]) => void;

const SHEETS: Record<SheetField, { title: string; question: string }> = {
  period: { title: 'Period', question: 'Did you have your period on this day?' },
  flow: { title: 'Flow / Spotting', question: 'Any bleeding or spotting?' },
  symptoms: { title: 'Symptoms', question: 'Select everything you noticed.' },
  cervicalMucus: { title: 'Cervical Mucus', question: 'What did your cervical mucus look like?' },
  sexualActivity: { title: 'Sexual Activity', question: 'Did you have sex on this day?' },
  medications: { title: 'Medications', question: 'Select anything you took.' },
};

type Props = {
  field: SheetField | null;   // null = closed
  record: DailyTrackingRecord;
  dateLabel: string;          // e.g. "Wednesday, October 7"
  onChange: SetField;
  onClose: () => void;
};

export default function DailyTrackingSheet({ field, record, dateLabel, onChange, onClose }: Props) {
  const info = field ? SHEETS[field] : null;

  return (
    <BottomSheet visible={field !== null} title={info?.title ?? ''} onClose={onClose}>
      {field && info && (
        <>
          <Text style={styles.question}>{info.question}</Text>
          <Text style={styles.date} accessibilityLabel={'Editing ' + dateLabel}>
            For {dateLabel}
          </Text>

          <View style={styles.options}>{renderOptions(field, record, onChange)}</View>

          {record[field] !== null && (
            <Pressable
              onPress={() => onChange(field, null)}
              style={styles.clear}
              accessibilityRole="button"
              accessibilityLabel={'Clear ' + info.title.toLowerCase() + ' answer'}
              accessibilityHint="Sets it back to not tracked"
            >
              <Text style={styles.clearText}>Clear answer</Text>
            </Pressable>
          )}

          {field === 'period' && (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                This marks this day only. To record the start of a new period, use Log period.
              </Text>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/period-log');
                }}
                style={styles.noteLink}
                accessibilityRole="link"
                accessibilityLabel="Open Log period"
              >
                <Text style={styles.noteLinkText}>Log period</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.magenta} />
              </Pressable>
            </View>
          )}
        </>
      )}
    </BottomSheet>
  );
}

function renderOptions(field: SheetField, record: DailyTrackingRecord, onChange: SetField) {
  switch (field) {
    case 'period':
      return <SingleChoice options={PERIOD_OPTIONS} value={record.period} onSelect={(v) => onChange('period', v)} />;
    case 'flow':
      return <SingleChoice options={FLOW_OPTIONS} value={record.flow} onSelect={(v) => onChange('flow', v)} />;
    case 'cervicalMucus':
      return <SingleChoice options={MUCUS_OPTIONS} value={record.cervicalMucus} onSelect={(v) => onChange('cervicalMucus', v)} />;
    case 'sexualActivity':
      return null; // has its own private sheet: components/SexualActivitySheet.tsx
    case 'symptoms':
      return (
        <MultiChoice
          options={SYMPTOM_OPTIONS}
          value={record.symptoms}
          noneLabel="No symptoms"
          onChange={(v) => onChange('symptoms', v)}
        />
      );
    case 'medications':
      return null; // has its own sheet: components/MedicationsSheet.tsx
  }
}

function SingleChoice<T extends string>({
  options, value, onSelect,
}: { options: Option<T>[]; value: T | null; onSelect: (v: T) => void }) {
  return (
    <>
      {options.map((o) => (
        <Chip key={o.value} label={o.label} role="radio" selected={o.value === value} onPress={() => onSelect(o.value)} />
      ))}
    </>
  );
}

function MultiChoice({
  options, value, noneLabel, onChange,
}: { options: Option<string>[]; value: string[] | null; noneLabel: string; onChange: (v: string[] | null) => void }) {
  const list = value ?? [];
  const noneChosen = value !== null && value.length === 0;

  // Un-ticking the last item returns to "not tracked" - never silently to "none"
  const toggle = (key: string) => {
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange(next.length > 0 ? next : null);
  };

  return (
    <>
      <Chip label={noneLabel} role="checkbox" selected={noneChosen} onPress={() => onChange(noneChosen ? null : [])} />
      {options.map((o) => (
        <Chip key={o.value} label={o.label} role="checkbox" selected={list.includes(o.value)} onPress={() => toggle(o.value)} />
      ))}
    </>
  );
}

function Chip({
  label, selected, onPress, role,
}: { label: string; selected: boolean; onPress: () => void; role: 'radio' | 'checkbox' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
    >
      {selected && <Ionicons name="checkmark" size={16} color={colors.white} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  question: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.magenta,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.pinkVerySoft,
    borderWidth: 1,
    borderColor: colors.pinkSoft,
  },
  chipSelected: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.navy,
  },
  chipTextSelected: {
    color: colors.white,
  },
  clear: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 14,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  note: {
    backgroundColor: colors.lavender,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  noteText: {
    fontSize: 13,
    color: colors.navy,
    lineHeight: 18,
  },
  noteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
  },
  noteLinkText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.magenta,
  },
});
