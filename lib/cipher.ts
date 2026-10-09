// VIVA Cycle - encrypting one stored value (AES-256-GCM, expo-crypto).
//
// Stored form: "vc1:" + base64(iv | ciphertext | tag). The storage key name is the GCM
// "additional data", so a value only decrypts under the key it was written to (months
// can't be swapped). GCM also detects any change to the stored text.
// Text is turned into bytes here (UTF-8) rather than relying on the phone's JS engine.

import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

export const ENCRYPTED_PREFIX = 'vc1:';

export function isEncryptedValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/** UTF-8 bytes of a JS string (surrogate pairs handled). */
export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** JS string from UTF-8 bytes. Throws on malformed input. */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    let n: number;
    if (b < 0x80) { c = b; n = 1; }
    else if (b >= 0xc2 && b < 0xe0) { c = b & 31; n = 2; }
    else if (b >= 0xe0 && b < 0xf0) { c = b & 15; n = 3; }
    else if (b >= 0xf0 && b < 0xf5) { c = b & 7; n = 4; }
    else throw new Error('bad utf-8');
    if (i + n > bytes.length) throw new Error('bad utf-8');
    for (let j = 1; j < n; j++) {
      const x = bytes[i + j];
      if ((x & 0xc0) !== 0x80) throw new Error('bad utf-8');
      c = (c << 6) | (x & 63);
    }
    i += n;
    if (c >= 0x10000) {
      c -= 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
    } else out += String.fromCharCode(c);
  }
  return out;
}

export async function encryptValue(key: AESEncryptionKey, storageKey: string, text: string): Promise<string> {
  const sealed = await aesEncryptAsync(utf8Encode(text), key, { additionalData: utf8Encode(storageKey) });
  return ENCRYPTED_PREFIX + (await sealed.combined('base64'));
}

/** Throws if the value was changed, was written under another key name, or needs another key. */
export async function decryptValue(key: AESEncryptionKey, storageKey: string, stored: string): Promise<string> {
  if (!isEncryptedValue(stored)) throw new Error('not an encrypted value');
  const sealed = AESSealedData.fromCombined(stored.slice(ENCRYPTED_PREFIX.length));
  const bytes = await aesDecryptAsync(sealed, key, { output: 'bytes', additionalData: utf8Encode(storageKey) });
  return utf8Decode(bytes as Uint8Array);
}
