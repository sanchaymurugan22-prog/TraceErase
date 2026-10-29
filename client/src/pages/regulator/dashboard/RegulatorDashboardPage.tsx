// Regulator console overview: workload, AI-found pattern, latest complaints and repeat offenders.
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { Link } from '@/lib/router';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { AiTag, ButtonLink, Card, Chip, EmptyState, ErrorBox, Icon, PageLoading } from '@/components/ui';
import type { RegulatorOverview } from '@/types/api';
import { ComplaintTable, Kpi, PageHead } from '../shared';

export default function RegulatorDashboardPage() {
  const t = useT();
  const { data: d, loading, error } = useApi<RegulatorOverview>('/regulator/overview', { interval: 15000 });
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !d) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  const max = Math.max(1, ...d.offenders.map(o => o.complaints + o.leaks + o.ignored));
  const w = d.workload;

  return (
    <RegulatorShell>
      <PageHead kicker="Data Protection Board · prototype console" title={t('Overview')} sub={t('Every complaint arrives with sealed evidence. Review it, send notices, and decide.')}>
        <ButtonLink to="/regulator/complaints" variant="primary"><Icon name="scale" size="sm" />{t('Open complaint queue')}</ButtonLink>
      </PageHead>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t('Waiting for an officer')} value={w.awaiting} tone={w.awaiting ? 'text-brand' : ''} to="/regulator/complaints?status=new" hint={t('{n} complaints filed in total', { n: d.kpis.complaints })} />
        <Kpi label={t('Under review or notice sent')} value={w.inReview} to="/regulator/complaints?status=open" hint={t('{n} inquiries open', { n: w.inquiries })} />
        <Kpi label={t('Notice replies overdue')} value={w.noticesOverdue} tone={w.noticesOverdue ? 'text-leak' : ''} to="/regulator/notices" hint={t('{n} still within deadline', { n: w.noticesOpen })} />
        <Kpi label={t('Decided')} value={w.decided} tone="text-ok" to="/regulator/complaints?status=closed" hint={w.penaltiesCrore ? t('₹{n} crore in penalties', { n: w.penaltiesCrore }) : t('No penalties yet')} />
      </div>

      {d.pattern && (
        <Card className="gap-3.5 border-[1.5px] border-[#E7A39C] p-7 max-[820px]:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AiTag ai={d.pattern._ai} label={t('AI found a pattern across complaints')} />
            <Chip tone={d.pattern.priority === 'high' ? 'leak' : 'nr'} icon="siren">{d.pattern.priority === 'high' ? t('High priority') : d.pattern.priority === 'low' ? t('Low priority') : t('Medium priority')}</Chip>
          </div>
          <h2 className="text-2xl font-extrabold">{t(d.pattern.headline)}</h2>
          <p className="text-mute">{t(d.pattern.explanation)}</p>
          {d.pattern.key && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`/regulator/companies/${d.pattern.key}`} variant="danger"><Icon name="layers" size="sm" />{t('Review company and open an inquiry')}</ButtonLink>
            </div>
          )}
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 px-6 py-[18px]">
            <h2 className="text-xl font-bold">{t('Latest complaints')}</h2>
            <Link to="/regulator/complaints" className="text-sm font-semibold">{t('See all')}</Link>
          </div>
          {!d.complaints.length ? <EmptyState icon="scale" title="No complaints yet">{t('Complaints filed by TraceErase users appear here with their evidence.')}</EmptyState>
            : <ComplaintTable rows={d.complaints.slice(0, 8)} />}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{t('Repeat offenders')}</h2>
            <Link to="/regulator/companies" className="text-sm font-semibold">{t('All companies')}</Link>
          </div>
          {d.offenders.length ? d.offenders.slice(0, 6).map(o => (
            <Link key={o.name} to={`/regulator/companies/${o.key}`} className="flex flex-col gap-1.5 rounded-xl p-1.5 text-ink no-underline hover:bg-soft hover:text-ink">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold" translate="no">{o.name}</span><span className="text-right text-[13px] text-mute">{t('{c} complaints · {i} ignored · {l} leaks', { c: o.complaints, i: o.ignored, l: o.leaks })}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-soft2"><span className="block h-full rounded-full bg-leak" style={{ width: `${(100 * (o.complaints + o.leaks + o.ignored)) / max}%` }} /></div>
            </Link>
          )) : <span className="text-sm text-mute">{t('None yet.')}</span>}
          <span className="flex items-start gap-2 rounded-xl bg-soft p-3 text-[13px] text-mute"><Icon name="info" size="sm" className="mt-0.5" />{t('Scores combine filed complaints, deletion requests ignored past the deadline, and leaks traced through protected addresses.')}</span>
        </Card>
      </div>

      <Card className="gap-3">
        <h2 className="text-lg font-bold">{t('What you can do in this console')}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['scale', 'Review a complaint', 'Open any complaint to see the facts, the sealed evidence (checked live) and the full timeline.'],
            ['sparkle', 'Get an AI assessment', 'AI lists which DPDP duties look broken and how strong the evidence is. You decide.'],
            ['send', 'Send notices', 'AI drafts a notice to the company. Track the reply deadline and record its answer.'],
            ['layers', 'Decide or investigate', 'Issue directions, accept an undertaking, impose a penalty, or open an inquiry across complaints.']
          ].map(([ic, h, s]) => (
            <div key={h} className="flex flex-col gap-1.5 rounded-2xl bg-soft p-4">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent-s text-accent"><Icon name={ic as any} size="sm" /></span>
              <b className="text-[15px]">{t(h)}</b><span className="text-[13px] text-mute">{t(s)}</span>
            </div>
          ))}
        </div>
      </Card>
    </RegulatorShell>
  );
}
