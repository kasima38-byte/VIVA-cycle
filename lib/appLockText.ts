// VIVA Cycle - every word of App Lock (pure, testable). Nothing here mentions her records.

import type { VerifyResult } from './appLock';
import type { BiometricMethod, BiometricResult, BiometricStatus, EnableResult } from './biometricUnlock';

export function waitText(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + (s === 1 ? ' second' : ' seconds');
  const m = Math.ceil(s / 60);
  return m + (m === 1 ? ' minute' : ' minutes');
}

/** What the lock screen / PIN screens say after a check. Never "unlocked" unless it was. */
export function verifyMessage(r: VerifyResult): string | null {
  if (r.ok) return null;
  switch (r.reason) {
    case 'wrong':
      return r.waitMs > 0 ? 'Incorrect PIN. Try again in ' + waitText(r.waitMs) + '.' : 'Incorrect PIN. Try again.';
    case 'wait':
      return 'Too many incorrect PINs. Try again in ' + waitText(r.waitMs) + '.';
    case 'invalid':
      return 'Enter all 6 digits.';
    case 'error':
      return "We couldn't check your PIN, so VIVA Cycle stays locked. Please try again.";
  }
}

export const APP_LOCK = {
  sectionTitle: 'App Lock',
  sectionSubtitle: 'Ask for a PIN when VIVA Cycle opens.',
  turnOn: 'Turn on App Lock',
  turnOnBody: 'Set up a 6-digit PIN.',
  change: 'Change PIN',
  changeBody: 'Your current PIN is needed first.',
  turnOff: 'Turn off App Lock',
  turnOffBody: 'Your current PIN is needed first.',
  statusOn: 'On: your PIN is asked for each time VIVA Cycle starts.',
  statusOff: 'Off: VIVA Cycle opens without a PIN.',
  statusUnknown: "We couldn't check App Lock right now. Close and reopen VIVA Cycle to try again.",
  note:
    'App Lock keeps people who use this phone out of VIVA Cycle. It is checked when the app starts. ' +
    "If you forget your PIN, there is no way to recover it: the only way back in is to delete all VIVA Cycle data on this phone.",
};

export const LOCK_SCREEN = {
  title: 'VIVA Cycle is locked',
  prompt: 'Enter your PIN',
  checking: 'Checking…',
  forgot: 'Forgot PIN?',
};

export const FORGOT_PIN_FIRST = {
  title: 'Forgot your PIN?',
  body:
    "Your PIN can't be recovered, and VIVA Cycle can't be opened without it.\n\n" +
    'The only way back in is to delete all VIVA Cycle records and settings on this phone and start again. ' +
    "Scheduled reminders will be cancelled. This can't be undone.",
  cancel: 'Cancel',
  confirm: 'Continue',
};
export const FORGOT_PIN_FINAL = {
  title: 'Delete everything and start again?',
  body: "All VIVA Cycle data on this phone will be permanently deleted. You can't get it back.",
  cancel: 'Cancel',
  confirm: 'Delete Everything',
};

export const PIN_FLOW = {
  setup: { title: 'Set up App Lock', steps: ['Choose a 6-digit PIN', 'Enter the same PIN again'] },
  change: { title: 'Change PIN', steps: ['Enter your current PIN', 'Choose a new 6-digit PIN', 'Enter the new PIN again'] },
  disable: { title: 'Turn off App Lock', steps: ['Enter your current PIN'] },
  biometric: { title: 'Turn on Face ID or fingerprint', steps: ['Enter your PIN'] },
  mismatch: "The PINs didn't match. Nothing was changed. Choose your PIN again.",
  saveError: "We couldn't save your PIN, so nothing was changed. Please try again.",
  doneSetup: 'App Lock is on. Your PIN will be asked for each time VIVA Cycle starts.',
  doneChange: 'Your PIN has been changed.',
  doneDisable: 'App Lock is off.',
};


// ---------- Biometric unlock ----------

/** "Face ID", "Touch ID", "Fingerprint"... as the phone calls it. */
export function biometricName(method: BiometricMethod): string {
  switch (method) {
    case 'faceId': return 'Face ID';
    case 'touchId': return 'Touch ID';
    case 'fingerprint': return 'Fingerprint';
    case 'face': return 'Face unlock';
    case 'iris': return 'Iris unlock';
    default: return 'Biometric unlock';
  }
}
export const isBiometricMethod = (m: unknown): m is BiometricMethod =>
  ['faceId', 'touchId', 'fingerprint', 'face', 'iris', 'biometrics'].includes(m as string);

export const BIOMETRIC = {
  heading: 'Face ID or fingerprint',
  turnOn: (name: string) => 'Turn on ' + name,
  turnOnBody: 'Your PIN is needed first.',
  turnOff: (name: string) => 'Turn off ' + name,
  turnOffBody: 'Only your PIN will open VIVA Cycle.',
  checking: 'Checking what this phone supports…',
  prompt: 'Unlock VIVA Cycle',
  enablePrompt: 'Confirm to use with VIVA Cycle',
  lockScreenButton: (name: string) => 'Use ' + name,
  note:
    "This uses your phone's own Face ID or fingerprint check. VIVA Cycle never sees or stores your face or fingerprint. " +
    'Anyone whose face or fingerprint is set up on this phone can open VIVA Cycle. ' +
    'It is a quicker way past App Lock: it does not encrypt your records, and your PIN always works too.',
};

/** One line under the heading: is biometric unlock possible, and is it on? */
export function biometricStatusText(status: BiometricStatus | null, on: boolean): string {
  if (!status) return BIOMETRIC.checking;
  if (status.kind === 'available') {
    const n = biometricName(status.method);
    return on ? 'On: you can open VIVA Cycle with ' + n + ' or your PIN.' : n + ' is available on this phone. Off: only your PIN opens VIVA Cycle.';
  }
  const off = on ? ' Your PIN will be asked for instead.' : '';
  switch (status.kind) {
    case 'notEnrolled':
      return biometricName(status.method) + " isn't set up in this phone's settings." + off;
    case 'needsInstalledApp':
      return 'Face ID works only in the installed VIVA Cycle app, not in Expo Go.' + off;
    case 'noHardware':
      return "This phone doesn't support Face ID or fingerprint unlock." + off;
    default:
      return "We couldn't check Face ID or fingerprint support right now." + off;
  }
}

/** Lock screen message after the biometric prompt (null = nothing to say). */
export function biometricLockMessage(r: BiometricResult | 'notOffered', name: string): string | null {
  switch (r) {
    case 'success':
    case 'notOffered':
    case 'cancelled':
      return null;
    case 'failed':
      return name + " didn't recognise you. Enter your PIN.";
    case 'lockout':
      return name + ' is locked for now. Enter your PIN.';
    default:
      return name + " isn't available right now. Enter your PIN.";
  }
}

/** Turning biometric unlock on: what to say when it didn't happen. Nothing was changed. */
export function enableBiometricMessage(r: EnableResult, name: string): string {
  if (r.ok) return name + ' is on. You can open VIVA Cycle with ' + name + ' or your PIN.';
  switch (r.reason) {
    case 'notConfirmed':
      return name + " wasn't confirmed, so it wasn't turned on. Nothing was changed.";
    case 'lockout':
      return name + " is locked for now (too many tries). Nothing was changed.";
    case 'unavailable':
      return name + " isn't available right now, so nothing was changed.";
    case 'lockOff':
      return 'Turn on App Lock first.';
    case 'saveFailed':
      return "We couldn't save this setting, so nothing was changed. Please try again.";
    default:
      return verifyMessage(r) ?? "We couldn't check your PIN, so nothing was changed.";
  }
}
