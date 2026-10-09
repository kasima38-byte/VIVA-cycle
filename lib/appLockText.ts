// VIVA Cycle - every word of App Lock (pure, testable). Nothing here mentions her records.

import type { VerifyResult } from './appLock';

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
  mismatch: "The PINs didn't match. Nothing was changed. Choose your PIN again.",
  saveError: "We couldn't save your PIN, so nothing was changed. Please try again.",
  doneSetup: 'App Lock is on. Your PIN will be asked for each time VIVA Cycle starts.',
  doneChange: 'Your PIN has been changed.',
  doneDisable: 'App Lock is off.',
};
