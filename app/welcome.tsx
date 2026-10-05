// VIVA Cycle — Welcome / initial setup screen
// Visual source of truth: VIVA_Cycle_Welcome_Screen.png

import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, Modal, Platform,
  StyleSheet, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Path } from 'react-native-svg';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  CycleBaseline, Regularity, DateStr, Goal,
  validateSetup, createInitialLogs, calculateCycle,
} from '../lib/cycleEngine';
import { router } from 'expo-router';
import { completeSetup } from '../lib/vivaStore';

// ---------- Colours sampled from the reference image ----------
const C = {
  bg: '#FAEFF5',
  card: '#FDF9FB',
  cardBorder: '#F3E6EE',
  inputBg: '#FFFBFD',
  inputBorder: '#E9DDE6',
  title: '#131633',
  text: '#2A2840',
  muted: '#6E6A80',
  placeholder: '#9A95A8',
  primary: '#B63981',
  primaryDeep: '#A62876',
  petalLight: '#E58BBB',
  chipBg: '#FBF4F8',
  chipBorder: '#E6D9E2',
  chipSelBg: '#F8E4EE',
  chipSelBorder: '#D77AAE',
  leaf: '#F8C4DD',
  leafLight: '#FDD2E5',
  halo: '#FBE3EF',
  error: '#C0264F',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------- Helpers ----------
const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateStr = (s: DateStr) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const formatDate = (s: DateStr) =>
  fromDateStr(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const CYCLE_OPTIONS: (number | null)[] = [null, ...Array.from({ length: 25 }, (_, i) => 21 + i)]; // 21–45
const PERIOD_OPTIONS: (number | null)[] = [null, ...Array.from({ length: 9 }, (_, i) => 2 + i)];  // 2–10
const daysLabel = (n: number | null) => (n === null ? 'Not sure' : `${n} days`);

const REGULARITY: { value: Regularity; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'somewhat_irregular', label: 'Somewhat\nirregular' },
  { value: 'irregular', label: 'Irregular' },
  { value: 'not_sure', label: 'Not sure' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'understand', label: 'Understand\nmy cycle' },
  { value: 'track', label: 'Track\nmy cycle' },
  { value: 'conceive', label: 'Try to get\npregnant' },
  { value: 'avoid', label: 'Avoid\npregnancy' },
];

export interface WelcomeSetupData {
  name: string;
  dateOfBirth: DateStr | null;
  lastPeriodStart: DateStr;
  baseline: CycleBaseline;
  goal: Goal;
}

type DateTarget = 'dob' | 'lmp';
type SelectTarget = 'cycle' | 'period';

// ---------- Screen ----------
export default function WelcomeSetupScreen({
  onContinue,
}: {
  onContinue?: (data: WelcomeSetupData) => void;
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState<DateStr | null>(null);
  const [lmp, setLmp] = useState<DateStr | null>(null);
  const [cycleLength, setCycleLength] = useState<number | null>(28);
  const [periodLength, setPeriodLength] = useState<number | null>(5);
  const [regularity, setRegularity] = useState<Regularity>('regular');
  const [goal, setGoal] = useState<Goal | null>(null);

  const [pickerFor, setPickerFor] = useState<DateTarget | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [selectFor, setSelectFor] = useState<SelectTarget | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const today = new Date();

  const openPicker = (target: DateTarget) => {
    const current = target === 'dob' ? dob : lmp;
    if (current) setTempDate(fromDateStr(current));
    else if (target === 'dob') setTempDate(new Date(today.getFullYear() - 25, 0, 1));
    else setTempDate(today);
    setPickerFor(target);
  };

  const commitDate = (target: DateTarget, d: Date) => {
    if (target === 'dob') setDob(toDateStr(d));
    else setLmp(toDateStr(d));
    setErrors([]);
  };

  const onAndroidDateChange = (e: DateTimePickerEvent, d?: Date) => {
    const target = pickerFor;
    setPickerFor(null);
    if (e.type === 'set' && d && target) commitDate(target, d);
  };

  const chooseOption = (opt: number | null) => {
    if (selectFor === 'cycle') setCycleLength(opt);
    else setPeriodLength(opt);
    setSelectFor(null);
    setErrors([]);
  };

  const handleContinue = () => {
    const baseline: CycleBaseline = { cycleLength, periodLength, regularity };
    const problems = lmp
      ? validateSetup({ name, baseline, goal: goal ?? 'track' }, lmp)
      : [
          ...(name.trim() ? [] : ['Please enter your name.']),
          'Please select when your last period started.',
        ];
    if (!goal) problems.push('Please choose your goal.');

    if (problems.length > 0 || !lmp || !goal) {
      setErrors(problems);
      return;
    }

    const data: WelcomeSetupData = { name: name.trim(), dateOfBirth: dob, lastPeriodStart: lmp, baseline, goal };

    if (onContinue) {
      onContinue(data);
      return;
    }

    // Save her answers first: LMP becomes her first confirmed period.
    completeSetup(data);

    // Show the engine's estimates, then go to Home.
    const est = calculateCycle(baseline, createInitialLogs(lmp));
    const goHome = () => {
      router.replace('/');
    };
    if (est) {
      Alert.alert(
        `Hi ${data.name}`,
        `Cycle day ${est.currentCycleDay}\n` +
          `Estimated next period: ${formatDate(est.estimatedPeriodWindow.start)} – ${formatDate(est.estimatedPeriodWindow.end)}\n` +
          `Estimated ovulation: ${formatDate(est.estimatedOvulation)}\n` +
          `Estimated fertile window: ${formatDate(est.estimatedFertileWindow.start)} – ${formatDate(est.estimatedFertileWindow.end)}`,
        [{ text: 'OK', onPress: goHome }]
      );
    } else {
      goHome();
    }
  };

  const minDate = pickerFor === 'dob' ? new Date(1940, 0, 1) : undefined;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={s.hero}>
            <HeroArt />
            <Logo />
            <Text style={s.title}>Welcome to{'\n'}VIVA Cycle</Text>
            <Text style={s.subtitle}>Let’s set up your cycle so we can personalize your calendar.</Text>
          </View>

          {/* Your information */}
          <SectionCard icon="person" title="Your information" subtitle="We’ll use this to personalize your experience.">
            <Text style={s.label}>Name</Text>
            <View style={s.input}>
              <Ionicons name="person-outline" size={22} color={C.title} />
              <TextInput
                style={s.textInput}
                value={name}
                onChangeText={t => { setName(t); setErrors([]); }}
                placeholder="Enter your name"
                placeholderTextColor={C.placeholder}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            <Text style={s.label}>Date of birth</Text>
            <DateField value={dob} placeholder="Select your date of birth" onPress={() => openPicker('dob')} />
          </SectionCard>

          {/* Your cycle */}
          <SectionCard icon="water" title="Your cycle" subtitle="This helps us set up your calendar.">
            <Text style={s.label}>When did your last period start?</Text>
            <DateField value={lmp} placeholder="Select date" onPress={() => openPicker('lmp')} />

            <Text style={s.label}>Usual cycle length</Text>
            <SelectField icon="sync-outline" value={daysLabel(cycleLength)} onPress={() => setSelectFor('cycle')} />

            <Text style={s.label}>Usual period duration</Text>
            <SelectField icon="water" value={daysLabel(periodLength)} onPress={() => setSelectFor('period')} />

            <Text style={s.label}>How regular are your cycles?</Text>
            <View style={s.chips}>
              {REGULARITY.map(r => {
                const selected = r.value === regularity;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => setRegularity(r.value)}
                    style={[s.chip, selected && s.chipSel]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.chipText, selected && s.chipTextSel]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.label}>What is your main goal?</Text>
            <View style={s.goalChips}>
              {GOALS.map(g => {
                const selected = g.value === goal;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => { setGoal(g.value); setErrors([]); }}
                    style={[s.chip, s.goalChip, selected && s.chipSel]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[s.chipText, selected && s.chipTextSel]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {errors.length > 0 && (
            <View style={s.errorBox}>
              {errors.map(e => <Text key={e} style={s.errorText}>{e}</Text>)}
            </View>
          )}
          <Pressable onPress={handleContinue} style={({ pressed }) => [s.button, pressed && s.buttonPressed]}>
            <Text style={s.buttonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Android: native date dialog */}
      {Platform.OS === 'android' && pickerFor && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          maximumDate={today}
          minimumDate={minDate}
          onChange={onAndroidDateChange}
        />
      )}

      {/* iOS: calendar in a bottom sheet */}
      {Platform.OS === 'ios' && (
        <BottomSheet
          visible={pickerFor !== null}
          title={pickerFor === 'dob' ? 'Date of birth' : 'Last period start'}
          onClose={() => setPickerFor(null)}
          onDone={() => {
            if (pickerFor) commitDate(pickerFor, tempDate);
            setPickerFor(null);
          }}
        >
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={pickerFor === 'dob' ? 'spinner' : 'inline'}
            themeVariant="light"
            accentColor={C.primary}
            maximumDate={today}
            minimumDate={minDate}
            onChange={(_, d) => d && setTempDate(d)}
          />
        </BottomSheet>
      )}

      {/* Cycle length / period duration options */}
      <BottomSheet
        visible={selectFor !== null}
        title={selectFor === 'cycle' ? 'Usual cycle length' : 'Usual period duration'}
        onClose={() => setSelectFor(null)}
      >
        <ScrollView style={s.optionList}>
          {(selectFor === 'cycle' ? CYCLE_OPTIONS : PERIOD_OPTIONS).map(opt => {
            const current = selectFor === 'cycle' ? cycleLength : periodLength;
            const selected = opt === current;
            return (
              <Pressable key={String(opt)} style={s.option} onPress={() => chooseOption(opt)}>
                <Text style={[s.optionText, selected && s.optionTextSel]}>{daysLabel(opt)}</Text>
                {selected && <Ionicons name="checkmark" size={22} color={C.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ---------- Pieces ----------

function Logo() {
  return (
    <View style={s.logoRow}>
      <Svg width={46} height={54} viewBox="0 0 48 56">
        <Path d="M22 54 C 6 46, 0 30, 6 14 C 16 22, 24 36, 22 54 Z" fill={C.primary} />
        <Path d="M24 54 C 22 34, 30 16, 44 4 C 50 22, 42 44, 24 54 Z" fill={C.petalLight} />
      </Svg>
      <View style={s.logoTextWrap}>
        <Text style={s.logoViva}>VIVA</Text>
        <Text style={s.logoCycle}>CYCLE</Text>
      </View>
    </View>
  );
}

function Leaf({ x, y, rotate, scale = 1, fill }: { x: number; y: number; rotate: number; scale?: number; fill: string }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <Path d="M0 0 C 26 -30 26 -80 0 -110 C -26 -80 -26 -30 0 0 Z" fill={fill} />
      <Path d="M0 -6 L0 -100" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={2} />
    </G>
  );
}

function HeroArt() {
  return (
    <View style={s.heroArt} pointerEvents="none">
      <Svg width={240} height={300} viewBox="0 0 240 300">
        <Circle cx={175} cy={140} r={120} fill={C.halo} />
        <Leaf x={120} y={130} rotate={-12} scale={0.75} fill={C.leaf} />
        <Leaf x={95} y={230} rotate={-38} scale={1} fill={C.leaf} />
        <Leaf x={135} y={300} rotate={-70} scale={0.9} fill={C.leafLight} />
      </Svg>
      {/*
        Woman illustration: save it as assets/images/welcome-woman.png,
        add `Image` to the react-native import above, then uncomment:
        <Image source={require('../assets/images/welcome-woman.png')} style={s.heroImage} resizeMode="contain" />
      */}
    </View>
  );
}

function SectionCard({
  icon, title, subtitle, children,
}: { icon: IconName; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.iconCircle}>
          <Ionicons name={icon} size={26} color="#FFFFFF" />
        </View>
        <View style={s.flex}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function DateField({ value, placeholder, onPress }: { value: DateStr | null; placeholder: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.input} accessibilityRole="button">
      <Ionicons name="calendar-outline" size={22} color={C.title} />
      <Text style={[s.inputText, !value && s.placeholderText]}>{value ? formatDate(value) : placeholder}</Text>
      <Ionicons name="calendar-outline" size={22} color={C.title} />
    </Pressable>
  );
}

function SelectField({ icon, value, onPress }: { icon: IconName; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.input} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={C.text} />
      <Text style={s.inputText}>{value}</Text>
      <Ionicons name="chevron-down" size={22} color={C.title} />
    </Pressable>
  );
}

function BottomSheet({
  visible, title, onClose, onDone, children,
}: { visible: boolean; title: string; onClose: () => void; onDone?: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onDone ?? onClose} hitSlop={12}>
              <Text style={s.sheetAction}>{onDone ? 'Done' : 'Close'}</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ---------- Styles ----------

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: 16 },

  hero: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 },
  heroArt: { position: 'absolute', top: 0, right: -30, width: 240, height: 300 },
  heroImage: { position: 'absolute', right: 0, top: 30, width: 180, height: 260 },

  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoTextWrap: { marginLeft: 8 },
  logoViva: { fontSize: 30, fontWeight: '800', color: C.primary, letterSpacing: 1, lineHeight: 32 },
  logoCycle: { fontSize: 11, fontWeight: '600', color: C.primary, letterSpacing: 7, marginLeft: 2 },

  title: {
    fontSize: 34, fontWeight: '800', lineHeight: 40, color: C.title,
    letterSpacing: -0.5, marginTop: 18, maxWidth: '68%',
  },
  subtitle: { fontSize: 16, lineHeight: 23, color: C.muted, marginTop: 10, maxWidth: '72%' },

  card: {
    marginHorizontal: 16, marginBottom: 14, padding: 20, borderRadius: 26,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.primary, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 21, fontWeight: '700', color: C.title },
  cardSubtitle: { fontSize: 14.5, color: C.muted, marginTop: 2 },

  label: { fontSize: 16, fontWeight: '500', color: C.text, marginTop: 18, marginBottom: 8 },
  input: {
    height: 56, borderRadius: 14, borderWidth: 1, borderColor: C.inputBorder, backgroundColor: C.inputBg,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14,
  },
  textInput: { flex: 1, fontSize: 17, color: C.text, paddingVertical: 0 },
  inputText: { flex: 1, fontSize: 17, color: C.text },
  placeholderText: { color: C.placeholder },

  chips: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1, height: 58, borderRadius: 18, borderWidth: 1, borderColor: C.chipBorder,
    backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  chipSel: { backgroundColor: C.chipSelBg, borderColor: C.chipSelBorder, borderWidth: 1.5 },
  chipText: { fontSize: 14, lineHeight: 18, color: C.text, textAlign: 'center' },
  chipTextSel: { color: C.primaryDeep, fontWeight: '600' },
  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalChip: { flexGrow: 1, flexBasis: '45%' },

  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: C.bg },
  errorBox: { marginBottom: 10, paddingHorizontal: 8 },
  errorText: { color: C.error, fontSize: 14, lineHeight: 20 },
  button: {
    height: 64, borderRadius: 32, backgroundColor: C.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 21, fontWeight: '600' },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(19,22,51,0.35)' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: C.title },
  sheetAction: { fontSize: 17, fontWeight: '600', color: C.primary },

  optionList: { maxHeight: 360 },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3ECF1',
  },
  optionText: { fontSize: 17, color: C.text },
  optionTextSel: { color: C.primary, fontWeight: '600' },
});