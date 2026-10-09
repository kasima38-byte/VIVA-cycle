// VIVA Cycle - App Lock: a 6-digit PIN that must be entered when the app starts.
//
// What is stored (secure storage only: iPhone Keychain / Android Keystore, this device only):
//   viva-cycle.app-lock          {v, kdf, iterations, salt, hash}  - a PIN VERIFIER, never the PIN
//                                (PBKDF2 with PIN_ITERATIONS rounds and a new random salt each save)
//   viva-cycle.app-lock-attempts {failures, lastFailureAt}        - wrong-PIN counter
//   viva-cycle.biometric-unlock  'on'                             - her choice to also allow
//                                Face ID / fingerprint (lib/biometricUnlock.ts). Cleared whenever
//                                App Lock is set up, turned off or reset, so it is never inherited.
// The verifier is PBKDF2-HMAC-SHA256 (@noble/hashes, audited, pure JS) with a random 16-byte salt.
//
// Limits (honest): a 6-digit PIN has only 1,000,000 possibilities. Salting and PBKDF2 stop
// precomputed tables and slow each guess, but cannot make a short PIN strong against someone who
// has already copied the phone's secure storage. The real protections are: the verifier lives in
// the Keychain/Keystore, and wrong guesses are throttled with waits that survive a restart.
// App Lock is a door: it does not change how records are stored (they are encrypted separately,
// with a key that does not depend on the PIN).

import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { utf8Encode } from './cipher';

export const PIN_LENGTH = 6;
// 10,000 rounds: about a second on an iPhone in Expo Go (50,000 took ~6 s, Oct 2026). For a
// 6-digit PIN the rounds add little anyway; the Keychain/Keystore and the waits do the real work.
// Stored with each verifier: a PIN saved with another count is re-saved after the next unlock.
export const PIN_ITERATIONS = 10_000;
const LOCK_KEY = 'viva-cycle.app-lock';
const ATTEMPTS_KEY = 'viva-cycle.app-lock-attempts';
export const BIOMETRIC_PREF_KEY = 'viva-cycle.biometric-unlock';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Wrong PINs allowed before waits start, then the wait after each further wrong PIN. */
export const FREE_ATTEMPTS = 4;
const WAITS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export function isValidPin(pin: string): boolean {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

type Verifier = { v: 1; kdf: 'pbkdf2-sha256'; iterations: number; salt: string; hash: string };
type Attempts = { failures: number; lastFailureAt: number };

// ---------- small helpers ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].reduce((acc, j) => (acc << 6) | (i + j < clean.length ? B64.indexOf(clean[i + j]) : 0), 0);
    out.push((n >> 16) & 255);
    if (i + 2 < clean.length) out.push((n >> 8) & 255);
    if (i + 3 < clean.length) out.push(n & 255);
  }
  return Uint8Array.from(out);
}
/** Compare without stopping at the first difference. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8Encode(pin), salt, { c: iterations, dkLen: 32, asyncTick: 16 });
}

async function readVerifier(): Promise<Verifier | null> {
  const raw = await SecureStore.getItemAsync(LOCK_KEY, OPTIONS);
  if (raw === null) return null;
  const v = JSON.parse(raw);
  if (v?.v !== 1 || v.kdf !== 'pbkdf2-sha256' || typeof v.salt !== 'string' || typeof v.hash !== 'string' || !(v.iterations > 0)) {
    throw new Error('unreadable app lock');
  }
  return v as Verifier;
}

async function writeVerifier(pin: string): Promise<void> {
  const salt = await getRandomBytesAsync(16);
  const hash = await derive(pin, salt, PIN_ITERATIONS);
  const record: Verifier = { v: 1, kdf: 'pbkdf2-sha256', iterations: PIN_ITERATIONS, salt: toBase64(salt), hash: toBase64(hash) };
  const json = JSON.stringify(record);
  await SecureStore.setItemAsync(LOCK_KEY, json, OPTIONS);
  if ((await SecureStore.getItemAsync(LOCK_KEY, OPTIONS)) !== json) throw new Error('app lock not stored');
}

async function readAttempts(): Promise<Attempts> {
  const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY, OPTIONS);
  if (raw === null) return { failures: 0, lastFailureAt: 0 };
  const a = JSON.parse(raw);
  return { failures: Math.max(0, Number(a?.failures) || 0), lastFailureAt: Number(a?.lastFailureAt) || 0 };
}
const writeAttempts = (a: Attempts) => SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(a), OPTIONS);

/** How long she must wait after `failures` wrong PINs. */
export function waitAfter(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  return WAITS_MS[Math.min(failures - FREE_ATTEMPTS - 1, WAITS_MS.length - 1)];
}

/** Milliseconds left before another PIN may be tried. If the clock went BACKWARDS since the last
 *  wrong PIN, the full wait applies again (turning the clock back can't skip it). */
function remaining(a: Attempts, now: number): number {
  const wait = waitAfter(a.failures);
  if (wait === 0) return 0;
  if (now < a.lastFailureAt) return wait;
  return Math.max(0, a.lastFailureAt + wait - now);
}

// ---------- public API ----------

export type LockStatus = { kind: 'off' } | { kind: 'on' } | { kind: 'unknown' }; // unknown = secure storage unreadable

export async function getLockStatus(): Promise<LockStatus> {
  try {
    return (await readVerifier()) ? { kind: 'on' } : { kind: 'off' };
  } catch {
    return { kind: 'unknown' };
  }
}

/** Waiting time right now (for the lock screen). */
export async function getWaitMs(now = Date.now()): Promise<number> {
  try {
    return remaining(await readAttempts(), now);
  } catch {
    return 0;
  }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; waitMs: number } // waitMs: wait now required before the next try
  | { ok: false; reason: 'wait'; waitMs: number }  // tried too soon: nothing was checked
  | { ok: false; reason: 'invalid' }               // not 6 digits: nothing was checked or counted
  | { ok: false; reason: 'error' };                // secure storage failed: NOT unlocked

/** Check a PIN. The failure is counted BEFORE the check, so closing the app mid-check still counts
 *  as a try; a correct PIN then clears the counter. Never unlocks on an error. */
export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  if (!isValidPin(pin)) return { ok: false, reason: 'invalid' };
  try {
    const verifier = await readVerifier();
    if (!verifier) return { ok: false, reason: 'error' };
    const attempts = await readAttempts();
    const wait = remaining(attempts, now);
    if (wait > 0) return { ok: false, reason: 'wait', waitMs: wait };
    const counted: Attempts = { failures: attempts.failures + 1, lastFailureAt: now };
    await writeAttempts(counted);
    const hash = await derive(pin, fromBase64(verifier.salt), verifier.iterations);
    if (!sameBytes(hash, fromBase64(verifier.hash))) {
      return { ok: false, reason: 'wrong', waitMs: waitAfter(counted.failures) };
    }
    await writeAttempts({ failures: 0, lastFailureAt: 0 });
    return { ok: true };
  } catch {
    console.warn('VIVA: could not check the PIN'); // never log the PIN
    return { ok: false, reason: 'error' };
  }
}

/** After a successful unlock: if the stored verifier uses an older round count, save it again with
 *  the current count (and a new salt). Needs the PIN, which is only available right after she
 *  entered it, so it runs then. Only ever re-saves the SAME PIN; the lock is never weakened or
 *  turned off by this. Failure is harmless: the old verifier stays and still works. */
export async function refreshVerifierIfOld(pin: string): Promise<boolean> {
  try {
    const verifier = await readVerifier();
    if (!verifier || verifier.iterations === PIN_ITERATIONS) return false;
    const hash = await derive(pin, fromBase64(verifier.salt), verifier.iterations);
    if (!sameBytes(hash, fromBase64(verifier.hash))) return false; // only for the right PIN
    await writeVerifier(pin);
    return true;
  } catch {
    console.warn('VIVA: could not update the PIN settings');
    return false;
  }
}

export type SetupResult = 'saved' | 'invalid' | 'mismatch' | 'alreadyOn' | 'error';

/** Turn App Lock on with a new PIN (entered twice). Touches nothing but the lock settings. */
export async function setupPin(pin: string, confirm: string): Promise<SetupResult> {
  if (!isValidPin(pin)) return 'invalid';
  if (pin !== confirm) return 'mismatch';
  try {
    if (await readVerifier()) return 'alreadyOn';
    // A new lock starts with biometrics OFF: she must choose them again herself
    await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY, OPTIONS);
    await writeAttempts({ failures: 0, lastFailureAt: 0 });
    await writeVerifier(pin);
    return 'saved';
  } catch {
    console.warn('VIVA: could not save the PIN');
    return 'error';
  }
}

export type ChangeResult = VerifyResult | { ok: false; reason: 'mismatch' } | { ok: true; changed: true };

/** Change the PIN: the CURRENT PIN must be right first. A wrong current PIN changes nothing. */
export async function changePin(current: string, next: string, confirm: string, now = Date.now()): Promise<ChangeResult> {
  if (!isValidPin(next)) return { ok: false, reason: 'invalid' };
  if (next !== confirm) return { ok: false, reason: 'mismatch' };
  const check = await verifyPin(current, now);
  if (!check.ok) return check;
  try {
    await writeVerifier(next);
    return { ok: true, changed: true };
  } catch {
    console.warn('VIVA: could not save the new PIN');
    return { ok: false, reason: 'error' }; // the old PIN may still be the one stored: it is re-read next time
  }
}

/** Turn App Lock off: only with the right PIN. A wrong PIN never turns it off. */
export async function disableLock(current: string, now = Date.now()): Promise<VerifyResult> {
  const check = await verifyPin(current, now);
  if (!check.ok) return check;
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY, OPTIONS);
    await SecureStore.deleteItemAsync(LOCK_KEY, OPTIONS);
    await SecureStore.deleteItemAsync(ATTEMPTS_KEY, OPTIONS);
    if (await readVerifier()) throw new Error('still on');
    return { ok: true };
  } catch {
    console.warn('VIVA: could not turn off App Lock');
    return { ok: false, reason: 'error' };
  }
}

/** Delete All My Data / "Forgot PIN" reset: remove the lock settings along with everything else.
 *  Only ever called after her explicit, double-confirmed choice to erase all VIVA data. */
export async function removeAppLock(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_PREF_KEY, OPTIONS);
  await SecureStore.deleteItemAsync(LOCK_KEY, OPTIONS);
  await SecureStore.deleteItemAsync(ATTEMPTS_KEY, OPTIONS);
}
