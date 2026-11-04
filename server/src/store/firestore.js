// Firestore over its REST API (no SDK).
// Every record is stored as a normal, human-readable Firestore document: each field of the record is a real
// Firestore field (text, number, true/false, list or map), in a collection with a plain-English name such as
// "users" or "deletion_requests". The document ID is the record's own ID.
//
// Two small helper fields keep records exact:
//   _order  a number that keeps records in the order they were first saved
//   _list   wraps a list that sits inside another list (Firestore can't store lists inside lists)
//   _json   holds very large technical maps or lists (e.g. thousands of translations) as text,
//           because Firestore limits how many fields one document can have
//
// Older versions stored records as JSON text in "te_<name>" collections ({ j, s }). Those are read once,
// re-saved in the readable format, and then removed (see db.js).
import crypto from 'node:crypto';
import { accessToken, projectId } from '../util/google.js';

const base = () => (process.env.FIRESTORE_BASE_URL || 'https://firestore.googleapis.com/v1').replace(/\/$/, '');
const root = () => `projects/${projectId()}/databases/(default)/documents`;

/** The plain-English Firestore collection for each of the app's record types. */
export const COLLECTION_NAMES = {
  users: 'users',
  otps: 'one_time_codes',
  passkeys: 'passkeys',
  challenges: 'passkey_challenges',
  addresses: 'protected_email_addresses',
  companies: 'companies',
  holdings: 'companies_holding_user_data',
  scans: 'inbox_scans',
  policies: 'privacy_policies',
  requests: 'deletion_requests',
  targets: 'deletion_requests_per_company',
  receipts: 'tamper_proof_receipts',
  batches: 'tamper_proof_seals',
  messages: 'messages',
  alerts: 'alerts',
  evidence: 'evidence_packs',
  complaints: 'complaints',
  certificates: 'deletion_certificates',
  chats: 'assistant_chats',
  outbox: 'email_outbox',
  staff: 'regulator_accounts',
  i18n: 'translations',
  aiLog: 'ai_usage_log',
  meta: 'app_settings',
  leaks: 'data_leaks',
  chatsIndex: 'assistant_chat_index',
  activity: 'user_activity_log',
  inquiries: 'board_inquiries',
  regaudit: 'officer_activity_log'
};
const readable = (c) => COLLECTION_NAMES[c] || c;

/** Firestore document IDs can't contain "/" and must be at most 1500 bytes. */
export function docId(id) {
  const s = String(id);
  return /^[A-Za-z0-9_\-.:@]{1,200}$/.test(s) && s !== '.' && s !== '..' ? s : 'h_' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 40);
}

// ---------- record <-> Firestore fields ----------
const BIG = 300; // maps or lists bigger than this are stored as text (Firestore field limits)
const okKey = (k) => k !== '' && !/^__.*__$/.test(k) && Buffer.byteLength(k) <= 1400;

function toValue(v, inList = false) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { stringValue: v.toISOString() };
  switch (typeof v) {
    case 'string': return { stringValue: v };
    case 'boolean': return { booleanValue: v };
    case 'number':
      if (!Number.isFinite(v)) return { nullValue: null }; // JSON turns NaN/Infinity into null too
      return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER ? { integerValue: String(v) } : { doubleValue: v };
    case 'object': {
      if (Array.isArray(v)) {
        if (v.length > BIG) return { mapValue: { fields: { _json: { stringValue: JSON.stringify(v) } } } };
        const arr = { arrayValue: { values: v.map(x => toValue(x, true)) } };
        return inList ? { mapValue: { fields: { _list: arr } } } : arr;
      }
      const keys = Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function');
      if (keys.length > BIG || !keys.every(okKey)) return { mapValue: { fields: { _json: { stringValue: JSON.stringify(v) } } } };
      const fields = {};
      for (const k of keys) fields[k] = toValue(v[k]);
      return { mapValue: { fields } };
    }
    default: return { nullValue: null };
  }
}

function fromValue(v) {
  if (!v || 'nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) {
    const f = v.mapValue.fields || {};
    const keys = Object.keys(f);
    if (keys.length === 1 && keys[0] === '_json') { try { return JSON.parse(f._json.stringValue); } catch { return null; } }
    if (keys.length === 1 && keys[0] === '_list') return fromValue(f._list);
    const out = {};
    for (const k of keys) out[k] = fromValue(f[k]);
    return out;
  }
  return null;
}

/** A record as Firestore document fields. */
export function encode(rec, order) {
  const fields = {};
  // Most useful fields first (the console sorts fields by name anyway, but the JSON text stays tidy)
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined || typeof v === 'function' || !okKey(k)) continue;
    fields[k] = toValue(v);
  }
  fields._order = { integerValue: String(order) };
  return fields;
}

/** Firestore document fields back into a record (with id first, like the app writes it). */
export function decode(fields) {
  const rec = {};
  if (fields.id) rec.id = fromValue(fields.id);
  for (const [k, v] of Object.entries(fields)) if (k !== '_order' && k !== 'id') rec[k] = fromValue(v);
  return { rec, order: Number(fields._order?.integerValue || 0) };
}

// ---------- REST calls ----------
async function call(method, url, body) {
  const token = await accessToken();
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${j.error?.message || text.slice(0, 200)}`);
  return j;
}

async function listDocs(collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const u = new URL(`${base()}/${root()}/${collectionPath}`);
    u.searchParams.set('pageSize', '300');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const j = await call('GET', u.toString());
    docs.push(...(j.documents || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/**
 * Every record of one collection, in the order they were first saved.
 * Returns { rows: [{ rec, order }], legacy: [document ids still in the old "te_" format] }.
 */
export async function loadCollection(name) {
  const docs = await listDocs(readable(name));
  const rows = docs.map(d => decode(d.fields || {})).filter(r => r.rec.id != null);
  // Anything still in the old JSON-text format (not moved yet, or a move that was interrupted)
  const legacy = [];
  const have = new Set(rows.map(r => String(r.rec.id)));
  const old = await listDocs(`te_${name}`).catch(() => []);
  for (const d of old) {
    legacy.push(d.name.split('/').pop());
    const json = d.fields?.j?.stringValue;
    if (!json) continue;
    try {
      const rec = JSON.parse(json);
      if (!have.has(String(rec.id))) rows.push({ rec, order: Number(d.fields?.s?.integerValue || 0), fromLegacy: true });
    } catch {}
  }
  rows.sort((a, b) => a.order - b.order);
  return { rows, legacy };
}

/**
 * Saves and deletes in batches (Firestore allows 500 writes per commit).
 * writes: [{ collection, id, rec, order }] or [{ collection, id, delete: true }] or [{ rawPath, delete: true }]
 */
export async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const chunk = writes.slice(i, i + 400).map(w => {
      const name = w.rawPath ? `${root()}/${w.rawPath}` : `${root()}/${readable(w.collection)}/${docId(w.id)}`;
      return w.delete ? { delete: name } : { update: { name, fields: encode(w.rec, w.order) } };
    });
    await call('POST', `${base()}/${root()}:commit`, { writes: chunk });
  }
}
