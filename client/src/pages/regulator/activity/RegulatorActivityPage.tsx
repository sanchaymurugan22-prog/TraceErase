// Regulator console: audit trail of everything officers do (sign-ins, pages opened, receipts checked, AI use, case actions).
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { Link } from '@/lib/router';
import { useSession } from '@/lib/session';
import { fmtDate, fmtTime } from '@/lib/format';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { Card, Chip, EmptyState, ErrorBox, Icon, PageLoading, Segmented, type IconName, type Tone } from '@/components/ui';
import { PageHead } from '../shared';

const ACTION: Record<string, [string, IconName, Tone]> = {
  login: ['Signed in', 'login', 'ok'], logout: ['Signed out', 'logout', 'neutral'], 'login-failed': ['Failed sign-in', 'alert', 'leak'],
  view: ['Opened a page', 'eye', 'neutral'], verify: ['Checked a receipt', 'shieldc', 'accent'],
  assess: ['AI assessment', 'sparkle', 'accent'], draft: ['AI drafted a notice', 'sparkle', 'accent'],
  status: ['Status changed', 'check', 'clm'], note: ['Note added', 'edit', 'neutral'], notice: ['Notice sent', 'send', 'part'],
  reply: ['Reply recorded', 'mail', 'part'], decision: ['Decision', 'scale', 'ok'], opened: ['Inquiry opened', 'layers', 'leak']
};
const FILTERS: [string, string][] = [['all', 'Everything'], ['session', 'Sign-ins'], ['case', 'Case actions'], ['ai', 'AI'], ['view', 'Pages and receipts']];

export default function RegulatorActivityPage() {
  const t = useT();
  const { staff } = useSession();
  const [f, setF] = useState('all');
  const [mine, setMine] = useState(false);
  const { data, loading, error } = useApi<any[]>('/regulator/audit', { interval: 20000 });
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !data) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  const rows = data.filter(a => (f === 'all' || a.type === f) && (!mine || a.staffEmail === staff?.email));
  const count = (k: string) => data.filter(a => (k === 'all' || a.type === k) && (!mine || a.staffEmail === staff?.email)).length;
  // group by day
  const days: [string, any[]][] = [];
  for (const a of rows) { const d = fmtDate(a.at, { year: true }); const last = days.at(-1); if (last && last[0] === d) last[1].push(a); else days.push([d, [a]]); }

  return (
    <RegulatorShell>
      <PageHead kicker="Regulator console" title={t('Officer activity')} sub={t('Everything done in this console, newest first: sign-ins, pages opened, receipts checked, AI use and case actions. Case actions are also sealed in the tamper-proof log.')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={f} onChange={setF} options={FILTERS.map(([k, l]) => ({ value: k, label: <>{t(l)} <span className="text-mute">{count(k)}</span></> }))} />
        <Segmented value={mine ? 'me' : 'all'} onChange={v => setMine(v === 'me')} options={[{ value: 'all', label: t('All officers') }, { value: 'me', label: t('Only me') }]} />
      </div>
      {!rows.length ? <Card><EmptyState icon="clock" title="Nothing here yet">{t('Actions will appear here as officers use the console.')}</EmptyState></Card> : days.map(([day, items]) => (
        <Card key={day} className="gap-0 overflow-hidden p-0">
          <div className="border-b border-line bg-soft px-6 py-3 text-sm font-bold text-ink2">{day}</div>
          {items.map(a => {
            const [label, icon, tone] = ACTION[a.action] || [a.action, 'dot', 'neutral'];
            const body = (
              <div className="flex items-start gap-4 px-6 py-3.5">
                <span className="w-[68px] flex-none pt-1 text-[13px] text-mute">{fmtTime(a.at)}</span>
                <Chip tone={tone} icon={icon} className="mt-0.5 w-[170px] justify-start max-[820px]:w-auto">{t(label)}</Chip>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] text-ink">{t(a.detail || label)}</span>
                  <span className="text-[12.5px] text-mute"><span translate="no">{a.staffEmail}</span>{a.staffEmail === staff?.email ? ` · ${t('you')}` : ''}{a.ref && !String(a.detail).includes(a.ref) ? <> · <span className="font-mono" translate="no">{a.ref}</span></> : null}</span>
                </div>
                {a.link && <Icon name="cr" size="sm" className="mt-1 flex-none text-mute" />}
              </div>
            );
            return <div key={a.id} className="border-b border-line last:border-b-0">{a.link ? <Link to={a.link} className="block text-ink no-underline hover:bg-soft hover:text-ink">{body}</Link> : body}</div>;
          })}
        </Card>
      ))}
    </RegulatorShell>
  );
}
