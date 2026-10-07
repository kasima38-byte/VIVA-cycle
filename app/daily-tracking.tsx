// VIVA Cycle - Daily Tracking screen
// UI only. Data logic: lib/useDailyTracking.ts (state) -> lib/dailyTrackingService.ts -> lib/vivaStore.ts

import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DailyHeroCard from '../components/DailyHeroCard';
import DailyTrackingSheet, { SheetField } from '../components/DailyTrackingSheet';
import PeriodSheet, { recordedText } from '../components/PeriodSheet';
import { isFieldVisible, trackingProgress } from '../lib/dailyTrackingSettings';
import { useTrackingSettings } from '../lib/dailyTrackingSettingsService';
import FlowSheet from '../components/FlowSheet';
import SymptomsSheet from '../components/SymptomsSheet';
import MucusSheet from '../components/MucusSheet';
import SexualActivitySheet from '../components/SexualActivitySheet';
import MedicationsSheet from '../components/MedicationsSheet';
import DateSelector, { DateItem } from '../components/DateSelector';
import EnergySlider from '../components/EnergySlider';
import MoodSelector from '../components/MoodSelector';
import TrackingCard from '../components/TrackingCard';
import { addDays, dateToKey, keyToLocalDate } from '../constants/dateUtils';
import { colors, radius, spacing } from '../constants/theme';
import {
  TRACKED_FIELDS, TrackedField, fieldFullText, fieldSummary, formatLongDate, formatMonthDay,
  isTracked, relativeDayName, saveButtonLabel, trackedCount,
} from '../lib/dailyTracking';
import { SaveResult } from '../lib/dailyTrackingService';
import { useDailyTracking } from '../lib/useDailyTracking';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ToastTone = 'success' | 'error' | 'info';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CARDS: { field: TrackedField; icon: IconName; title: string }[] = [
  { field: 'period', icon: 'water', title: 'Period' },
  { field: 'flow', icon: 'water-outline', title: 'Flow / Spotting' },
  { field: 'symptoms', icon: 'flash', title: 'Symptoms' },
  { field: 'mood', icon: 'happy', title: 'Mood' },
  { field: 'energy', icon: 'battery-half', title: 'Energy' },
  { field: 'cervicalMucus', icon: 'ellipse-outline', title: 'Cervical Mucus' },
  { field: 'sexualActivity', icon: 'heart', title: 'Sexual Activity' },
  { field: 'medications', icon: 'medical', title: 'Medications' },
];

/** "today", "yesterday", "tomorrow" or "June 8" - for messages */
function dayPhrase(date: string, today: string): string {
  const rel = relativeDayName(date, today);
  return rel ? rel.toLowerCase() : formatMonthDay(date);
}

function savedText(savedAt: string | null, today: string): string {
  if (!savedAt) return 'Saved';
  const d = new Date(savedAt);
  if (isNaN(d.getTime())) return 'Saved';
  const key = dateToKey(d);
  if (key !== today) return 'Saved on ' + formatMonthDay(key);
  return 'Saved at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function resultMessage(result: SaveResult, phrase: string): { text: string; tone: ToastTone } | null {
  switch (result) {
    case 'saved':
      return { text: 'Saved for ' + phrase, tone: 'success' };
    case 'unchanged':
      return { text: 'No new changes to save', tone: 'info' };
    case 'future':
      return { text: "Future dates can't be tracked yet", tone: 'info' };
    case 'failed':
      return { text: "Couldn't save " + phrase + '. Your changes are still here. Please try again.', tone: 'error' };
    default:
      return null;
  }
}

/** Short, non-blocking confirmation above the Save button. */
function useToast() {
  const [toast, setToast] = useState<{ text: string; tone: ToastTone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string, tone: ToastTone) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ text, tone });
      AccessibilityInfo.announceForAccessibility(text);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
          if (finished) setToast(null);
        });
      }, tone === 'error' ? 4000 : 2200);
    },
    [opacity]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { toast, opacity, show };
}

export default function DailyTrackingScreen() {
  const {
    today, selectedDate, relation, canEdit, visibleDates, loggedDates, record, savedAt,
    state, periodInfo, saveStatus, justSaved, dirty, saving, setField, save, flush, selectDate,
  } = useDailyTracking();
  const insets = useSafeAreaInsets();
  // Settings decide what is SHOWN - recorded data is never changed by them
  const { settings: trackingSettings } = useTrackingSettings();
  const showMood = isFieldVisible(trackingSettings, 'mood');
  const showEnergy = isFieldVisible(trackingSettings, 'energy');
  const navigation = useNavigation();
  const { toast, opacity, show } = useToast();

  // The first thing recorded for a date gets one quiet confirmation (not every change)
  const hasRecord = loggedDates.has(selectedDate);
  const recordSeen = useRef({ date: selectedDate, has: hasRecord });
  useEffect(() => {
    const prev = recordSeen.current;
    recordSeen.current = { date: selectedDate, has: hasRecord };
    if (prev.date === selectedDate && !prev.has && hasRecord) show('Tracking saved', 'success');
  }, [selectedDate, hasRecord, show]);

  const [sheet, setSheet] = useState<SheetField | null>(null);
  type NavAction = Parameters<typeof navigation.dispatch>[0];
  // A save failed while switching dates or leaving: offer Retry instead of moving silently
  const [blocked, setBlocked] = useState<
    { kind: 'date'; target: string } | { kind: 'leave'; action: NavAction } | null
  >(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [symptomsOpen, setSymptomsOpen] = useState(false);
  const [mucusOpen, setMucusOpen] = useState(false);
  const [sexOpen, setSexOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const stickyHeight = useRef(0);
  const sectionY = useRef({ mood: 0, energy: 0 });

  const dateName = relativeDayName(selectedDate, today);
  const longDate = formatLongDate(selectedDate);

  const report = useCallback(
    (result: SaveResult | null, date: string) => {
      if (!result) return;
      const msg = resultMessage(result, dayPhrase(date, today));
      if (msg) show(msg.text, msg.tone);
    },
    [show, today]
  );

  // Switching dates: pending changes are saved first. If that fails she stays here, with Retry.
  const handleSelect = useCallback(
    async (date: string) => {
      const result = await selectDate(date);
      setBlocked(result === 'failed' ? { kind: 'date', target: date } : null);
    },
    [selectDate]
  );

  const handleSave = async () => {
    const result = await save();
    report(result, selectedDate);
  };

  // Leaving the screen (back button, swipe, Android back): keep her changes
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const leavingRef = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (leavingRef.current || !dirtyRef.current) return;
        e.preventDefault();
        flush().then((result) => {
          if (result === 'failed') {
            setBlocked({ kind: 'leave', action: e.data.action });
            return;
          }
          leavingRef.current = true;
          navigation.dispatch(e.data.action);
        });
      }),
    [navigation, flush]
  );

  const retryBlocked = async () => {
    const b = blocked;
    if (!b) return;
    const result = await save();
    if (result === 'failed') return; // banner stays; nothing is lost
    setBlocked(null);
    if (b.kind === 'date') {
      await handleSelect(b.target);
    } else {
      leavingRef.current = true;
      navigation.dispatch(b.action);
    }
  };

  // "Stay on this date" keeps her input here; "Leave without saving" is her explicit choice
  const dismissBlocked = () => {
    const b = blocked;
    setBlocked(null);
    if (b?.kind === 'leave') {
      leavingRef.current = true;
      navigation.dispatch(b.action);
    }
  };

  const openField = (field: TrackedField) => {
    if (field === 'mood' || field === 'energy') {
      const y = sectionY.current[field] - stickyHeight.current - spacing.md;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
      return;
    }
    if (field === 'period') {
      setPeriodOpen(true);
      return;
    }
    if (field === 'flow') {
      setFlowOpen(true);
      return;
    }
    if (field === 'symptoms') {
      setSymptomsOpen(true);
      return;
    }
    if (field === 'cervicalMucus') {
      setMucusOpen(true);
      return;
    }
    if (field === 'sexualActivity') {
      setSexOpen(true);
      return;
    }
    if (field === 'medications') {
      setMedsOpen(true);
      return;
    }
    setSheet(field);
  };

  // Period card: day number within the bleeding episode (not the cycle day)
  const periodText =
    periodInfo.status === 'period'
      ? periodInfo.dayNumber
        ? 'Day ' + periodInfo.dayNumber
        : 'Period day'
      : periodInfo.status === 'notPeriod'
        ? 'No period'
        : 'Not tracked';
  const periodFull =
    periodInfo.status === 'period' && periodInfo.episode
      ? 'Period day ' + periodInfo.dayNumber + ', ' + recordedText(periodInfo.episode.recordedDays)
      : periodText;
  const cardStatus = (f: TrackedField) => (f === 'period' ? periodText : fieldSummary(record, f));
  const cardFullStatus = (f: TrackedField) => (f === 'period' ? periodFull : fieldFullText(record, f));

  const dateItems: DateItem[] = visibleDates.map((key) => {
    const d = keyToLocalDate(key);
    const rel = relativeDayName(key, today);
    return {
      key,
      weekday: WEEKDAY_NAMES[d.getDay()],
      day: d.getDate(),
      hasDot: loggedDates.has(key),
      isToday: key === today,
      isFuture: key > today,
      label: (rel ? rel + ', ' : '') + formatLongDate(key),
    };
  });

  // Hero card text reflects the day and how much is tracked
  // Progress counts only the categories that are switched on (each once)
  const progress = trackingProgress(record, trackingSettings);
  const count = progress.count;
  const heroTitle =
    relation === 'future'
      ? 'Not here yet'
      : relation === 'today'
        ? 'Track your day'
        : 'Track ' + (dateName === 'Yesterday' ? 'yesterday' : formatMonthDay(selectedDate));
  const heroSubtitle =
    relation === 'future'
      ? 'You can track this day when it arrives.'
      : progress.state === 'complete'
        ? progress.total === 1
          ? 'Tracked for this day.'
          : 'All ' + progress.total + ' categories tracked.'
        : progress.state === 'partial'
          ? count + ' of ' + progress.total + ' categories tracked'
          : relation === 'today'
            ? 'How are you feeling today?'
            : 'How were you feeling that day?';

  // Save status line - she never has to wonder
  let status: { icon: IconName; text: string; color: string; iconColor: string };
  if (!canEdit) {
    status = { icon: 'time-outline', text: "Future dates can't be tracked yet", color: colors.textSecondary, iconColor: colors.textSecondary };
  } else if (saveStatus === 'error') {
    status = { icon: 'alert-circle', text: "Couldn't save your changes.", color: colors.magenta, iconColor: colors.magenta };
  } else if (saving) {
    status = { icon: 'sync-outline', text: 'Saving…', color: colors.textSecondary, iconColor: colors.textSecondary };
  } else if (saveStatus === 'unsaved') {
    status = { icon: 'ellipse', text: 'Unsaved changes', color: colors.magenta, iconColor: colors.magenta };
  } else if (saveStatus === 'saved') {
    status = { icon: 'checkmark-circle', text: savedText(savedAt, today), color: colors.navy, iconColor: colors.green };
  } else {
    status = { icon: 'ellipse-outline', text: 'Nothing saved for this day yet', color: colors.textSecondary, iconColor: colors.textSecondary };
  }

  const buttonLabel = saveButtonLabel(selectedDate, today);
  const buttonDisabled = !canEdit || saving || (!dirty && saveStatus !== 'error');
  const buttonText =
    saveStatus === 'error' ? 'Try Again' : saving ? 'Saving…' : justSaved && !dirty ? 'Saved' : buttonLabel;
  const showCheck = canEdit && !dirty && saveStatus === 'saved';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
        >
          {/* 0 - Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                style={[styles.iconButton, styles.backButton]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={26} color={colors.navy} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/daily-tracking-settings')}
                hitSlop={8}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Daily Tracking settings"
              >
                <Ionicons name="settings-outline" size={24} color={colors.navy} />
              </Pressable>
            </View>

            <Text style={styles.title} accessibilityRole="header">
              Daily Tracking
            </Text>
            <Text style={styles.subtitle}>Small details. A healthier, happier you.</Text>
          </View>

          {/* 1 - Date bar (stays at the top while scrolling) */}
          <View
            style={styles.stickyDate}
            onLayout={(e) => {
              stickyHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <DateSelector
              dates={dateItems}
              selectedKey={selectedDate}
              onSelect={handleSelect}
              onPrev={() => handleSelect(addDays(selectedDate, -1))}
              onNext={() => handleSelect(addDays(selectedDate, 1))}
            />
            <View style={styles.dateLine}>
              <Text
                style={styles.dateText}
                accessibilityLabel={'Selected date: ' + (dateName ? dateName + ', ' : '') + longDate}
              >
                {dateName ? <Text style={styles.dateName}>{dateName} · </Text> : null}
                {longDate}
              </Text>
              {relation !== 'today' && (
                <Pressable
                  onPress={() => handleSelect(today)}
                  style={styles.todayLink}
                  accessibilityRole="button"
                  accessibilityLabel="Go to today"
                >
                  <Text style={styles.todayLinkText}>Go to today</Text>
                </Pressable>
              )}
            </View>
          </View>

          {relation === 'future' && (
            <View style={styles.notice}>
              <Ionicons name="time-outline" size={18} color={colors.purpleIcon} />
              <Text style={styles.noticeText}>
                This day hasn't happened yet. You can track it when it arrives.
              </Text>
            </View>
          )}

          <DailyHeroCard title={heroTitle} subtitle={heroSubtitle} />

          <View style={styles.grid}>
            {CARDS.filter((c) => isFieldVisible(trackingSettings, c.field)).map((c) => (
              <View key={c.field} style={styles.gridItem}>
                <TrackingCard
                  icon={c.icon}
                  title={c.title}
                  status={cardStatus(c.field)}
                  fullStatus={cardFullStatus(c.field)}
                  tracked={isTracked(record, c.field)}
                  disabled={!canEdit}
                  onPress={() => openField(c.field)}
                />
              </View>
            ))}
          </View>

          {showMood && (
          <View
            style={styles.moodCard}
            onLayout={(e) => {
              sectionY.current.mood = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.cardTitle} accessibilityRole="header">
              {relation === 'today' ? 'Mood Today' : 'Mood'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {relation === 'today' ? 'How are you feeling overall?' : 'How were you feeling overall?'}
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <MoodSelector
                value={record.mood}
                onChange={(m) => setField('mood', m)}
                disabled={!canEdit}
                dayLabel={relation === 'today' ? "today's" : "this day's"}
              />
            </View>
            {record.mood !== null && canEdit && (
              <Pressable
                onPress={() => setField('mood', null)}
                style={styles.clearLink}
                accessibilityRole="button"
                accessibilityLabel="Clear mood"
                accessibilityHint="Sets mood back to not tracked"
              >
                <Text style={styles.clearLinkText}>Clear mood</Text>
              </Pressable>
            )}
          </View>

          )}

          {showEnergy && (
          <View
            style={styles.moodCard}
            onLayout={(e) => {
              sectionY.current.energy = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.cardTitle} accessibilityRole="header">
              Energy Level
            </Text>
            <Text style={styles.cardSubtitle}>How would you rate your energy?</Text>
            <View style={{ marginTop: spacing.md }}>
              <EnergySlider value={record.energy} onChange={(v) => setField('energy', v)} disabled={!canEdit} />
            </View>
            {record.energy !== null && canEdit && (
              <Pressable
                onPress={() => setField('energy', null)}
                style={styles.clearLink}
                accessibilityRole="button"
                accessibilityLabel="Clear energy"
                accessibilityHint="Sets energy back to not tracked"
              >
                <Text style={styles.clearLinkText}>Clear energy</Text>
              </Pressable>
            )}
          </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Footer - Save is always reachable */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {toast && (
          <Animated.View
            pointerEvents="none"
            style={[styles.toast, { opacity }]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name={toast.tone === 'success' ? 'checkmark-circle' : toast.tone === 'error' ? 'alert-circle' : 'information-circle'}
              size={18}
              color={toast.tone === 'success' ? '#7CE0B0' : colors.white}
            />
            <Text style={styles.toastText}>{toast.text}</Text>
          </Animated.View>
        )}

        {blocked && (
          <View style={styles.banner} accessibilityLiveRegion="assertive">
            <Text style={styles.bannerText}>Your changes couldn't be saved.</Text>
            <View style={styles.bannerActions}>
              <Pressable
                onPress={() => void retryBlocked()}
                style={styles.bannerButton}
                accessibilityRole="button"
                accessibilityLabel="Retry saving"
              >
                <Text style={styles.bannerButtonText}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={dismissBlocked}
                style={styles.bannerLink}
                accessibilityRole="button"
                accessibilityLabel={blocked.kind === 'date' ? 'Stay on this date' : 'Leave without saving'}
              >
                <Text style={styles.bannerLinkText}>
                  {blocked.kind === 'date' ? 'Stay on this date' : 'Leave without saving'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.statusRow} accessibilityLabel={status.text}>
          <Ionicons name={status.icon} size={status.icon === 'ellipse' ? 9 : 15} color={status.iconColor} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={buttonDisabled}
          style={({ pressed }) => [
            styles.saveButton,
            buttonDisabled && styles.saveButtonDisabled,
            pressed && !buttonDisabled && styles.saveButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          accessibilityHint={buttonDisabled && canEdit && !saving ? 'No new changes to save' : undefined}
          accessibilityState={{ disabled: buttonDisabled, busy: saving }}
        >
          {showCheck && (
            <Ionicons name="checkmark-circle" size={20} color={colors.magenta} />
          )}
          <Text style={[styles.saveButtonText, buttonDisabled && styles.saveButtonTextDisabled]}>
            {buttonText}
          </Text>
        </Pressable>
      </View>

      <MedicationsSheet
        visible={medsOpen}
        date={selectedDate}
        today={today}
        onClose={() => setMedsOpen(false)}
        onFeedback={show}
      />

      <SexualActivitySheet
        visible={sexOpen}
        date={selectedDate}
        today={today}
        onClose={() => setSexOpen(false)}
        onFeedback={show}
      />

      <MucusSheet
        visible={mucusOpen}
        date={selectedDate}
        today={today}
        onClose={() => setMucusOpen(false)}
        onFeedback={show}
      />

      <SymptomsSheet
        visible={symptomsOpen}
        date={selectedDate}
        today={today}
        onClose={() => setSymptomsOpen(false)}
        onFeedback={show}
      />

      <FlowSheet
        visible={flowOpen}
        date={selectedDate}
        today={today}
        onClose={() => setFlowOpen(false)}
        onFeedback={show}
      />

      <PeriodSheet
        visible={periodOpen}
        date={selectedDate}
        today={today}
        onClose={() => setPeriodOpen(false)}
        onFeedback={show}
      />

      <DailyTrackingSheet
        field={sheet}
        record={record}
        dateLabel={longDate}
        onChange={setField}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  header: { gap: 6 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    marginLeft: -10,
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
  stickyDate: {
    backgroundColor: colors.screen,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    gap: spacing.sm,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.navy,
  },
  dateName: {
    color: colors.magenta,
    fontWeight: '700',
  },
  todayLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  todayLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.magenta,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lavender,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  noticeText: {
    flex: 1,
    fontSize: 13.5,
    color: colors.navy,
    lineHeight: 19,
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
  banner: {
    backgroundColor: colors.pinkVerySoft,
    borderWidth: 1,
    borderColor: colors.magenta,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerText: { fontSize: 14.5, fontWeight: '700', color: colors.navy },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bannerButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.magenta,
  },
  bannerButtonText: { fontSize: 14.5, fontWeight: '700', color: colors.white },
  bannerLink: { minHeight: 44, justifyContent: 'center' },
  bannerLinkText: { fontSize: 14, fontWeight: '700', color: colors.magenta },
  clearLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  clearLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.magenta,
  },
  footer: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.sm,
    backgroundColor: colors.screen,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.magenta,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.pinkSoft,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 17,
  },
  saveButtonTextDisabled: {
    color: colors.magenta,
  },
  toast: {
    position: 'absolute',
    left: spacing.screenH,
    right: spacing.screenH,
    bottom: '100%',
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  toastText: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
