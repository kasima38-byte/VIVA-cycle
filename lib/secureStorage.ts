// VIVA Cycle - the storage the app uses: AsyncStorage with every value encrypted.
// Same four functions as AsyncStorage, so the stores only change their import.
//
//  - getItem / setItem wait until encryption is ready (lib/encryptionSetup.ts). If it isn't
//    (no key, secure storage unreadable), they THROW: the app then shows "couldn't load" and
//    blocks saving, instead of starting over or writing anything in plain text.
//  - A value that can't be decrypted (changed, damaged) is returned exactly as stored, so the
//    existing damaged-record handling sets it aside untouched. It is never treated as plain data.
//  - getAllKeys / removeItem need no key: deleting always works, even without one.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptValue, encryptValue, isEncryptedValue } from './cipher';
import { ensureEncryptionReady, getReadyKey } from './encryptionSetup';

export class StorageLockedError extends Error {
  constructor(public reason: string) {
    super('VIVA storage is not available (' + reason + ')');
  }
}

async function readyKey() {
  const status = await ensureEncryptionReady();
  const key = getReadyKey();
  if (!status.ok || !key) throw new StorageLockedError(status.ok ? 'keyUnavailable' : status.reason);
  return key;
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = await readyKey();
    const stored = await AsyncStorage.getItem(key);
    if (stored === null || !isEncryptedValue(stored)) return stored; // nothing, or not yet converted
    try {
      return await decryptValue(k, key, stored);
    } catch {
      return stored; // unreadable: handed back as stored, so it is set aside, never used as data
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = await readyKey();
    await AsyncStorage.setItem(key, await encryptValue(k, key, value));
  },

  removeItem(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  },

  async getAllKeys(): Promise<readonly string[]> {
    return AsyncStorage.getAllKeys();
  },
};

export default secureStorage;
