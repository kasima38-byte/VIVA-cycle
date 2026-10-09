// Test stand-ins for the phone's security modules, loaded FIRST by every test:
//  - expo-secure-store -> an in-memory "Keychain" with switchable failures;
//  - expo-crypto        -> REAL AES-256-GCM from Node's crypto, same API shape as expo-crypto 57
//                          (string inputs are base64, like the real module).
// Also gives tests a way to read/write a stored value the way the app would (`plain` / `seal`).
const req: any = require; // Node's require
const nodeCrypto = req('crypto');
const Buffer: any = req('buffer').Buffer; // Node's Buffer (the project has no Node type definitions)
type Buf = any;

// ---------- Secure store ----------
export const keychain = new Map<string, string>();
export const secureFaults = { get: false, set: false, del: false, dropWrites: false };
const secureStore = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  getItemAsync: async (k: string) => {
    if (secureFaults.get) throw new Error('simulated keychain read failure');
    return keychain.has(k) ? keychain.get(k)! : null;
  },
  setItemAsync: async (k: string, v: string) => {
    if (secureFaults.set) throw new Error('simulated keychain write failure');
    if (!secureFaults.dropWrites) keychain.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    if (secureFaults.del) throw new Error('simulated keychain delete failure');
    keychain.delete(k);
  },
};

// ---------- AES-GCM ----------
const bytesOf = (x: any) => (typeof x === 'string' ? Buffer.from(x, 'base64') : Buffer.from(x));
class AESEncryptionKey {
  _b: Buf;
  size: number;
  constructor(b: Buf) { this._b = b; this.size = b.length * 8; }
  static async generate(size = 256) { return new AESEncryptionKey(nodeCrypto.randomBytes(size / 8)); }
  static async import(input: any, encoding?: 'hex' | 'base64') {
    const b = typeof input === 'string' ? Buffer.from(input, encoding === 'hex' ? 'hex' : 'base64') : Buffer.from(input);
    if (![16, 24, 32].includes(b.length)) throw new Error('bad key size');
    return new AESEncryptionKey(b);
  }
  async bytes() { return new Uint8Array(this._b); }
  async encoded(encoding: 'hex' | 'base64') { return this._b.toString(encoding); }
}
class AESSealedData {
  constructor(public _iv: Buf, public _ct: Buf, public _tag: Buf) {}
  static fromCombined(c: any) {
    const b = bytesOf(c);
    if (b.length < 28) throw new Error('sealed data too short');
    return new AESSealedData(b.subarray(0, 12), b.subarray(12, b.length - 16), b.subarray(b.length - 16));
  }
  async combined(encoding?: 'bytes' | 'base64') {
    const b = Buffer.concat([this._iv, this._ct, this._tag]);
    return encoding === 'base64' ? b.toString('base64') : new Uint8Array(b);
  }
}
const algo = (k: AESEncryptionKey) => 'aes-' + k.size + '-gcm';
async function aesEncryptAsync(plaintext: any, key: AESEncryptionKey, options: any = {}) {
  const iv = nodeCrypto.randomBytes(12);
  const c = nodeCrypto.createCipheriv(algo(key), key._b, iv);
  if (options.additionalData !== undefined) c.setAAD(bytesOf(options.additionalData));
  const ct = Buffer.concat([c.update(bytesOf(plaintext)), c.final()]);
  return new AESSealedData(iv, ct, c.getAuthTag());
}
async function aesDecryptAsync(sealed: AESSealedData, key: AESEncryptionKey, options: any = {}) {
  const d = nodeCrypto.createDecipheriv(algo(key), key._b, sealed._iv);
  if (options.additionalData !== undefined) d.setAAD(bytesOf(options.additionalData));
  d.setAuthTag(sealed._tag);
  const out = Buffer.concat([d.update(sealed._ct), d.final()]); // throws if changed / wrong key / wrong name
  return options.output === 'base64' ? out.toString('base64') : new Uint8Array(out);
}
const expoCrypto = { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync, AESKeySize: { AES128: 128, AES192: 192, AES256: 256 } };

for (const [name, exports] of [['expo-secure-store', secureStore], ['expo-crypto', expoCrypto]] as const) {
  const p = req.resolve(name);
  req.cache[p] = { id: p, filename: p, loaded: true, exports: { __esModule: true, ...exports, default: exports } };
}

// ---------- Helpers for tests that look at the stored text ----------
const KEY_NAME = 'viva-cycle.data-key';
const currentKey = () => {
  const k = keychain.get(KEY_NAME);
  if (!k) throw new Error('no data key in the test keychain');
  return Buffer.from(k, 'base64');
};
/** The text the app would read from a stored value (stored = "vc1:" + base64(iv|ct|tag)). */
export function plain(stored: string | null | undefined, storageKey: string): string | null {
  if (stored === null || stored === undefined) return null;
  if (!stored.startsWith('vc1:')) return stored;
  const b = Buffer.from(stored.slice(4), 'base64');
  const k = currentKey();
  const d = nodeCrypto.createDecipheriv('aes-' + k.length * 8 + '-gcm', k, b.subarray(0, 12));
  d.setAAD(Buffer.from(storageKey, 'utf8'));
  d.setAuthTag(b.subarray(b.length - 16));
  return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]).toString('utf8');
}
/** Encrypt text the way the app would store it under `storageKey`. */
export function seal(text: string, storageKey: string): string {
  const k = currentKey();
  const iv = nodeCrypto.randomBytes(12);
  const c = nodeCrypto.createCipheriv('aes-' + k.length * 8 + '-gcm', k, iv);
  c.setAAD(Buffer.from(storageKey, 'utf8'));
  const ct = Buffer.concat([c.update(Buffer.from(text, 'utf8')), c.final()]);
  return 'vc1:' + Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');
}
export function resetSecurity() {
  keychain.clear();
  Object.assign(secureFaults, { get: false, set: false, del: false, dropWrites: false });
}
