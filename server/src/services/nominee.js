// Nominee (Section 14, DPDP Act 2023): a person the user names to exercise their data rights, such as
// deletion, if they die or can no longer do it themselves. Adding, changing or removing a nominee is sealed as a
// signed receipt, so the nomination itself can be proved later. Demo accounts never contact the nominee.
import { db } from '../db.js';
import { bad } from '../http.js';
import { addReceipt } from './ledger.js';
import { nowIso } from './clock.js';

export const RELATIONS = ['Mother', 'Father', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Guardian', 'Friend', 'Other'];

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isPhone = (s) => s.replace(/\D/g, '').length >= 10 && /^[+\d][\d\s-]{8,}$/.test(s);

/** Shown on certificates and receipts instead of the full contact. */
export const maskContact = (c = '') => {
  if (isEmail(c)) { const [u, d] = c.split('@'); return `${u.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, u.length - 1)))}@${d}`; }
  const digits = c.replace(/\D/g, '');
  return digits ? '•••••• ' + digits.slice(-4) : '';
};

export const publicNominee = (n) => n ? { name: n.name, relation: n.relation, contact: n.contact, contactMasked: maskContact(n.contact), addedAt: n.addedAt, receiptId: n.receiptId || null } : null;

export function setNominee(user, body = {}) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const relation = String(body.relation || '').trim();
  const contact = String(body.contact || '').trim();
  if (name.length < 2 || name.length > 80) throw bad('Please enter your nominee\'s full name');
  if (name.toLowerCase() === String(user.name || '').trim().toLowerCase()) throw bad('Your nominee must be someone other than you');
  if (!RELATIONS.includes(relation)) throw bad('Please choose how this person is related to you');
  if (!isEmail(contact) && !isPhone(contact)) throw bad('Please enter your nominee\'s email address or mobile number');
  const contactLc = contact.toLowerCase();
  if (contactLc === String(user.email || '').toLowerCase() || (user.phone && contact.replace(/\D/g, '').slice(-10) === String(user.phone).replace(/\D/g, '').slice(-10))) throw bad('Use your nominee\'s own email or number, not yours');
  const changed = !!user.nominee;
  const receipt = addReceipt({
    userId: user.id, kind: 'nomination',
    title: changed ? 'Nominee changed (Section 14, DPDP Act)' : 'Nominee recorded (Section 14, DPDP Act)',
    data: { nominee: name, relation, contact: maskContact(contact), law: 'Section 14, Digital Personal Data Protection Act, 2023', rights: ['correction', 'erasure', 'grievance'], when: 'death or incapacity of the data principal' },
    signedBy: user.name
  });
  const nominee = { name, relation, contact, addedAt: nowIso(), receiptId: receipt.id };
  db.update('users', user.id, { nominee });
  return { nominee: publicNominee(nominee), receipt: { id: receipt.id, hash: receipt.hash } };
}

export function removeNominee(user) {
  if (!user.nominee) return { nominee: null };
  const receipt = addReceipt({
    userId: user.id, kind: 'nomination', title: 'Nominee removed (Section 14, DPDP Act)',
    data: { removed: user.nominee.name, relation: user.nominee.relation, law: 'Section 14, Digital Personal Data Protection Act, 2023' },
    signedBy: user.name
  });
  db.update('users', user.id, { nominee: null });
  return { nominee: null, receipt: { id: receipt.id, hash: receipt.hash } };
}
