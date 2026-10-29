// Regulator console: every notice the Board has sent, with reply deadlines, plus open inquiries.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { Link, useNavigate } from '@/lib/router';
import { fmtDate } from '@/lib/format';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { Card, EmptyState, ErrorBox, Icon, PageLoading, Segmented } from '@/components/ui';
import { CaseStatus, NoticeState, PageHead } from '../shared';

export default function RegulatorNoticesPage() {
  const t = useT();
  const navigate = useNavigate();
  const [f, setF] = useState('all');
  const notices = useApi<any[]>('/regulator/notices', { interval: 20000 });
  const inquiries = useApi<any[]>('/regulator/inquiries');
  if (notices.loading || inquiries.loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (notices.error || !notices.data) return <RegulatorShell><ErrorBox error={notices.error} /></RegulatorShell>;
  const rows = notices.data.filter(n => f === 'all' || n.state === f || (f === 'answered' && (n.state === 'replied' || n.state === 'disputed')));
  const link = (n: any) => `/regulator/${n.caseKind === 'complaint' ? 'complaints' : 'inquiries'}/${n.caseId}`;

  return (
    <RegulatorShell>
      <PageHead kicker="Regulator console" title={t('Notices and inquiries')} sub={t('Every notice sent to a company, with its reply deadline. Overdue notices are a reason to decide.')} />

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-[18px]">
          <h2 className="text-xl font-bold">{t('Notices')}</h2>
          <Segmented value={f} onChange={setF} options={[['all', 'All'], ['awaiting', 'Awaiting reply'], ['overdue', 'Overdue'], ['answered', 'Answered']].map(([v, l]) => ({ value: v, label: t(l) }))} />
        </div>
        {!rows.length ? <EmptyState icon="send" title="No notices here">{t('Send a notice from any complaint or inquiry.')}</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('Company')}</th><th>{t('Case')}</th><th>{t('Sent')}</th><th>{t('Reply due')}</th><th>{t('State')}</th><th /></tr></thead>
              <tbody>
                {rows.map(n => (
                  <tr key={n.id} className="cursor-pointer hover:bg-soft" onClick={() => navigate(link(n))}>
                    <td><b translate="no">{n.company}</b><div className="max-w-[340px] truncate text-[13px] text-mute">{n.subject}</div></td>
                    <td className="font-mono text-sm" translate="no"><Link to={link(n)} className="text-ink">{n.reference}</Link></td>
                    <td className="whitespace-nowrap text-mute">{fmtDate(n.sentAt)}</td>
                    <td className={`whitespace-nowrap ${n.state === 'overdue' ? 'font-semibold text-leak' : 'text-mute'}`}>{fmtDate(n.dueAt)}</td>
                    <td><NoticeState state={n.state} /></td>
                    <td className="text-mute"><Icon name="cr" size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <h2 className="px-6 py-[18px] text-xl font-bold">{t('Inquiries into companies')}</h2>
        {!inquiries.data?.length ? <EmptyState icon="layers" title="No inquiries yet">{t('Open one from a company page when several complaints point to the same company.')}</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('Reference')}</th><th>{t('Company')}</th><th>{t('Complaints joined')}</th><th>{t('Opened')}</th><th>{t('Status')}</th></tr></thead>
              <tbody>
                {inquiries.data.map(q => (
                  <tr key={q.id} className="cursor-pointer hover:bg-soft" onClick={() => navigate(`/regulator/inquiries/${q.id}`)}>
                    <td className="font-mono font-semibold" translate="no"><Link to={`/regulator/inquiries/${q.id}`} className="text-ink">{q.reference}</Link></td>
                    <td className="font-semibold" translate="no">{q.company}</td>
                    <td>{q.complaints}</td>
                    <td className="text-mute">{fmtDate(q.openedAt)}</td>
                    <td><CaseStatus status={q.status} /></td>
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
