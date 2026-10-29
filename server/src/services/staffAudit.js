// Officer activity log for the regulator console: sign-ins, sign-outs, failed attempts,
// every page an officer opens, receipts checked, AI drafts and every case action.
import { db } from '../db.js';

const TYPE = {
  login: 'session', logout: 'session', 'login-failed': 'session',
  view: 'view', verify: 'view',
  status: 'case', note: 'case', notice: 'case', reply: 'case', decision: 'case', opened: 'case',
  assess: 'ai', draft: 'ai'
};

/** A short description of the browser and device, e.g. "Chrome on macOS". */
export function deviceOf(req) {
  const ua = String(req?.headers?.['user-agent'] || '');
  if (!ua) return '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

// Pages are re-loaded every few seconds while open, so a view is logged once per 10 minutes.
const lastView = new Map();

export function audit(staff, action, ref = '', detail = '', extra = {}) {
  if (!staff) return null;
  // A new session starts fresh, so every page opened after signing in is logged again
  if (action === 'login' || action === 'logout') for (const k of [...lastView.keys()]) if (k.startsWith(staff.id + '|')) lastView.delete(k);
  // The same receipt check twice within a minute is one check
  if (action === 'verify') {
    const key = `${staff.id}|verify|${ref}`;
    if (Date.now() - (lastView.get(key) || 0) < 60 * 1000) return null;
    lastView.set(key, Date.now());
  }
  return db.insert('regaudit', {
    at: new Date().toISOString(), staffId: staff.id, staffEmail: staff.email,
    action, type: TYPE[action] || 'case', ref: ref || '', detail: String(detail || '').slice(0, 300), ...extra
  });
}

export function auditView(staff, title, ref = '', link = null) {
  if (!staff) return;
  const key = `${staff.id}|${title}|${ref}`;
  const t = Date.now();
  if (t - (lastView.get(key) || 0) < 10 * 60 * 1000) return;
  lastView.set(key, t);
  audit(staff, 'view', ref, title, { link });
}

/** What a successful console request means, for the officer log. */
export function describeStaffRequest(req, out) {
  const s = req.staff;
  const p = req.routePattern, m = req.method;
  if (!s || m !== 'GET') {
    if (m === 'POST' && /\/notice\/draft$/.test(p || '') && s) audit(s, 'draft', out?.company ? `${out.company}` : '', `AI drafted a notice to ${out?.company || 'a company'}`);
    return;
  }
  const V = {
    '/api/regulator/overview': () => ['Opened the overview', '', '/regulator'],
    '/api/regulator/complaints': () => ['Opened the complaint queue', '', '/regulator/complaints'],
    '/api/regulator/complaints/:id': () => [`Opened complaint ${out?.reference || ''}`, out?.reference, `/regulator/complaints/${req.params.id}`],
    '/api/regulator/companies': () => ['Opened the companies list', '', '/regulator/companies'],
    '/api/regulator/companies/:key': () => [`Opened company record: ${out?.name || req.params.key}`, out?.name, `/regulator/companies/${req.params.key}`],
    '/api/regulator/inquiries/:id': () => [`Opened inquiry ${out?.reference || ''}`, out?.reference, `/regulator/inquiries/${req.params.id}`],
    '/api/regulator/notices': () => ['Opened notices and inquiries', '', '/regulator/notices'],
    '/api/regulator/scores': () => ['Opened public company scores', '', '/regulator/scores'],
    '/api/regulator/audit': () => ['Opened officer activity', '', '/regulator/activity']
  };
  const f = V[p];
  if (f) { const [title, ref, link] = f(); auditView(s, title, ref || '', link); }
}
