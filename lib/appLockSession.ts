// VIVA Cycle - App Lock for this run of the app (in memory only).
//
// gate: 'checking' -> 'locked' | 'open' | 'unknown'
//  - 'checking': reading secure storage at start-up -> nothing but a blank loading view;
//  - 'locked':   App Lock is on and the PIN hasn't been entered -> ONLY the lock screen;
//  - 'unknown':  secure storage couldn't be read -> treated as locked (never opens by itself);
//  - 'open':     App Lock is off, or the right PIN was entered.
// Fresh-launch locking only: once open, it stays open until the app is closed.

import { useSyncExternalStore } from 'react';
import { getLockStatus, refreshVerifierIfOld, removeAppLock, verifyPin, type VerifyResult } from './appLock';
import { getBiometricStatus, isBiometricUnlockOn, promptBiometric, type BiometricResult } from './biometricUnlock';

export type Gate = 'checking' | 'locked' | 'unknown' | 'open';
type State = { gate: Gate; lockOn: boolean | null };

let state: State = { gate: 'checking', lockOn: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const getAppLockState = () => state;
export function useAppLock(): State {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getAppLockState);
}

/** What the root of the app may show. Only 'app' renders any VIVA screen. */
export function rootView(gate: Gate): 'loading' | 'lock' | 'app' {
  if (gate === 'open') return 'app';
  if (gate === 'checking') return 'loading';
  return 'lock';
}

let starting: Promise<void> | null = null;
/** Called once at start-up (and by "Try again" when secure storage was unreadable). */
export function initAppLock(): Promise<void> {
  if (!starting) {
    starting = (async () => {
      const status = await getLockStatus();
      if (status.kind === 'off') set({ gate: 'open', lockOn: false });
      else if (status.kind === 'on') set({ gate: 'locked', lockOn: true });
      else set({ gate: 'unknown', lockOn: null });
    })().finally(() => {
      if (state.gate === 'unknown') starting = null;
    });
  }
  return starting;
}

/** Lock screen: only a verified PIN opens the app. */
export async function unlockWithPin(pin: string): Promise<VerifyResult> {
  const result = await verifyPin(pin);
  if (result.ok) {
    set({ gate: 'open' });
    flushPendingLinks();
    // A PIN saved with an older round count is re-saved now, in the background (app already open)
    void refreshVerifierIfOld(pin);
  }
  return result;
}

/** Lock screen: Face ID / fingerprint, only if she turned it on and the phone can do it now.
 *  Only a 'success' from the phone's own prompt opens the app; anything else leaves it locked
 *  and the PIN pad stays available. The wrong-PIN counter is not touched. */
export async function unlockWithBiometrics(promptMessage: string): Promise<BiometricResult | 'notOffered'> {
  if (state.gate !== 'locked') return 'notOffered';
  if (!(await isBiometricUnlockOn())) return 'notOffered';
  if ((await getBiometricStatus()).kind !== 'available') return 'unavailable';
  const result = await promptBiometric(promptMessage);
  if (result === 'success' && state.gate === 'locked') {
    set({ gate: 'open' });
    flushPendingLinks();
  }
  return result;
}

/** After the PIN screens change the setting (the app is already open then). */
export function noteLockChanged(on: boolean) {
  set({ lockOn: on });
}

/** After Delete All My Data (or "Forgot PIN" -> delete everything): the lock goes with the data. */
export async function forgetAppLock(): Promise<void> {
  await removeAppLock();
  set({ gate: 'open', lockOn: false });
  flushPendingLinks();
}

// A reminder tapped while locked opens its screen only after unlocking.
let pending: { url: string; open: (url: string) => void } | null = null;
export function openWhenUnlocked(url: string, open: (url: string) => void) {
  if (state.gate === 'open') open(url);
  else pending = { url, open };
}
function flushPendingLinks() {
  const p = pending;
  pending = null;
  if (p) setTimeout(() => p.open(p.url), 0);
}
