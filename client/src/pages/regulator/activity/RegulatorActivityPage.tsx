// Regulator console: audit trail of every officer action (who did what, when, on which case).
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { fmtDateTime } from '@/lib/format';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { Card, Chip, EmptyState, ErrorBox, PageLoading } from '@/components/ui';
import { PageHead } from '../shared';

const ACTION: Record<string, string> = { status: 'Status', note: 'Note', assess: 'AI assessment', notice: 'Notice', reply: 'Reply recorded', decision: 'Decision', opened: 'Inquiry opened' };

export default function RegulatorActivityPage() {
  const t = useT();
  const { data, loading, error } = useApi<any[]>('/regulator/audit', { interval: 20000 });
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !data) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  return (
    <RegulatorShell>
      <PageHead kicker="Regulator console" title={t('Officer activity')} sub={t('Every action taken in this console, newest first. Case actions are also sealed in the tamper-proof log.')} />
      <Card className="gap-0 overflow-hidden p-0">
        {!data.length ? <EmptyState icon="clock" title="Nothing yet">{t('Actions such as taking up a case or sending a notice will be listed here.')}</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('When')}</th><th>{t('Officer')}</th><th>{t('Action')}</th><th>{t('Case')}</th><th>{t('Details')}</th></tr></thead>
              <tbody>
                {data.map(a => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-mute">{fmtDateTime(a.at)}</td>
                    <td className="text-sm" translate="no">{a.staffEmail}</td>
                    <td><Chip tone={a.action === 'decision' ? 'ok' : a.action === 'notice' ? 'part' : 'neutral'}>{t(ACTION[a.action] || a.action)}</Chip></td>
                    <td className="font-mono text-sm" translate="no">{a.ref}</td>
                    <td className="max-w-[420px] text-sm text-ink2">{t(a.detail)}</td>
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
