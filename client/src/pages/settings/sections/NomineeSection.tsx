// Nominee (Section 14, DPDP Act 2023): someone who can use your data rights, like deletion, if you die or
// cannot do it yourself. Saving or removing a nominee is sealed as a signed receipt.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useSession } from '@/lib/session';
import { del, put } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { ActionButton, ButtonLink, Field, Icon, Input, Select, Tile, Well, useToast } from '@/components/ui';
import { SettingsCard } from './SettingsCard';

const RELATIONS = ['Mother', 'Father', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Guardian', 'Friend', 'Other'];

export function NomineeSection() {
  const t = useT();
  const toast = useToast();
  const { user, refresh } = useSession();
  const n = user?.nominee || null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [contact, setContact] = useState('');
  if (!user) return null;

  const startEdit = () => { setName(n?.name || ''); setRelation(n?.relation || ''); setContact(n?.contact || ''); setEditing(true); };
  const save = async () => {
    await put('/me/nominee', { name, relation, contact });
    await refresh();
    setEditing(false);
    toast(t('Nominee saved and sealed as a receipt'));
  };
  const remove = async () => {
    await del('/me/nominee');
    await refresh();
    toast(t('Nominee removed'));
  };

  return (
    <SettingsCard id="nominee" title={t('Nominee')} description={t('Choose someone you trust, like a parent or spouse. Under Section 14 of the DPDP Act, they can ask companies to delete your data if you die or cannot do it yourself, just like a nominee on a bank account.')}>
      {!editing && n && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-soft/60 p-4">
          <Tile icon="users" tone="accent" />
          <span className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-bold" translate="no">{n.name}</span>
            <span className="text-sm text-mute">{t(n.relation)} · <span translate="no">{n.contact}</span> · {t('Added {date}', { date: fmtDate(n.addedAt, { year: true }) })}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {n.receiptId && <ButtonLink to={`/app/receipts/${n.receiptId}`} variant="secondary" size="sm"><Icon name="shieldc" size="sm" />{t('Sealed receipt')}</ButtonLink>}
            <ActionButton variant="secondary" size="sm" onClick={async () => startEdit()}>{t('Change')}</ActionButton>
            <ActionButton variant="ghost" size="sm" onClick={remove}>{t('Remove')}</ActionButton>
          </div>
        </div>
      )}

      {!editing && !n && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-line2 p-4">
          <Tile icon="users" tone="neutral" />
          <span className="min-w-[200px] flex-1 text-sm text-ink2">{t('No nominee yet. Adding one takes a minute, and you can change it any time.')}</span>
          <ActionButton size="sm" onClick={async () => startEdit()}><Icon name="plus" size="sm" />{t('Add a nominee')}</ActionButton>
        </div>
      )}

      {editing && (
        <form className="flex flex-col gap-4" onSubmit={e => e.preventDefault()}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('Full name')} htmlFor="nominee-name">
              <Input id="nominee-name" value={name} onChange={e => setName(e.target.value)} placeholder={t('For example, Ravi Verma')} autoComplete="off" />
            </Field>
            <Field label={t('Relation to you')} htmlFor="nominee-relation">
              <Select id="nominee-relation" value={relation} onChange={e => setRelation(e.target.value)}>
                <option value="">{t('Choose…')}</option>
                {RELATIONS.map(r => <option key={r} value={r}>{t(r)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t('Their email or mobile number')} htmlFor="nominee-contact" hint={user.demo ? t('Demo account: nothing is sent to this person.') : t('We only contact them if they need to act for you.')}>
            <Input id="nominee-contact" value={contact} onChange={e => setContact(e.target.value)} placeholder="ravi@example.com" autoComplete="off" />
          </Field>
          <Well className="flex-row items-start gap-2.5 text-sm text-ink2"><Icon name="shieldc" size="sm" className="mt-0.5 flex-none text-accent" />{t('Saving creates a signed, tamper-proof receipt of your nomination, so it can be proved later.')}</Well>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={!name.trim() || !relation || !contact.trim()} onClick={save}><Icon name="check" size="sm" />{t('Save nominee')}</ActionButton>
            <ActionButton variant="ghost" onClick={async () => setEditing(false)}>{t('Cancel')}</ActionButton>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
