// VIVA Cycle - entering PINs to set up, change or turn off App Lock (opened from Privacy & Security).
// mode=setup   : new PIN, then the same again
// mode=change  : current PIN, new PIN, new PIN again (current checked before anything changes)
// mode=disable : current PIN (a wrong PIN never turns the lock off)
// mode=biometric: current PIN, then the phone's own Face ID / fingerprint prompt, then it is on
// PINs live only in this screen's memory while typing and are cleared after every step.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PinPad from '../components/PinPad';
import { colors, spacing } from '../constants/theme';
import { PIN_LENGTH, changePin, disableLock, setupPin, verifyPin } from '../lib/appLock';
import { noteLockChanged } from '../lib/appLockSession';
import { BIOMETRIC, PIN_FLOW, biometricName, enableBiometricMessage, isBiometricMethod, verifyMessage } from '../lib/appLockText';
import { enableBiometricUnlock } from '../lib/biometricUnlock';

type Mode = 'setup' | 'change' | 'disable' | 'biometric';

export default function AppLockPinScreen() {
  const params = useLocalSearchParams<{ mode?: string; method?: string }>();
  const mode: Mode = params.mode === 'change' || params.mode === 'disable' || params.mode === 'biometric' ? params.mode : 'setup';
  const bioName = biometricName(isBiometricMethod(params.method) ? params.method : 'biometrics');
  const flow = mode === 'biometric' ? { ...PIN_FLOW.biometric, title: BIOMETRIC.turnOn(bioName) } : PIN_FLOW[mode];

  const [step, setStep] = useState(0);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const entries = useRef<string[]>([]); // earlier steps' PINs, cleared when the screen finishes
  const busy = useRef(false);

  const say = (text: string) => {
    setMessage(text);
    AccessibilityInfo.announceForAccessibility(text);
  };
  const restart = (text: string) => {
    entries.current = [];
    setStep(0);
    say(text);
  };
  const finish = (text: string, lockOn: boolean) => {
    entries.current = [];
    noteLockChanged(lockOn);
    Alert.alert(flow.title, text, [{ text: 'OK', onPress: () => router.back() }], { cancelable: false });
  };

  const complete = async (entered: string) => {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setPin('');
    try {
      if (mode === 'setup') {
        if (step === 0) {
          entries.current = [entered];
          setStep(1);
          return;
        }
        const r = await setupPin(entries.current[0], entered);
        if (r === 'saved') finish(PIN_FLOW.doneSetup, true);
        else if (r === 'mismatch') restart(PIN_FLOW.mismatch);
        else if (r === 'alreadyOn') finish(PIN_FLOW.doneSetup, true);
        else restart(PIN_FLOW.saveError);
        return;
      }
      if (mode === 'biometric') {
        // PIN first (counted like any PIN), then the phone's own prompt; only both turn it on
        const r = await enableBiometricUnlock(entered, BIOMETRIC.enablePrompt);
        if (r.ok) finish(enableBiometricMessage(r, bioName), true);
        else say(enableBiometricMessage(r, bioName)); // nothing was changed
        return;
      }
      if (mode === 'disable') {
        const r = await disableLock(entered);
        if (r.ok) finish(PIN_FLOW.doneDisable, false);
        else say(verifyMessage(r) ?? PIN_FLOW.saveError); // lock stays on
        return;
      }
      // change
      if (step === 0) {
        // Check the current PIN now, so a wrong one stops here (it counts towards the waits)
        const r = await verifyPin(entered);
        if (!r.ok) {
          say(verifyMessage(r) ?? PIN_FLOW.saveError);
          return;
        }
        entries.current = [entered];
        setStep(1);
        return;
      }
      if (step === 1) {
        entries.current = [entries.current[0], entered];
        setStep(2);
        return;
      }
      const r = await changePin(entries.current[0], entries.current[1], entered);
      if (r.ok) finish(PIN_FLOW.doneChange, true);
      else if (r.reason === 'mismatch') {
        entries.current = [entries.current[0]];
        setStep(1);
        say(PIN_FLOW.mismatch);
      } else restart(verifyMessage(r) ?? PIN_FLOW.saveError);
    } finally {
      busy.current = false;
      setWorking(false);
    }
  };

  const onChange = (next: string) => {
    setMessage(null);
    setPin(next);
    if (next.length === PIN_LENGTH) void complete(next);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => router.back()}
            hitSlop={14}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Cancel and go back. Nothing is changed."
          >
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {flow.title}
          </Text>
          <Text style={styles.stepText}>{flow.steps[step]}</Text>
          {flow.steps.length > 1 ? (
            <Text style={styles.counter}>
              Step {step + 1} of {flow.steps.length}
            </Text>
          ) : null}
          <PinPad value={pin} onChange={onChange} disabled={working} />
          <View style={styles.messageArea} accessibilityLiveRegion="assertive">
            {working ? <ActivityIndicator color={colors.magenta} /> : null}
            {!working && message ? <Text style={styles.error}>{message}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.screenH, paddingBottom: 40, gap: spacing.lg },
  back: { alignSelf: 'flex-start', width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  stepText: { fontSize: 17, color: colors.navy, textAlign: 'center' },
  counter: { fontSize: 13.5, color: colors.textSecondary },
  messageArea: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  error: { fontSize: 15, fontWeight: '600', color: colors.magentaText, textAlign: 'center' },
});
