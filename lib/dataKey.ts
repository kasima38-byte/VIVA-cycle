// VIVA Cycle - the one data-encryption key (AES-256), kept in the phone's secure storage:
// iPhone Keychain / Android Keystore via expo-secure-store.
//  - "when unlocked, this device only": readable only while the phone is unlocked, never
//    moved to another device by a backup or transfer;
//  - NOT tied to biometrics (requireAuthentication): a new fingerprint or face would destroy it,
//    and with it every record. The app lock (a later step) is a separate door.
// The key never leaves secure storage except in memory, and is never logged.

import { AESEncryptionKey, AESKeySize } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export const DATA_KEY_NAME = 'viva-cycle.data-key'; // SecureStore allows letters, digits, . - _

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** The saved key, or null if there is none. Throws if secure storage can't be read. */
export async function readDataKey(): Promise<AESEncryptionKey | null> {
  const encoded = await SecureStore.getItemAsync(DATA_KEY_NAME, OPTIONS);
  if (encoded === null) return null;
  return AESEncryptionKey.import(encoded, 'base64');
}

/** Make a new random key and save it. Resolves only once it has been read back unchanged:
 *  nothing may ever be encrypted with a key that isn't safely stored. */
export async function createDataKey(): Promise<AESEncryptionKey> {
  const key = await AESEncryptionKey.generate(AESKeySize.AES256);
  const encoded = await key.encoded('base64');
  await SecureStore.setItemAsync(DATA_KEY_NAME, encoded, OPTIONS);
  const back = await SecureStore.getItemAsync(DATA_KEY_NAME, OPTIONS);
  if (back !== encoded) throw new Error('data key was not stored');
  return key;
}

/** Remove the key (Delete All My Data). Without it, any copy of the old records is unreadable. */
export async function deleteDataKey(): Promise<void> {
  await SecureStore.deleteItemAsync(DATA_KEY_NAME, OPTIONS);
}
