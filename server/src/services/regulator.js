// Regulator console (Data Protection Board officers): cases, notices, decisions, company investigations.
// Every officer action is sealed in the tamper-proof ledger and logged in the officer audit trail.
// Prototype: notices are recorded in the Board's portal and are never emailed to real companies.
import { db } from '../db.js';
import { bad, notFound } from '../http.js';
import { generate, withFallback, maskFor } from '../ai/gemini.js';
import { addReceipt, verifyReceipt } from './ledger.js';
import { createAlert } from './notify.js';
import { withClockOf, nowIso, now, addDays } from './clock.js';

export const STATUSES = ['new', 'review', 'notice', 'decided', 'dismissed'];
const STATUS_LABEL = { new: 'New', review: 'Under review', notice: 'Notice sent', decided: 'Decided', dismissed: 'Dismissed' };

// DPDP Act 2023, Schedule: maximum penalty (₹ crore) for each kind of breach
export const PENALTY_CAPS = [
  { key: 'security', label: 'Failure to take reasonable security safeguards (Section 8(5))', max: 250 },
  { key: 'breach-notice', label: 'Failure to tell the Board and users about a breach (Section 8(6))', max: 200 },
  { key: 'children', label: "Breach of duties for children's data (Section 9)", max: 200 },
  { key: 'other', label: 'Breach of any other provision, e.g. not erasing data (Sections 8(7), 12)', max: 50 }
];

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const maskEmail = (e) => { const [u, d] = String(e || '').split('@'); return d ? `${u.slice(0, 1)}•••@${d}` : ''; };
const maskPhone = (p) => (p ? `••••••${String(p).replace(/\D/g, '').slice(-4)}` : '');

const filed = () => db.filter('complaints', c => c.status === 'filed');
const complainantOf = (c) => db.get('users', c.userId);
const caseOf = (rec) => ({ status: 'new', notes: [], notices: [], history: [], ...(rec.case || {}) });
const withUserClock = (c, fn) => withClockOf(complainantOf(c), fn);

function audit(staff, action, ref, detail = '') {
  db.insert('regaudit', { at: new Date().toISOString(), staffId: staff.id, staffEmail: staff.email, action, ref, detail });
}

function noticeState(n) {
  if (n.reply) return n.reply.complies === false ? 'disputed' : 'replied';
  return new Date(n.dueAt) < now() ? 'overdue' : 'awaiting';
}

// ---------- shared case actions (a complaint or a company investigation) ----------
const COLL = { complaint: 'complaints', inquiry: 'inquiries' };

function getCase(kind, id) {
  const rec = db.get(COLL[kind], id);
  if (!rec || (kind === 'complaint' && rec.status !== 'filed')) throw notFound(kind === 'complaint' ? 'Complaint not found' : 'Investigation not found');
  return rec;
}
// Run with the complainant's clock, so a demo account's moved-forward dates stay in order
const inClock = (kind, rec, fn) => (kind === 'complaint' ? withUserClock(rec, fn) : fn());
const refOf = (kind, rec) => (kind === 'complaint' ? rec.reference : rec.reference);

function pushHistory(kind, rec, staff, action, text, receiptId = null) {
  const cs = caseOf(rec);
  cs.history = [...cs.history, { at: nowIso(), by: staff.name || staff.email, action, text, receiptId }];
  db.update(COLL[kind], rec.id, { case: cs });
  audit(staff, action, refOf(kind, rec), text);
  return cs;
}

function tellComplainants(kind, rec, title, body) {
  const list = kind === 'complaint' ? [rec] : (rec.complaintIds || []).map(id => db.get('complaints', id)).filter(Boolean);
  for (const c of list) createAlert(c.userId, { type: 'complaint', severity: 'info', title, body, link: `/app/complaints/${c.id}` });
}

function seal(kind, rec, title, data) {
  const userId = kind === 'complaint' ? rec.userId : null;
  return addReceipt({ userId, kind: 'regulator', title, data: { reference: refOf(kind, rec), ...data }, signedBy: 'Data Protection Board (prototype)' });
}

export function setStatus(staff, kind, id, { status, note }) {
  const rec = getCase(kind, id);
  if (!STATUSES.includes(status)) throw bad('Unknown status');
  return inClock(kind, rec, () => {
    const cs = caseOf(rec);
    if (cs.status === status) return view(kind, rec.id);
    const r = seal(kind, rec, `${refOf(kind, rec)}: ${STATUS_LABEL[status]}`, { status, note: note || '' });
    db.update(COLL[kind], rec.id, { case: { ...cs, status, assignee: cs.assignee || staff.name || staff.email, ...(status === 'review' && !cs.takenAt ? { takenAt: nowIso() } : {}) } });
    pushHistory(kind, db.get(COLL[kind], rec.id), staff, 'status', `Marked "${STATUS_LABEL[status]}"${note ? `: ${note}` : ''}`, r.id);
    if (status === 'review') tellComplainants(kind, rec, `The Board has taken up ${refOf(kind, rec)}`, 'An officer of the Data Protection Board is now reviewing your complaint and its evidence.');
    return view(kind, rec.id);
  });
}

export function addNote(staff, kind, id, { text }) {
  const rec = getCase(kind, id);
  const body = String(text || '').trim().slice(0, 2000);
  if (!body) throw bad('Write a note first');
  return inClock(kind, rec, () => {
    const cs = caseOf(rec);
    db.update(COLL[kind], rec.id, { case: { ...cs, notes: [...cs.notes, { at: nowIso(), by: staff.name || staff.email, text: body }] } });
    audit(staff, 'note', refOf(kind, rec), body.slice(0, 120));
    return view(kind, rec.id);
  });
}

/** AI drafts a notice to a company asking it to explain itself and comply. */
export async function draftNotice(staff, kind, id, { company }) {
  const rec = getCase(kind, id);
  const parties = partiesOf(kind, rec);
  const party = parties.find(p => p.name === company) || parties[0];
  if (!party) throw bad('No company named in this case');
  const facts = kind === 'complaint' ? factsOf(rec) : rec.facts || [];
  const user = kind === 'complaint' ? complainantOf(rec) : null;
  const { mask, unmask } = maskFor(user);
  const days = 7;
  const res = await withFallback('regulator-notice', async () => generate({
    feature: 'regulator-notice',
    system: 'You draft formal notices from the Data Protection Board of India to a Data Fiduciary under the Digital Personal Data Protection Act, 2023. Plain, firm English. Use only the facts given. Never include the complainant\'s personal details. No markdown.',
    prompt: `Case ${refOf(kind, rec)} against ${party.name}. Issue: ${party.issue}.
Facts:\n${facts.map((f, i) => `${i + 1}. ${mask(f)}`).join('\n')}
Ask the company to: (a) explain in writing, (b) erase the personal data concerned and stop sharing it, (c) name every party it shared the data with, (d) reply within ${days} days.
Return JSON {"subject":"max 14 words","body":"the notice, 150-230 words, ends with 'Data Protection Board of India'"}`,
    json: true, temperature: 0.2
  }), () => ({
    subject: `Notice under the DPDP Act, 2023 in case ${refOf(kind, rec)}`,
    body: `To the Grievance Officer, ${party.name}

The Data Protection Board of India has received a complaint (${refOf(kind, rec)}) against ${party.name}: ${party.issue.toLowerCase()}.

The complaint is supported by sealed, tamper-proof evidence, including:
${facts.slice(0, 4).map(f => `- ${mask(f)}`).join('\n')}

Under the Digital Personal Data Protection Act, 2023, you are directed to, within ${days} days of this notice:
1. Explain in writing why the Data Principal's erasure request was not honoured.
2. Erase the personal data concerned and stop any further processing or sharing of it.
3. Name every party with whom this personal data was shared, and confirm that each has erased it.

Failure to respond may lead to an inquiry under Section 28 and a penalty under the Schedule to the Act.

Data Protection Board of India`
  }));
  return { company: party.name, subject: unmask(res.subject), body: unmask(res.body), days, ai: res._ai };
}

export function sendNotice(staff, kind, id, { company, subject, body, days = 7 }) {
  const rec = getCase(kind, id);
  if (!company || !String(body || '').trim()) throw bad('The notice is empty');
  const d = Math.min(30, Math.max(1, Number(days) || 7));
  return inClock(kind, rec, () => {
    const cs = caseOf(rec);
    const n = { id: 'N' + Date.now().toString(36), company, subject: String(subject || '').slice(0, 200), body: String(body).slice(0, 6000), sentAt: nowIso(), dueAt: addDays(nowIso(), d), days: d, by: staff.name || staff.email };
    const r = seal(kind, rec, `Notice to ${company} in ${refOf(kind, rec)}`, { company, subject: n.subject, body: n.body, dueAt: n.dueAt });
    n.receiptId = r.id;
    db.update(COLL[kind], rec.id, { case: { ...cs, status: ['decided', 'dismissed'].includes(cs.status) ? cs.status : 'notice', assignee: cs.assignee || staff.name || staff.email, notices: [...cs.notices, n] } });
    pushHistory(kind, db.get(COLL[kind], rec.id), staff, 'notice', `Notice sent to ${company}, reply due in ${d} days`, r.id);
    tellComplainants(kind, rec, `The Board sent a notice to ${company}`, `${company} must reply to the Data Protection Board within ${d} days about ${refOf(kind, rec)}.`);
    return view(kind, rec.id);
  });
}

/** Record a company's reply to a notice: pasted by the officer, or simulated in the prototype. */
export async function recordReply(staff, kind, id, noticeId, { text, simulate }) {
  const rec = getCase(kind, id);
  const cs = caseOf(rec);
  const n = cs.notices.find(x => x.id === noticeId);
  if (!n) throw notFound('Notice not found');
  if (n.reply) throw bad('A reply is already recorded for this notice');
  let body = String(text || '').trim();
  if (simulate) {
    body = simulate === 'comply'
      ? `Dear Board,\n\nWith reference to notice ${refOf(kind, rec)}, ${n.company} confirms that the Data Principal's personal data has been permanently erased from our systems and backups, except records we must keep under the Income-tax Act, 1961. We have instructed our processing partners (payment, delivery and analytics) to erase the same data and have received their confirmations. We regret the delay and have fixed our grievance process.\n\nGrievance Officer, ${n.company}`
      : `Dear Board,\n\n${n.company} received notice ${refOf(kind, rec)}. We believe we hold no personal data of this Data Principal. Any data held by third parties is their responsibility. We consider the matter closed.\n\nLegal team, ${n.company}`;
  }
  if (!body) throw bad('Paste the company\'s reply first');
  const res = await withFallback('regulator-reply', async () => generate({
    feature: 'regulator-reply',
    system: 'You help a data protection regulator read a company\'s reply to a notice. Judge only from the text.',
    prompt: `Notice asked the company to explain, erase the data, and name everyone it shared the data with.
Company reply:\n"""${body.slice(0, 4000)}"""
Return JSON {"complies":true|false,"summary":"max 35 words","gaps":["what the reply fails to do, max 3 short items"]}`,
    json: true, temperature: 0.1, fast: true
  }), () => {
    const lower = body.toLowerCase();
    const complies = /erased|deleted|removed/.test(lower) && !/no personal data|not our responsibility|their responsibility|closed/.test(lower);
    const gaps = [];
    if (!/erased|deleted|removed/.test(lower)) gaps.push('Does not confirm erasure');
    if (!/partner|third part|processor|shared/.test(lower) || /their responsibility/.test(lower)) gaps.push('Does not name who the data was shared with');
    return { complies, summary: complies ? 'The company confirms erasure and says its partners were told to erase too.' : 'The company does not accept responsibility or confirm erasure.', gaps };
  });
  return inClock(kind, rec, () => {
    const r = seal(kind, rec, `Reply from ${n.company} in ${refOf(kind, rec)}`, { company: n.company, reply: body, complies: !!res.complies });
    const reply = { at: nowIso(), text: body, complies: !!res.complies, summary: res.summary, gaps: res.gaps || [], ai: res._ai, simulated: !!simulate, receiptId: r.id };
    const fresh = caseOf(db.get(COLL[kind], rec.id));
    db.update(COLL[kind], rec.id, { case: { ...fresh, notices: fresh.notices.map(x => (x.id === n.id ? { ...x, reply } : x)) } });
    pushHistory(kind, db.get(COLL[kind], rec.id), staff, 'reply', `${n.company} replied${simulate ? ' (simulated)' : ''}: ${reply.complies ? 'complies' : 'does not comply'}`, r.id);
    return view(kind, rec.id);
  });
}

/** AI assessment of a case: which duties were broken, how strong the evidence is, what to do. */
export async function assess(staff, kind, id) {
  const rec = getCase(kind, id);
  const parties = partiesOf(kind, rec);
  const facts = kind === 'complaint' ? factsOf(rec) : rec.facts || [];
  const ev = kind === 'complaint' ? evidenceOf(rec) : [];
  const verified = ev.filter(e => e.verified).length;
  const user = kind === 'complaint' ? complainantOf(rec) : null;
  const { mask, unmask } = maskFor(user);
  const cs = caseOf(rec);
  const replies = cs.notices.filter(n => n.reply).map(n => `${n.company}: ${n.reply.complies ? 'complied' : 'did not comply'} (${n.reply.summary})`);
  const overdue = cs.notices.filter(n => noticeState(n) === 'overdue').map(n => n.company);
  const res = await withFallback('regulator-assess', async () => generate({
    feature: 'regulator-assess',
    system: 'You assist an officer of the Data Protection Board of India. Assess complaints under the Digital Personal Data Protection Act, 2023 using only the facts given. Be careful and fair. The officer decides, not you.',
    prompt: `Case ${refOf(kind, rec)}. Respondents: ${JSON.stringify(parties)}.
Facts:\n${facts.map((f, i) => `${i + 1}. ${mask(f)}`).join('\n')}
Evidence items: ${ev.length}, of which ${verified} verified against the tamper-proof ledger.
Notice replies: ${replies.join('; ') || 'none yet'}. Notices overdue: ${overdue.join(', ') || 'none'}.
Return JSON {"summary":"max 45 words","strength":"strong|moderate|weak","breaches":[{"section":"e.g. Section 12(3)","what":"max 18 words"}],"recommendation":"max 30 words","nextStep":"review|notice|decide"}`,
    json: true, temperature: 0.2
  }), () => {
    const breaches = [];
    if (parties.some(p => /ignored deletion/i.test(p.issue))) breaches.push({ section: 'Section 12(3) and 8(7)', what: 'Did not erase personal data after a valid erasure request' });
    if (parties.some(p => /passed data on|shared/i.test(p.issue))) breaches.push({ section: 'Section 8(7)(b)', what: 'Did not make its processors erase data it had shared' });
    if (parties.some(p => /never given/i.test(p.issue))) breaches.push({ section: 'Section 8(5)', what: 'Personal data reached a party the user never dealt with, suggesting weak safeguards' });
    if (overdue.length) breaches.push({ section: 'Section 36', what: `Did not answer the Board's notice in time (${overdue.join(', ')})` });
    const strength = verified >= 3 ? 'strong' : verified >= 1 ? 'moderate' : 'weak';
    const anyReply = cs.notices.some(n => n.reply);
    return {
      summary: `${parties.map(p => p.name).join(' and ')}: ${parties.map(p => p.issue.toLowerCase()).join('; ')}. ${verified} of ${ev.length} evidence items are verified as unchanged in the tamper-proof log.`,
      strength, breaches,
      recommendation: !cs.notices.length ? 'Send a notice asking each company to explain, erase the data and name who it shared it with.' : anyReply ? 'Review the replies and decide: direct erasure, accept an undertaking, or impose a penalty.' : 'Wait for the replies; if the deadline passes, move to a decision.',
      nextStep: !cs.notices.length ? 'notice' : anyReply || overdue.length ? 'decide' : 'review'
    };
  });
  const assessment = { ...res, summary: unmask(res.summary), recommendation: unmask(res.recommendation), at: inClock(kind, rec, () => nowIso()), ai: res._ai };
  delete assessment._ai; delete assessment._aiError;
  db.update(COLL[kind], rec.id, { case: { ...caseOf(rec), assessment } });
  audit(staff, 'assess', refOf(kind, rec), 'AI assessment');
  return view(kind, rec.id);
}

export function decide(staff, kind, id, { outcome, directions, penaltyCrore, penaltyKind, days }) {
  const rec = getCase(kind, id);
  if (!['direct', 'undertaking', 'penalty', 'dismiss'].includes(outcome)) throw bad('Choose an outcome');
  const cap = PENALTY_CAPS.find(p => p.key === penaltyKind) || PENALTY_CAPS[3];
  const amount = outcome === 'penalty' ? Number(penaltyCrore) : 0;
  if (outcome === 'penalty' && (!(amount > 0) || amount > cap.max)) throw bad(`The penalty must be more than 0 and at most ₹${cap.max} crore for this breach`);
  const text = String(directions || '').trim().slice(0, 3000);
  if (outcome !== 'dismiss' && !text) throw bad('Write the directions to the company');
  return inClock(kind, rec, () => {
    const cs = caseOf(rec);
    const LABEL = { direct: 'Directions issued', undertaking: 'Voluntary undertaking accepted', penalty: 'Penalty imposed', dismiss: 'Complaint closed' };
    const decision = {
      outcome, label: LABEL[outcome], directions: text || 'The Board found no grounds to act on the evidence provided.',
      penaltyCrore: amount || null, penaltyKind: outcome === 'penalty' ? cap.key : null, penaltyLabel: outcome === 'penalty' ? cap.label : null,
      complyBy: outcome === 'dismiss' ? null : addDays(nowIso(), Math.min(90, Math.max(1, Number(days) || 15))),
      at: nowIso(), by: staff.name || staff.email, order: `DPB/ORD/${now().getFullYear()}/${String(db.all('regaudit').filter(a => a.action === 'decision').length + 101)}`
    };
    const r = seal(kind, rec, `Order ${decision.order}: ${decision.label}`, { outcome, directions: decision.directions, penaltyCrore: decision.penaltyCrore, against: partiesOf(kind, rec).map(p => p.name) });
    decision.receiptId = r.id;
    db.update(COLL[kind], rec.id, { case: { ...cs, status: outcome === 'dismiss' ? 'dismissed' : 'decided', decision } });
    pushHistory(kind, db.get(COLL[kind], rec.id), staff, 'decision', `${decision.label}${amount ? ` (₹${amount} crore)` : ''}`, r.id);
    tellComplainants(kind, rec, outcome === 'dismiss' ? `The Board closed ${refOf(kind, rec)}` : `The Board decided ${refOf(kind, rec)}`,
      outcome === 'dismiss' ? 'The Board found no grounds to act. You can file a fresh complaint with new evidence.' : `${decision.label}${amount ? `: a penalty of ₹${amount} crore` : ''}. ${partiesOf(kind, rec).map(p => p.name).join(' and ')} must comply by ${fmt(decision.complyBy)}.`);
    return view(kind, rec.id);
  });
}

// ---------- complaint details ----------
function partiesOf(kind, rec) {
  return kind === 'complaint' ? rec.parties : (rec.parties || [{ name: rec.company, issue: rec.reason }]);
}

function factsOf(c) {
  const out = [];
  const pack = db.get('evidence', c.packId);
  const target = pack?.targetId && db.get('targets', pack.targetId);
  if (target) {
    const company = db.get('companies', target.companyId);
    const req = db.get('requests', target.requestId);
    const via = target.viaCompanyId && db.get('companies', target.viaCompanyId);
    if (req?.signedAt) out.push(`On ${fmt(req.signedAt)} the complainant asked ${via ? `${via.name} and its partners` : company?.name} to erase their personal data (request ${req.number})${req.signature ? ', signed with a passkey' : ''}.`);
    if (via) out.push(`${via.name} replied in writing that it had shared the data with ${company?.name}, which then got its own erasure request.`);
    if (target.reminderAt) out.push(`A reminder was sent on ${fmt(target.reminderAt)} with no reply.`);
    if (target.grievanceAt) out.push(`A formal grievance was sent on ${fmt(target.grievanceAt)} and was ignored.`);
  }
  const leak = pack?.leakId && db.get('leaks', pack.leakId);
  if (leak) {
    out.push(`On ${fmt(leak.at)}, ${leak.senderName || leak.senderDomain} emailed an address the complainant had given only to ${db.get('companies', leak.companyId)?.name}.`);
    if (leak.investigation?.likelySourceName) out.push(`The leak investigation points to ${leak.investigation.likelySourceName} (${leak.investigation.confidence} confidence).`);
  }
  if (!out.length && c.summary) out.push(c.summary);
  return out;
}

function evidenceOf(c) {
  const pack = db.get('evidence', c.packId);
  const items = [...(pack?.items || [])];
  if (c.receiptId) items.push({ receiptId: c.receiptId, label: 'The complaint as filed', proves: 'Proves what was filed and when', source: 'Complainant', at: c.filedAt });
  return items.map(i => {
    const v = verifyReceipt(i.receiptId);
    return { ...i, verified: !!v.valid, sealed: !!v.anchored, intact: !!v.intact, hash: v.receipt?.hash || i.hash };
  });
}

function timelineOf(c) {
  const out = [];
  const pack = db.get('evidence', c.packId);
  const target = pack?.targetId && db.get('targets', pack.targetId);
  if (target) {
    const company = db.get('companies', target.companyId);
    const req = db.get('requests', target.requestId);
    const via = target.viaCompanyId && db.get('companies', target.viaCompanyId);
    if (req?.signedAt) out.push({ at: req.signedAt, title: 'Erasure request signed', sub: `Sent to ${via ? via.name : company?.name}`, tone: 'done', icon: 'finger' });
    if (via && target.sentAt) out.push({ at: target.sentAt, title: `${via.name} named ${company?.name} as a partner`, sub: `Request passed on to ${company?.name}`, tone: 'done', icon: 'share' });
    if (target.reminderAt) out.push({ at: target.reminderAt, title: 'Reminder sent (day 7)', sub: 'No reply', tone: 'warn', icon: 'bell' });
    if (target.grievanceAt) out.push({ at: target.grievanceAt, title: 'Grievance sent (day 10)', sub: 'Ignored', tone: 'warn', icon: 'flag' });
  }
  const leak = pack?.leakId && db.get('leaks', pack.leakId);
  if (leak) out.push({ at: leak.at, title: `Leak caught: ${leak.senderName || leak.senderDomain}`, sub: `Used a ${db.get('companies', leak.companyId)?.name}-only address`, tone: 'warn', icon: 'siren' });
  if (pack) out.push({ at: pack.builtAt, title: `Evidence pack ${pack.number} built`, sub: `${pack.items.length} sealed items`, tone: 'done', icon: 'layers' });
  out.push({ at: c.filedAt, title: `Complaint ${c.reference} filed`, sub: c.autoFiled ? 'Filed automatically after the deadline' : 'Filed by the complainant', tone: 'done', icon: 'scale' });
  for (const h of caseOf(c).history) out.push({ at: h.at, title: h.text, sub: `Board · ${h.by}`, tone: h.action === 'decision' ? 'done' : 'current', icon: h.action === 'notice' ? 'send' : h.action === 'reply' ? 'mail' : h.action === 'decision' ? 'scale' : 'check', board: true });
  return out.sort((a, b) => new Date(a.at) - new Date(b.at));
}

function view(kind, id) {
  return kind === 'complaint' ? complaintDetail(id) : inquiryDetail(id);
}

function listRow(c) {
  const cs = caseOf(c);
  const u = complainantOf(c);
  return {
    id: c.id, reference: c.reference, against: c.parties.map(p => p.name), issue: c.parties.map(p => p.issue).join('; '),
    evidence: (db.get('evidence', c.packId)?.items || []).length, filedAt: c.filedAt, autoFiled: !!c.autoFiled,
    status: cs.status, assignee: cs.assignee || null, demo: !!u?.demo,
    noticesOverdue: cs.notices.filter(n => noticeState(n) === 'overdue').length,
    dueAt: cs.notices.filter(n => !n.reply).map(n => n.dueAt).sort()[0] || null,
    inquiryId: c.inquiryId || null
  };
}

export function listComplaints() {
  return filed().map(c => withUserClock(c, () => listRow(c))).reverse();
}

export function complaintDetail(id) {
  const c = getCase('complaint', id);
  return withUserClock(c, () => {
    const u = complainantOf(c);
    const cs = caseOf(c);
    return {
      ...listRow(c), kind: 'complaint',
      summary: c.summary, asks: c.asks || [], to: c.to, receiptId: c.receiptId,
      complainant: u ? { name: u.name, email: maskEmail(u.email), phone: maskPhone(u.phone), since: u.createdAt, demo: !!u.demo, passkey: db.filter('passkeys', p => p.userId === u.id).length > 0 } : null,
      parties: c.parties.map(p => ({ ...p, key: slug(p.name) })),
      facts: factsOf(c), evidence: evidenceOf(c), timeline: timelineOf(c),
      pack: (() => { const p = db.get('evidence', c.packId); return p ? { id: p.id, number: p.number, title: p.title, receiptId: p.receiptId } : null; })(),
      case: { ...cs, notices: cs.notices.map(n => ({ ...n, state: noticeState(n) })) },
      inquiry: c.inquiryId ? (() => { const q = db.get('inquiries', c.inquiryId); return q && { id: q.id, reference: q.reference, company: q.company }; })() : null,
      penaltyCaps: PENALTY_CAPS,
      today: nowIso()
    };
  });
}

// ---------- companies ----------
function companyIndex() {
  const map = new Map();
  const get = (name) => {
    const key = slug(name);
    if (!map.has(key)) {
      const co = db.find('companies', x => x.name === name);
      map.set(key, { key, name, companyId: co?.id || null, category: co?.category || 'Unknown', domain: co?.domains?.[0] || '', complaints: [], leaks: 0, ignored: 0, requests: 0, resolved: 0, senders: new Set() });
    }
    return map.get(key);
  };
  for (const c of filed()) for (const p of c.parties) get(p.name).complaints.push(c.id);
  for (const l of db.all('leaks')) {
    const n = l.investigation?.likelySourceName;
    if (n) { const e = get(n); e.leaks++; if (l.senderName) e.senders.add(l.senderName); }
  }
  for (const t of db.filter('targets', x => x.sentAt)) {
    const co = db.get('companies', t.companyId);
    if (!co) continue;
    if (!map.has(slug(co.name)) && t.status !== 'overdue') continue;
    const e = get(co.name);
    e.requests++;
    if (t.status === 'overdue') e.ignored++;
    if (['verified', 'claimed', 'partial'].includes(t.status)) e.resolved++;
  }
  return map;
}

function riskOf(e) {
  const score = e.complaints.length * 3 + e.ignored * 2 + e.leaks * 2;
  return score >= 8 ? 'high' : score >= 3 ? 'medium' : 'low';
}

export function listCompanies() {
  const idx = companyIndex();
  const open = db.all('inquiries');
  return [...idx.values()].map(e => ({
    key: e.key, name: e.name, category: e.category, domain: e.domain,
    complaints: e.complaints.length, leaks: e.leaks, ignored: e.ignored, requests: e.requests, resolved: e.resolved,
    risk: riskOf(e), inquiry: (() => { const q = open.filter(q => q.key === e.key).at(-1); return q ? { id: q.id, reference: q.reference, status: caseOf(q).status } : null; })()
  })).sort((a, b) => (b.complaints * 3 + b.ignored * 2 + b.leaks * 2) - (a.complaints * 3 + a.ignored * 2 + a.leaks * 2));
}

export function companyDetail(key) {
  let e = companyIndex().get(key);
  if (!e) {
    const co = db.find('companies', x => slug(x.name) === key);
    if (!co) throw notFound('No company with this name in the Board\'s records');
    e = { key, name: co.name, companyId: co.id, category: co.category || 'Unknown', domain: co.domains?.[0] || '', complaints: [], leaks: 0, ignored: 0, requests: db.filter('targets', t => t.companyId === co.id && t.sentAt).length, resolved: db.filter('targets', t => t.companyId === co.id && ['verified', 'claimed', 'partial'].includes(t.status)).length, senders: new Set() };
  }
  const co = e.companyId && db.get('companies', e.companyId);
  const leaks = db.filter('leaks', l => slug(l.investigation?.likelySourceName) === key).map(l => ({
    id: l.id, at: l.at, sender: l.senderName || l.senderDomain, app: db.get('companies', l.companyId)?.name, confidence: l.investigation.confidence, reasons: l.investigation.reasons || []
  }));
  return {
    key, name: e.name, category: e.category, domain: e.domain, fictional: !!co?.fictional,
    stats: { complaints: e.complaints.length, leaks: e.leaks, ignored: e.ignored, requests: e.requests, resolved: e.resolved },
    risk: riskOf(e), senders: [...e.senders],
    complaints: e.complaints.map(id => db.get('complaints', id)).filter(Boolean).map(c => withUserClock(c, () => listRow(c))).reverse(),
    leaks,
    partnerTypes: co?.partnerTypes || [], dataTypes: co?.dataTypes || [],
    inquiries: db.filter('inquiries', q => q.key === key).map(q => ({ id: q.id, reference: q.reference, status: caseOf(q).status, openedAt: q.openedAt })).reverse()
  };
}

export function openInquiry(staff, key, { reason }) {
  const d = companyDetail(key);
  const existing = db.find('inquiries', q => q.key === key && !['decided', 'dismissed'].includes(caseOf(q).status));
  if (existing) return inquiryDetail(existing.id);
  const reference = `DPB-INQ-${new Date().getFullYear()}-${String(db.all('inquiries').length + 1).padStart(3, '0')}`;
  const issue = reason?.trim() || [d.stats.complaints && `${d.stats.complaints} complaint${d.stats.complaints === 1 ? '' : 's'}`, d.stats.ignored && `${d.stats.ignored} ignored erasure request${d.stats.ignored === 1 ? '' : 's'}`, d.stats.leaks && `${d.stats.leaks} traced leak${d.stats.leaks === 1 ? '' : 's'}`].filter(Boolean).join(', ');
  const facts = [
    ...(d.stats.complaints ? [`${d.stats.complaints} complaint(s) name ${d.name}: ${d.complaints.map(c => c.reference).join(', ')}.`] : []),
    ...(d.stats.ignored ? [`${d.stats.ignored} erasure request(s) to ${d.name} passed the deadline with no reply.`] : []),
    ...(d.stats.leaks ? [`${d.stats.leaks} leak(s) were traced to ${d.name}, reaching ${d.senders.join(', ') || 'unknown senders'}.`] : [])
  ];
  const q = db.insert('inquiries', {
    key, company: d.name, reference, reason: issue || 'Pattern found across complaints', facts,
    complaintIds: d.complaints.map(c => c.id), parties: [{ name: d.name, issue: 'Pattern of non-compliance: ' + (issue || 'see facts') }],
    openedAt: new Date().toISOString(), openedBy: staff.name || staff.email,
    case: { status: 'review', notes: [], notices: [], history: [], assignee: staff.name || staff.email }
  });
  const r = seal('inquiry', q, `Inquiry ${reference} opened into ${d.name}`, { company: d.name, complaints: d.complaints.map(c => c.reference), reason: q.reason });
  for (const id of q.complaintIds) { const c = db.get('complaints', id); if (c && !c.inquiryId) db.update('complaints', id, { inquiryId: q.id }); }
  pushHistory('inquiry', q, staff, 'opened', `Inquiry opened into ${d.name}, joining ${q.complaintIds.length} complaint(s)`, r.id);
  tellComplainants('inquiry', q, `The Board opened an inquiry into ${d.name}`, `Your complaint is now part of inquiry ${reference}, together with others about the same company.`);
  return inquiryDetail(q.id);
}

export function inquiryDetail(id) {
  const q = getCase('inquiry', id);
  const cs = caseOf(q);
  return {
    kind: 'inquiry', id: q.id, reference: q.reference, company: q.company, key: q.key, reason: q.reason, facts: q.facts,
    openedAt: q.openedAt, openedBy: q.openedBy, status: cs.status, parties: q.parties,
    complaints: q.complaintIds.map(cid => db.get('complaints', cid)).filter(Boolean).map(c => withUserClock(c, () => listRow(c))),
    case: { ...cs, notices: cs.notices.map(n => ({ ...n, state: noticeState(n) })) },
    timeline: [{ at: q.openedAt, title: `Inquiry ${q.reference} opened`, sub: `By ${q.openedBy}`, tone: 'done', icon: 'scale' },
      ...cs.history.filter(h => h.action !== 'opened').map(h => ({ at: h.at, title: h.text, sub: `Board · ${h.by}`, tone: h.action === 'decision' ? 'done' : 'current', icon: h.action === 'notice' ? 'send' : h.action === 'reply' ? 'mail' : h.action === 'decision' ? 'scale' : 'check', board: true }))],
    penaltyCaps: PENALTY_CAPS
  };
}

export function listInquiries() {
  return db.all('inquiries').map(q => ({ id: q.id, reference: q.reference, company: q.company, key: q.key, status: caseOf(q).status, openedAt: q.openedAt, complaints: q.complaintIds.length })).reverse();
}

// ---------- notices across all cases ----------
export function listNotices() {
  const out = [];
  for (const c of filed()) withUserClock(c, () => { for (const n of caseOf(c).notices) out.push({ ...n, state: noticeState(n), caseKind: 'complaint', caseId: c.id, reference: c.reference }); });
  for (const q of db.all('inquiries')) for (const n of caseOf(q).notices) out.push({ ...n, state: noticeState(n), caseKind: 'inquiry', caseId: q.id, reference: q.reference });
  return out.map(({ body, ...n }) => ({ ...n, preview: body.slice(0, 160) })).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

export function auditLog() {
  return db.all('regaudit').slice(-300).reverse();
}

/** Small numbers for the overview cards. */
export function workload() {
  const rows = listComplaints();
  const notices = listNotices();
  return {
    awaiting: rows.filter(r => r.status === 'new').length,
    inReview: rows.filter(r => ['review', 'notice'].includes(r.status)).length,
    decided: rows.filter(r => ['decided', 'dismissed'].includes(r.status)).length,
    noticesOpen: notices.filter(n => n.state === 'awaiting').length,
    noticesOverdue: notices.filter(n => n.state === 'overdue').length,
    inquiries: db.all('inquiries').filter(q => !['decided', 'dismissed'].includes(caseOf(q).status)).length,
    penaltiesCrore: [...filed(), ...db.all('inquiries')].reduce((s, r) => s + (caseOf(r).decision?.penaltyCrore || 0), 0)
  };
}

export { slug as companyKey };
