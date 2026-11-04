// TraceErase's digital signature (Ed25519).
// Every receipt fingerprint is signed with TraceErase's private key. Anyone can check the signature with the
// public key (GET /api/public-key), so a forged or edited receipt or certificate is caught even offline.
// The key comes from TRACE_SIGNING_SEED (64 hex characters). Without it, a stable key is derived from the
// server's JWT secret, so it never changes between restarts and is never stored in the database.
import crypto from 'node:crypto';
import { config } from '../config.js';

let keys = null;

function load() {
  if (keys) return keys;
  const raw = String(config.signingSeed || '').trim();
  const seed = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : crypto.createHash('sha256').update('traceerase-ed25519:' + config.jwtSecret).digest();
  // PKCS#8 wrapper for a raw 32-byte Ed25519 private key
  const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]);
  const privateKey = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyRaw = publicKey.export({ format: 'jwk' }).x; // base64url, 32 bytes
  const keyId = 'te-' + crypto.createHash('sha256').update(publicKeyRaw).digest('hex').slice(0, 12);
  keys = { privateKey, publicKey, publicKeyRaw, keyId, fromSeed: /^[0-9a-f]{64}$/i.test(raw) };
  return keys;
}

/** Sign a receipt fingerprint (the 0x… SHA-256 hash). Returns a base64url signature. */
export function signHash(hash) {
  return crypto.sign(null, Buffer.from(String(hash)), load().privateKey).toString('base64url');
}

/** True when `signature` is TraceErase's signature over `hash`. */
export function verifyHash(hash, signature) {
  if (!hash || !signature) return false;
  try { return crypto.verify(null, Buffer.from(String(hash)), load().publicKey, Buffer.from(String(signature), 'base64url')); }
  catch { return false; }
}

export const signerId = () => load().keyId;

export function publicKeyInfo() {
  const k = load();
  return {
    algorithm: 'Ed25519',
    keyId: k.keyId,
    publicKey: k.publicKeyRaw,
    publicKeyPem: k.publicKey.export({ type: 'spki', format: 'pem' }),
    signs: 'The UTF-8 text of each receipt fingerprint (the 0x… SHA-256 hash).',
    howToCheck: 'crypto.verify(null, Buffer.from(hash), publicKeyPem, Buffer.from(signature, "base64url")) in Node.js, or any Ed25519 library.'
  };
}
