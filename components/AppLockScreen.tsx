// VIVA Cycle - the lock screen. Shown INSTEAD of the app (see app/_layout.tsx), so no VIVA screen
// is rendered behind it. Shows nothing about her records: only the PIN pad and generic messages.
// If she turned on Face ID / fingerprint, the phone's own prompt is offered once when this screen
// appears (and by a button). Cancelling or failing it just leaves the PIN pad, which always works.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';
import { PIN_LENGTH, getWaitMs } from '../lib/appLock';
import { forgetAppLock, initAppLock, unlockWithBiometrics, unlockWithPin, useAppLock } from '../lib/appLockSession';
import {
  APP_LOCK, BIOMETRIC, FORGOT_PIN_FINAL, FORGOT_PIN_FIRST, LOCK_SCREEN, biometricLockMessage, biometricName, verifyMessage, waitText,
} from '../lib/appLockText';
import { biometricForLockScreen, type BiometricMethod } from '../lib/biometricUnlock';
import { deleteAllUserData } from '../lib/dataDeletionService';
import { deleteAllResultMessage } from '../lib/dataDeletion';
import PinPad from './PinPad';

function ask(d: { title: string; body: string; cancel: string; confirm: string }): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(d.title, d.body, [
      { text: d.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: d.confirm, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  );
}

// The automatic Face ID / fingerprint prompt is offered once per launch (never twice at once)
let autoOffered = false;

export default function AppLockScreen() {
  const { gate } = useAppLock();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [waitMs, setWaitMs] = useState(0);
  const busy = useRef(false);
  const [bio, setBio] = useState<BiometricMethod | null>(null);

  const tryBiometric = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await unlockWithBiometrics(BIOMETRIC.prompt);
      if (r === 'unavailable' || r === 'error' || r === 'notOffered') setBio(null); // PIN only now
      const name = bio ? biometricName(bio) : 'Face ID or fingerprint';
      const msg = biometricLockMessage(r, name);
      setMessage(msg);
      if (msg) AccessibilityInfo.announceForAccessibility(msg);
    } finally {
      busy.current = false;
    }
  };

  // Offer Face ID / fingerprint once, only if she turned it on and the phone can do it now
  useEffect(() => {
    if (gate !== 'locked') return;
    let alive = true;
    biometricForLockScreen().then((m) => {
      if (!alive || !m) return;
      setBio(m);
      if (autoOffered) return;
      autoOffered = true;
      void unlockWithBiometrics(BIOMETRIC.prompt).then((r) => {
        if (!alive) return;
        if (r === 'unavailable' || r === 'error' || r === 'notOffered') setBio(null);
        setMessage(biometricLockMessage(r, biometricName(m)));
      });
    });
    return () => {
      alive = false;
    };
  }, [gate]);

  // Waits survive restarts: read the remaining wait when the screen appears, then count down
  useEffect(() => {
    let alive = true;
    getWaitMs().then((ms) => alive && setWaitMs(ms));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (waitMs <= 0) return;
    const t = setTimeout(() => setWaitMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearTimeout(t);
  }, [waitMs]);

  const submit = async (entered: string) => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const result = await unlockWithPin(entered);
      setPin(''); // the entered digits never stay on screen
      if (!result.ok) {
        const msg = verifyMessage(result);
        setMessage(msg);
        if (msg) AccessibilityInfo.announceForAccessibility(msg);
        if (result.reason === 'wrong' || result.reason === 'wait') setWaitMs(result.waitMs);
      }
    } finally {
      busy.current = false;
      setChecking(false);
    }
  };

  const onChange = (next: string) => {
    setMessage(null);
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const forgot = async () => {
    if (!(await ask(FORGOT_PIN_FIRST)) || !(await ask(FORGOT_PIN_FINAL))) return;
    setChecking(true);
    try {
      const result = await deleteAllUserData();
      if (result.dataDeleted === 'all') {
        await forgetAppLock(); // opens to Welcome: there is nothing left to protect
      } else {
        const m = deleteAllResultMessage(result);
        Alert.alert(m.title, m.body + ' VIVA Cycle stays locked.');
      }
    } catch {
      Alert.alert('Nothing was deleted', 'VIVA Cycle stays locked. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (gate === 'unknown') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={colors.magenta} />
          <Text style={styles.title}>{LOCK_SCREEN.title}</Text>
          <Text style={styles.body}>{APP_LOCK.statusUnknown}</Text>
          <Pressable onPress={() => void initAppLock()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const waiting = waitMs > 0;
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={30} color={colors.magenta} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {LOCK_SCREEN.title}
        </Text>
        <Text style={styles.body}>{checking ? LOCK_SCREEN.checking : LOCK_SCREEN.prompt}</Text>
        <PinPad value={pin} onChange={onChange} disabled={checking || waiting} />
        <View style={styles.messageArea} accessibilityLiveRegion="assertive">
          {checking ? <ActivityIndicator color={colors.magenta} /> : null}
          {!checking && message ? <Text style={styles.error}>{message}</Text> : null}
          {!checking && waiting ? <Text style={styles.wait}>Try again in {waitText(waitMs)}.</Text> : null}
        </View>
        {bio ? (
          <Pressable
            onPress={() => void tryBiometric()}
            disabled={checking}
            style={styles.bioButton}
            accessibilityRole="button"
            accessibilityLabel={BIOMETRIC.lockScreenButton(biometricName(bio))}
          >
            <Ionicons name={bio === 'faceId' || bio === 'face' ? 'scan' : 'finger-print'} size={22} color={colors.magenta} />
            <Text style={styles.bioText}>{BIOMETRIC.lockScreenButton(biometricName(bio))}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void forgot()} disabled={checking} hitSlop={10} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkText}>{LOCK_SCREEN.forgot}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.pinkSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.navy, textAlign: 'center' },
  body: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  messageArea: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4 },
  error: { fontSize: 15, fontWeight: '600', color: colors.magentaText, textAlign: 'center' },
  wait: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  bioButton: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 20,
    borderRadius: 24, borderWidth: 1.5, borderColor: colors.magenta,
  },
  bioText: { fontSize: 16, fontWeight: '700', color: colors.magentaText },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.navySoft },
  retry: { marginTop: spacing.md, backgroundColor: colors.magenta, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 32 },
  retryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
