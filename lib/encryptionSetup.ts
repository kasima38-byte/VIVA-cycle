// VIVA Cycle - getting encryption ready before ANY record is read or written.
//
// Runs once per app start (and again after a failure, on retry):
//  - new install, or everything deleted   -> make a key; nothing is written to storage;
//  - key + marker "done"                  -> ready;
//  - records from an older version (plain text) -> make the key FIRST, then encrypt each
//    record in place: encrypt, check it decrypts to the same text, write, read back, compare.
//    A crash at any point is safe: unconverted records stay readable as plain text, and the
//    next start carries on where it stopped;
//  - encrypted records but no key         -> "keyMissing": never start over, never overwrite.
// Plain text is never written again once a record is encrypted.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AESEncryptionKey } from 'expo-crypto';
import { decryptValue, encryptValue, isEncryptedValue } from './cipher';
import { ENCRYPTION_MARKER_KEY, isAppKey } from './dailyStorage';
import { createDataKey, deleteDataKey, readDataKey } from './dataKey';

export const ENCRYPTION_VERSION = 1;

export type EncryptionFailure =
  | 'keyUnavailable'   // secure storage couldn't be read or written (try again)
  | 'keyMissing'       // encrypted records exist but their key is gone or wrong (can't be read)
  | 'migrationFailed'; // an older record couldn't be encrypted safely (nothing lost; try again)

export type EncryptionStatus = { ok: true; converted: number } | { ok: false; reason: EncryptionFailure };

let current: Promise<EncryptionStatus> | null = null;
let dataKey: AESEncryptionKey | null = null;

/** Safe to call from anywhere, any number of times: setup runs once. A failure is retried on the
 *  next call (the app's "Try again"). */
export function ensureEncryptionReady(): Promise<EncryptionStatus> {
  if (!current) {
    current = setup().then((status) => {
      if (!status.ok) current = null;
      return status;
    });
  }
  return current;
}

/** The key, once setup has succeeded (lib/secureStorage.ts only). */
export function getReadyKey(): AESEncryptionKey | null {
  return dataKey;
}

/** After Delete All My Data: remove the key, and start fresh on the next write. Throws if the
 *  key could not be removed (the records are already gone; a leftover key unlocks nothing). */
export async function forgetDataKey(): Promise<void> {
  dataKey = null;
  current = null;
  await deleteDataKey();
}

const fail = (reason: EncryptionFailure): EncryptionStatus => {
  console.warn('VIVA: encryption setup failed (' + reason + ')'); // never log keys or records
  return { ok: false, reason };
};

async function writeMarker(state: 'migrating' | 'done') {
  await AsyncStorage.setItem(ENCRYPTION_MARKER_KEY, JSON.stringify({ version: ENCRYPTION_VERSION, state }));
}

async function setup(): Promise<EncryptionStatus> {
  dataKey = null;
  let key: AESEncryptionKey | null;
  try {
    key = await readDataKey();
  } catch {
    return fail('keyUnavailable');
  }

  let recordKeys: string[];
  let marker: { state?: string } | null = null;
  try {
    recordKeys = (await AsyncStorage.getAllKeys()).filter((k) => isAppKey(k) && k !== ENCRYPTION_MARKER_KEY);
    const m = await AsyncStorage.getItem(ENCRYPTION_MARKER_KEY);
    marker = m ? JSON.parse(m) : null;
  } catch {
    return fail('migrationFailed');
  }

  if (!key) {
    if (recordKeys.length > 0) {
      // Records already encrypted (marker, or an encrypted value) need THEIR key: never replace it
      if (marker) return fail('keyMissing');
      try {
        for (const k of recordKeys) if (isEncryptedValue(await AsyncStorage.getItem(k))) return fail('keyMissing');
      } catch {
        return fail('migrationFailed');
      }
    }
    try {
      key = await createDataKey(); // saved and read back before anything is encrypted
    } catch {
      return fail('keyUnavailable');
    }
  }

  // Nothing stored yet (new install, or after Delete All): ready, and nothing is written.
  // Records written from now on are encrypted; the marker follows with the first migration check.
  if (marker?.state === 'done' || recordKeys.length === 0) {
    dataKey = key;
    return { ok: true, converted: 0 };
  }

  // Records already encrypted must open with THIS key. If none of them do, it is the wrong key:
  // stop before writing anything. (One that doesn't open among others that do is just damaged,
  // and is set aside later like any damaged record.)
  try {
    let sealedCount = 0;
    let opened = 0;
    for (const k of recordKeys) {
      const v = await AsyncStorage.getItem(k);
      if (!isEncryptedValue(v)) continue;
      sealedCount++;
      try {
        await decryptValue(key, k, v);
        opened++;
        break;
      } catch {
        // keep looking
      }
    }
    if (sealedCount > 0 && opened === 0) return fail('keyMissing');
  } catch {
    return fail('migrationFailed');
  }

  // Records from an older version: encrypt each one in place
  let converted = 0;
  try {
    await writeMarker('migrating');
    for (const k of recordKeys) {
      const plain = await AsyncStorage.getItem(k);
      if (plain === null || isEncryptedValue(plain)) continue; // gone, or done before a crash
      const sealed = await encryptValue(key, k, plain);
      if ((await decryptValue(key, k, sealed)) !== plain) throw new Error('round trip');
      await AsyncStorage.setItem(k, sealed);
      if ((await AsyncStorage.getItem(k)) !== sealed) throw new Error('read back');
      converted++;
    }
    await writeMarker('done');
  } catch {
    return fail('migrationFailed');
  }
  dataKey = key;
  return { ok: true, converted };
}
