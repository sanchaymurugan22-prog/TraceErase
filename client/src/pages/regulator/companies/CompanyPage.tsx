// Regulator console: one company's record (complaints, ignored deadlines, leaks) and Board inquiries into it.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { post } from '@/lib/api';
import { Link, useNavigate } from '@/lib/router';
import { fmtDate } from '@/lib/format';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { ActionButton, Card, Chip, ErrorBox, Field, Icon, PageLoading, Textarea } from '@/components/ui';
import { CaseStatus, ComplaintTable, Kpi, PageHead, RISK } from '../shared';

export default function RegulatorCompanyPage({ params }: { params: Record<string, string> }) {
  const t = useT();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const { data: d, loading, error } = useApi<any>('/regulator/companies/' + params.key);
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !d) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  const open = d.inquiries.find((q: any) => !['decided', 'dismissed'].includes(q.status));

  return (
    <RegulatorShell>
      <Link to="/regulator/companies" className="inline-flex items-center gap-1 self-start text-sm font-semibold"><Icon name="cl" size="sm" />{t('All companies')}</Link>
      <PageHead kicker={d.category} title={<span translate="no">{d.name}</span>} sub={<span className="flex flex-wrap items-center gap-2">{d.domain && <span translate="no">{d.domain}</span>}<Chip tone={RISK[d.risk][0]}>{t(RISK[d.risk][1])}</Chip>{d.fictional && <Chip>{t('Sample company')}</Chip>}</span>} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('Complaints')} value={d.stats.complaints} />
        <Kpi label={t('Erasure requests ignored')} value={d.stats.ignored} tone={d.stats.ignored ? 'text-nr' : ''} hint={t('{n} requests tracked', { n: d.stats.requests })} />
        <Kpi label={t('Leaks traced to it')} value={d.stats.leaks} tone={d.stats.leaks ? 'text-leak' : ''} />
        <Kpi label={t('Requests honoured')} value={d.stats.resolved} tone="text-ok" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="gap-0 overflow-hidden p-0">
            <h2 className="px-6 py-[18px] text-xl font-bold">{t('Complaints naming this company')}</h2>
            {d.complaints.length ? <ComplaintTable rows={d.complaints} compact /> : <p className="px-6 pb-6 text-sm text-mute">{t('No filed complaints yet.')}</p>}
          </Card>
          <Card className="gap-3">
            <h2 className="text-xl font-bold">{t('Leaks traced to this company')}</h2>
            {!d.leaks.length && <p className="text-sm text-mute">{t('No leaks traced so far.')}</p>}
            {d.leaks.map((l: any) => (
              <div key={l.id} className="flex flex-col gap-1.5 rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-[15px]">{t('{sender} used an address given only to {app}', { sender: l.sender, app: l.app })}</b>
                  <Chip tone={l.confidence === 'high' ? 'leak' : 'nr'}>{t(l.confidence === 'high' ? 'High confidence' : l.confidence === 'low' ? 'Low confidence' : 'Medium confidence')}</Chip>
                </div>
                <span className="text-[13px] text-mute">{fmtDate(l.at)}</span>
                {l.reasons.slice(0, 3).map((r: string, i: number) => <span key={i} className="flex gap-2 text-sm text-ink2"><Icon name="dot" size="xs" className="mt-1.5 flex-none" />{t(r)}</span>)}
              </div>
            ))}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-3">
            <h2 className="text-lg font-bold">{t('Board inquiry')}</h2>
            {open ? <>
              <p className="text-sm text-mute">{t('An inquiry is open. It joins every complaint about this company, so one notice and one order cover them all.')}</p>
              <Link to={`/regulator/inquiries/${open.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-ink no-underline hover:bg-soft hover:text-ink">
                <span className="font-mono font-semibold" translate="no">{open.reference}</span><CaseStatus status={open.status} />
              </Link>
            </> : <>
              <p className="text-sm text-mute">{t('Open an inquiry to handle every complaint, ignored request and leak about this company as one case.')}</p>
              <Field label={t('Reason (optional)')}><Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={t('Filled in from the records if left empty')} /></Field>
              <ActionButton variant="danger" onClick={async () => { const q = await post(`/regulator/companies/${d.key}/inquiry`, { reason }); navigate(`/regulator/inquiries/${q.id}`); }}><Icon name="layers" size="sm" />{t('Open an inquiry')}</ActionButton>
            </>}
            {d.inquiries.filter((q: any) => q.id !== open?.id).map((q: any) => (
              <Link key={q.id} to={`/regulator/inquiries/${q.id}`} className="flex items-center justify-between gap-2 text-sm text-ink no-underline"><span className="font-mono" translate="no">{q.reference}</span><CaseStatus status={q.status} /></Link>
            ))}
          </Card>
          {(d.dataTypes.length > 0 || d.partnerTypes.length > 0 || d.senders.length > 0) && (
            <Card className="gap-3">
              <h2 className="text-lg font-bold">{t('What it holds and shares')}</h2>
              {d.dataTypes.length > 0 && <div className="flex flex-wrap gap-1.5">{d.dataTypes.map((x: string) => <Chip key={x}>{t(x)}</Chip>)}</div>}
              {d.partnerTypes.length > 0 && <><b className="text-sm">{t('Shares with (from its policy)')}</b><div className="flex flex-wrap gap-1.5">{d.partnerTypes.map((x: string) => <Chip key={x} tone="part">{t(x)}</Chip>)}</div></>}
              {d.senders.length > 0 && <><b className="text-sm">{t('Data reached')}</b><div className="flex flex-wrap gap-1.5">{d.senders.map((x: string) => <Chip key={x} tone="leak">{x}</Chip>)}</div></>}
            </Card>
          )}
        </div>
      </div>
    </RegulatorShell>
  );
}
