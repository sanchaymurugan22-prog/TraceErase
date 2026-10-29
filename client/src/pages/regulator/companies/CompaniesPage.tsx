// Regulator console: every company named in complaints, deadlines or leaks, ranked by risk.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { Link, useNavigate } from '@/lib/router';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { Card, Chip, EmptyState, ErrorBox, Icon, PageLoading } from '@/components/ui';
import { CaseStatus, PageHead, RISK } from '../shared';

export default function RegulatorCompaniesPage() {
  const t = useT();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data, loading, error } = useApi<any[]>('/regulator/companies', { interval: 20000 });
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !data) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  const rows = data.filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <RegulatorShell>
      <PageHead kicker="Regulator console" title={t('Companies')} sub={t('Companies named in complaints, ignored erasure requests or traced leaks. Open one to see its record and open an inquiry.')} />
      <label className="flex h-11 w-full max-w-[360px] items-center gap-2 rounded-xl border-[1.5px] border-line2 bg-card px-3 text-mute">
        <Icon name="search" size="sm" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search a company')} aria-label={t('Search a company')} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
      </label>
      <Card className="gap-0 overflow-hidden p-0">
        {!rows.length ? <EmptyState icon="building" title="No companies yet">{t('Companies appear here once users file complaints, requests go unanswered, or leaks are traced.')}</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('Company')}</th><th>{t('Risk')}</th><th>{t('Complaints')}</th><th>{t('Ignored requests')}</th><th>{t('Leaks traced')}</th><th>{t('Inquiry')}</th><th /></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key} className="cursor-pointer hover:bg-soft" onClick={() => navigate(`/regulator/companies/${r.key}`)}>
                    <td><Link to={`/regulator/companies/${r.key}`} className="font-bold text-ink" translate="no">{r.name}</Link><div className="text-[13px] text-mute">{t(r.category)}{r.domain ? ` · ${r.domain}` : ''}</div></td>
                    <td><Chip tone={RISK[r.risk][0]}>{t(RISK[r.risk][1])}</Chip></td>
                    <td className="font-semibold">{r.complaints}</td>
                    <td className={r.ignored ? 'font-semibold text-nr' : ''}>{r.ignored}</td>
                    <td className={r.leaks ? 'font-semibold text-leak' : ''}>{r.leaks}</td>
                    <td>{r.inquiry ? <span className="flex flex-col items-start gap-1"><span className="font-mono text-[13px]" translate="no">{r.inquiry.reference}</span><CaseStatus status={r.inquiry.status} /></span> : <span className="text-mute">{t('None')}</span>}</td>
                    <td className="text-mute"><Icon name="cr" size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </RegulatorShell>
  );
}
