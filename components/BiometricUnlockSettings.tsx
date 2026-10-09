// VIVA Cycle - Face ID / fingerprint settings, shown under App Lock on Privacy & Security
// (only while App Lock is on). Opening it only ASKS the phone what it supports (no prompt, no
// records) and reads her on/off choice; nothing is changed except by her pressing a row.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { BIOMETRIC, biometricName, biometricStatusText } from '../lib/appLockText';
import { disableBiometricUnlock, getBiometricStatus, isBiometricUnlockOn, type BiometricStatus } from '../lib/biometricUnlock';
import SettingsRow from './SettingsRow';

/** Face ID / fingerprint: offered only while App Lock is on, and only switched ON when the phone
 *  supports it and she chooses it (PIN, then the phone's own prompt, on the PIN screen).
 *  Checking support asks the phone only: no prompt, no records. Re-checked each time this
 *  screen comes into view (e.g. after she sets up Face ID in the phone's settings). */
export default function BiometricUnlockSettings() {
  const [status, setStatus] = useState<BiometricStatus | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([getBiometricStatus(), isBiometricUnlockOn()]).then(([st, isOn]) => {
      if (!alive) return;
      setStatus(st);
      setOn(isOn);
    });
    return () => {
      alive = false;
    };
  }, []);
  useFocusEffect(refresh);

  const name = status && 'method' in status ? biometricName(status.method) : 'Face ID or fingerprint';
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    const off = await disableBiometricUnlock();
    setBusy(false);
    if (off) setOn(false);
    Alert.alert(
      off ? BIOMETRIC.turnOff(name) : 'Nothing was changed',
      off ? 'Done. Only your PIN will open VIVA Cycle.' : "We couldn't change this setting. Please try again."
    );
  };
  return (
    <View style={styles.bioBlock}>
      <Text style={styles.bioHeading}>{BIOMETRIC.heading}</Text>
      {status?.kind === 'available' && !on && (
        <SettingsRow
          icon={status.method === 'faceId' || status.method === 'face' ? 'scan' : 'finger-print'}
          title={BIOMETRIC.turnOn(name)}
          subtitle={BIOMETRIC.turnOnBody}
          onPress={() => router.push({ pathname: '/app-lock-pin', params: { mode: 'biometric', method: status.method } })}
        />
      )}
      {on && (
        <SettingsRow icon="close-circle" title={BIOMETRIC.turnOff(name)} subtitle={BIOMETRIC.turnOffBody} onPress={() => void turnOff()} />
      )}
      <Text style={styles.note} accessibilityLiveRegion="polite">
        {biometricStatusText(status, on)}
      </Text>
      <Text style={styles.note}>{BIOMETRIC.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bioBlock: { gap: spacing.md, marginTop: spacing.sm },
  bioHeading: { fontSize: 16, fontWeight: '700', color: colors.navy },
  note: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 19 },
});
