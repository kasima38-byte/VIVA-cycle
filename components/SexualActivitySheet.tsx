// VIVA Cycle - Sexual Activity sheet (Daily Tracking)
// Private and optional. Saves only this entry (lib/sexualActivityService.ts).
// Neutral wording; feedback never repeats what was recorded.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { formatLongDate, relativeDayName } from '../lib/dailyTracking';
import {
  PROTECTION_OPTIONS, ProtectionStatus, SEXUAL_ACTIVITY_STATUS_OPTIONS, SexualActivityStatus,
  buildSexualActivity, primaryProtection,
} from '../lib/sexualActivity';
import { SexualActivityResult, saveSexualActivity } from '../lib/sexualActivityService';
import { useVivaStore } from '../lib/vivaStore';
import BottomSheet from './BottomSheet';

type Tone = 'success' | 'error' | 'info';

type Props = {
  visible: boolean;
  date: string;
  today: string;
  onClose: () => void;
  onFeedback: (text: string, tone: Tone) => void;
};

const ERRORS: Partial<Record<SexualActivityResult, string>> = {
  future: 'Entries can only be recorded for today or earlier.',
  invalid: "That entry couldn't be saved.",
  failed: "Couldn't save. Please try again.",
};

export default function SexualActivitySheet({ visible, date, today, onClose, onFeedback }: Props) {
  const { dailyLogs } = useVivaStore();
  const saved = dailyLogs[date]?.sexualActivity ?? null;

  const [status, setStatus] = useState<SexualActivityStatus | null>(saved?.status ?? null);
  const [protection, setProtection] = useState<ProtectionStatus | null>(primaryProtection(saved));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every time the sheet opens, show what is saved for the selected date
  useEffect(() => {
    if (!visible) return;
    const s = dailyLogs[date]?.sexualActivity ?? null;
    setStatus(s?.status ?? null);
    setProtection(primaryProtection(s));
    setBusy(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, date]);

  const next = buildSexualActivity(status, status === 'activity' ? protection : null, saved);
  const unchanged = JSON.stringify(next) === JSON.stringify(saved);
  const rel = relativeDayName(date, today);

  const run = async (
    s: SexualActivityStatus | null, p: ProtectionStatus | null, successText: string
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await saveSexualActivity(date, s, p);
    setBusy(false);
    if (result === 'saved') {
      onClose();
      onFeedback(successText, 'success');
    } else if (result === 'unchanged') {
      onClose();
    } else {
      setError(ERRORS[result] ?? "Couldn't save. Please try again.");
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Sexual Activity"
      onClose={onClose}
      primaryLabel={busy ? 'Saving…' : 'Save'}
      onPrimary={() =>
        void run(status, status === 'activity' ? protection : null, saved ? 'Entry updated' : 'Entry saved')
      }
      primaryDisabled={busy || unchanged || status === null}
    >
      <Text style={styles.subtitle}>Record activity for this date.</Text>
      <View
        style={styles.dateBlock}
        accessible
        accessibilityLabel={'Selected date: ' + (rel ? rel + ', ' : '') + formatLongDate(date)}
      >
        {rel && <Text style={styles.dateRel}>{rel}</Text>}
        <Text style={styles.dateText}>{formatLongDate(date)}</Text>
      </View>

      <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Activity">
        {SEXUAL_ACTIVITY_STATUS_OPTIONS.map((o) => (
          <Choice key={o.id} label={o.label} selected={status === o.id} onPress={() => setStatus(o.id)} />
        ))}
      </View>

      {status === 'activity' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Protection (optional)</Text>
          <Text style={styles.hint}>
            {protection === null ? 'Not recorded. Leave it blank if you prefer.' : 'Tap your choice again to leave it unrecorded.'}
          </Text>
          <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel="Protection, optional">
            {PROTECTION_OPTIONS.map((o) => (
              <Choice
                key={o.id}
                label={o.label}
                selected={protection === o.id}
                onPress={() => setProtection((p) => (p === o.id ? null : o.id))}
                hint={protection === o.id ? 'Selected. Tap again to leave unrecorded.' : undefined}
              />
            ))}
          </View>
        </View>
      )}

      {saved !== null && (
        <Pressable
          onPress={() => void run(null, null, 'Entry cleared')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="Clear sexual activity"
          accessibilityHint="Sets this back to not tracked"
        >
          <Text style={styles.linkText}>Clear</Text>
        </Pressable>
      )}

      {error && (
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>
      )}
    </BottomSheet>
  );
}

function Choice({
  label, selected, onPress, hint,
}: { label: string; selected: boolean; onPress: () => void; hint?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: selected, selected }}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <Ionicons name="checkmark" size={16} color={colors.white} />}
      </View>
      <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, color: colors.textSecondary },
  dateBlock: { marginTop: spacing.xs, marginBottom: spacing.xs },
  dateRel: { fontSize: 13, fontWeight: '700', color: colors.magentaText },
  dateText: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 2 },
  list: { gap: spacing.sm },
  section: { gap: spacing.xs, marginTop: spacing.xs },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  rowOn: { borderColor: colors.magenta, backgroundColor: colors.pinkVerySoft },
  pressed: { opacity: 0.85 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.toggleOff,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.navy },
  rowLabelOn: { fontWeight: '700' },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { fontSize: 14.5, fontWeight: '700', color: colors.magentaText },
  error: { fontSize: 13.5, fontWeight: '600', color: colors.magentaText, lineHeight: 19 },
});
