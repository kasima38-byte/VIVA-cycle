// VIVA Cycle - Biometric unlock: Face ID / Touch ID / fingerprint as a QUICKER way past App Lock.
//
// How it works (honest):
//  - The check is done by the phone's own system prompt (expo-local-authentication -> iOS
//    LocalAuthentication / Android BiometricPrompt). VIVA Cycle only gets back "success" or an
//    error code. It never sees, stores or sends a face, fingerprint or any biometric data.
//  - The only thing stored is her CHOICE ('on'), in secure storage (Keychain / Keystore), next to
//    the PIN verifier. It is cleared whenever App Lock is set up, turned off or reset.
//  - The 6-digit PIN always stays: it is the fallback whenever biometrics are cancelled, fail,
//    are locked out or unavailable.
//  - Only "strong" biometrics are accepted (Android Class 3; every iOS biometric), and the phone's
//    passcode is NOT accepted in place of the VIVA PIN (disableDeviceFallback).
//  - Anyone whose face or fingerprint is enrolled on this phone can open VIVA Cycle this way.
//  - It does not encrypt anything. Her records are encrypted separately (lib/cipher.ts), with a key
//    that does not depend on the PIN or on biometrics.
// Nothing here reads, writes or logs her records, the PIN or any authentication detail.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { BIOMETRIC_PREF_KEY, getLockStatus, verifyPin, type VerifyResult } from './appLock';

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Which kind of biometric the phone offers (for wording only). */
export type BiometricMethod = 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'iris' | 'biometrics';

export type BiometricStatus =
  | { kind: 'available'; method: BiometricMethod }
  | { kind: 'notEnrolled'; method: BiometricMethod } // sensor present, nothing (strong) set up in phone settings
  | { kind: 'noHardware' }
  | { kind: 'needsInstalledApp'; method: BiometricMethod } // Face ID inside Expo Go (not supported there)
  | { kind: 'error' };

function methodOf(types: number[]): BiometricMethod {
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const iris = types.includes(LocalAuthentication.AuthenticationType.IRIS);
  if (Platform.OS === 'ios') return face ? 'faceId' : finger ? 'touchId' : 'biometrics';
  if ([face, finger, iris].filter(Boolean).length !== 1) return 'biometrics';
  return finger ? 'fingerprint' : face ? 'face' : 'iris';
}

/** Can this phone do biometric unlock right now? Asks the system only: no prompt, no records. */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return { kind: 'noHardware' };
    const method = methodOf(await LocalAuthentication.supportedAuthenticationTypesAsync());
    // Expo's docs: "The FaceID authentication for iOS is not supported in Expo Go."
    if (Platform.OS === 'ios' && method === 'faceId' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return { kind: 'needsInstalledApp', method };
    }
    // BIOMETRIC_STRONG = a strong biometric is enrolled (every iOS biometric; Android Class 3)
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) return { kind: 'notEnrolled', method };
    return { kind: 'available', method };
  } catch {
    console.warn('VIVA: could not check biometric support');
    return { kind: 'error' };
  }
}

export type BiometricResult = 'success' | 'cancelled' | 'failed' | 'lockout' | 'unavailable' | 'error';

/** Show the phone's own biometric prompt. Only 'success' means she was recognised. */
export async function promptBiometric(promptMessage: string): Promise<BiometricResult> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      fallbackLabel: '', // iOS: no "Enter Password" button; her VIVA PIN is the fallback
      disableDeviceFallback: true, // the phone's passcode does not replace the VIVA PIN
      biometricsSecurityLevel: 'strong', // Android: Class 3 only (no 2D camera face unlock)
      requireConfirmation: true,
    });
    if (r.success === true) return 'success';
    const error = String((r as { error?: unknown }).error ?? '');
    if (['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback'].includes(error)) return 'cancelled';
    if (error === 'authentication_failed') return 'failed';
    if (error === 'lockout') return 'lockout';
    // missing_usage_description: iOS build without the Face ID message (e.g. Expo Go)
    if (['not_enrolled', 'not_available', 'passcode_not_set', 'missing_usage_description'].includes(error)) return 'unavailable';
    return 'error';
  } catch {
    console.warn('VIVA: the biometric prompt could not be shown');
    return 'error';
  }
}

/** Has she chosen biometric unlock? Any read problem counts as NO (the PIN is then used). */
export async function isBiometricUnlockOn(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY, OPTIONS)) === 'on';
  } catch {
    return false;
  }
}

/** The method to offer on the lock screen, or null (then only the PIN pad is shown). */
export async function biometricForLockScreen(): Promise<BiometricMethod | null> {
  if (!(await isBiometricUnlockOn())) return null;
  const status = await getBiometricStatus();
  return status.kind === 'available' ? status.method : null;
}

export type EnableResult =
  | { ok: true }
  | Exclude<VerifyResult, { ok: true }>
  | { ok: false; reason: 'lockOff' | 'unavailable' | 'notConfirmed' | 'lockout' | 'saveFailed' };

/** Turn biometric unlock on - only by her explicit choice: App Lock must be on, her CURRENT PIN
 *  must be right (it counts towards the waits like any PIN), and the phone must then recognise
 *  her once. Anything else changes nothing. */
export async function enableBiometricUnlock(pin: string, promptMessage: string): Promise<EnableResult> {
  if ((await getLockStatus()).kind !== 'on') return { ok: false, reason: 'lockOff' };
  const check = await verifyPin(pin);
  if (!check.ok) return check;
  if ((await getBiometricStatus()).kind !== 'available') return { ok: false, reason: 'unavailable' };
  const r = await promptBiometric(promptMessage);
  if (r === 'unavailable' || r === 'error') return { ok: false, reason: 'unavailable' };
  if (r === 'lockout') return { ok: false, reason: 'lockout' };
  if (r !== 'success') return { ok: false, reason: 'notConfirmed' };
  try {
    await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, 'on', OPTIONS);
    if (!(await isBiometricUnlockOn())) throw new Error('not stored');
    return { ok: true };
  } catch {
    console.warn('VIVA: could not save the biometric setting');
    return { ok: false, reason: 'saveFailed' };
  }
}

/** Turn biometric unlock off (the PIN alone is then used). No PIN needed: this only makes the
 *  lock stricter. Returns true only if it is really off afterwards. */
export async function disableBiometricUnlock(): Promise<boolean> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY, OPTIONS);
  } catch {
    console.warn('VIVA: could not turn off biometric unlock');
  }
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY, OPTIONS)) === null;
  } catch {
    return false;
  }
}
