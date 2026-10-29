// Regulator console: the full complaint queue with status filters and search.
import { useState } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { useQuery } from '@/lib/router';
import { RegulatorShell } from '@/components/layout/RegulatorShell';
import { Card, EmptyState, ErrorBox, Icon, PageLoading, Segmented } from '@/components/ui';
import { ComplaintTable, PageHead } from '../shared';

const FILTERS: [string, string, (s: string) => boolean][] = [
  ['all', 'All', () => true],
  ['new', 'New', s => s === 'new'],
  ['open', 'In progress', s => s === 'review' || s === 'notice'],
  ['closed', 'Decided or dismissed', s => s === 'decided' || s === 'dismissed']
];

export default function RegulatorComplaintsPage() {
  const t = useT();
  const query = useQuery();
  const [f, setF] = useState(FILTERS.some(x => x[0] === query.status) ? query.status : 'all');
  const [q, setQ] = useState('');
  const { data, loading, error } = useApi<any[]>('/regulator/complaints', { interval: 15000 });
  if (loading) return <RegulatorShell><PageLoading /></RegulatorShell>;
  if (error || !data) return <RegulatorShell><ErrorBox error={error} /></RegulatorShell>;
  const test = FILTERS.find(x => x[0] === f)![2];
  const needle = q.trim().toLowerCase();
  const rows = data.filter(r => test(r.status) && (!needle || r.reference.toLowerCase().includes(needle) || r.against.join(' ').toLowerCase().includes(needle)));
  const count = (k: string) => data.filter(r => FILTERS.find(x => x[0] === k)![2](r.status)).length;

  return (
    <RegulatorShell>
      <PageHead kicker="Regulator console" title={t('Complaints')} sub={t('Every complaint filed through TraceErase, with its sealed evidence. Click one to work on it.')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={f} onChange={setF} options={FILTERS.map(([k, l]) => ({ value: k, label: <>{t(l)} <span className="text-mute">{count(k)}</span></> }))} />
        <label className="flex h-11 w-full max-w-[320px] items-center gap-2 rounded-xl border-[1.5px] border-line2 bg-card px-3 text-mute">
          <Icon name="search" size="sm" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search reference or company')} aria-label={t('Search reference or company')} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
        </label>
      </div>
      <Card className="gap-0 overflow-hidden p-0">
        {rows.length ? <ComplaintTable rows={rows} /> : <EmptyState icon="scale" title={data.length ? 'No complaints match' : 'No complaints yet'}>{t(data.length ? 'Try another filter or search.' : 'Complaints filed by TraceErase users appear here with their evidence.')}</EmptyState>}
      </Card>
    </RegulatorShell>
  );
}
