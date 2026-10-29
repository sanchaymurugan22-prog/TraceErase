// Small pieces shared by the regulator console pages.
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { fmtDate } from '@/lib/format';
import { Card, Chip, Icon, type Tone } from '@/components/ui';

export const CASE_STATUS: Record<string, [Tone, string]> = {
  new: ['brand', 'New'], review: ['clm', 'Under review'], notice: ['part', 'Notice sent'], decided: ['ok', 'Decided'], dismissed: ['neutral', 'Dismissed']
};
export function CaseStatus({ status }: { status: string }) {
  const t = useT();
  const [tone, label] = CASE_STATUS[status] || CASE_STATUS.new;
  return <Chip tone={tone}>{t(label)}</Chip>;
}

export const NOTICE_STATE: Record<string, [Tone, string]> = {
  awaiting: ['pend', 'Awaiting reply'], overdue: ['leak', 'Overdue'], replied: ['ok', 'Complied'], disputed: ['nr', 'Disputed']
};
export function NoticeState({ state }: { state: string }) {
  const t = useT();
  const [tone, label] = NOTICE_STATE[state] || NOTICE_STATE.awaiting;
  return <Chip tone={tone}>{t(label)}</Chip>;
}

export const RISK: Record<string, [Tone, string]> = { high: ['leak', 'High risk'], medium: ['nr', 'Medium risk'], low: ['ok', 'Low risk'] };

export function PageHead({ kicker, title, sub, children }: { kicker?: string; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {kicker && <span className="text-xs font-bold uppercase tracking-[.08em] text-mute">{t(kicker)}</span>}
        <h1 className="text-4xl font-extrabold tracking-tight max-[820px]:text-3xl">{title}</h1>
        {sub && <p className="text-mute">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Kpi({ label, value, tone, to, hint }: { label: string; value: React.ReactNode; tone?: string; to?: string; hint?: string }) {
  const body = (
    <Card className="h-full gap-2 transition hover:shadow-card">
      <span className="text-sm font-semibold text-mute">{label}</span>
      <span className={`font-display text-[40px] font-extrabold leading-[44px] ${tone || ''}`}>{value}</span>
      {hint && <span className="text-[13px] text-mute">{hint}</span>}
    </Card>
  );
  return to ? <Link to={to} className="block text-ink no-underline hover:text-ink">{body}</Link> : body;
}

/** The complaint table used on the overview, the complaints list and company pages. */
export function ComplaintTable({ rows, compact }: { rows: any[]; compact?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead><tr><th>{t('Reference')}</th><th>{t('Against')}</th>{!compact && <th>{t('Issue')}</th>}<th>{t('Status')}</th><th>{t('Evidence')}</th><th>{t('Filed')}</th><th /></tr></thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id} className="cursor-pointer hover:bg-soft" onClick={() => navigate(`/regulator/complaints/${c.id}`)}>
              <td className="whitespace-nowrap font-mono font-semibold" translate="no">
                <Link to={`/regulator/complaints/${c.id}`} className="text-ink">{c.reference}</Link>
                {c.demo && <div className="font-sans text-[11px] font-semibold text-mute">{t('Demo account')}</div>}
              </td>
              <td className="font-semibold" translate="no">{c.against.join(', ')}</td>
              {!compact && <td className="max-w-[260px] text-sm text-mute">{t(c.issue)}</td>}
              <td><div className="flex flex-col items-start gap-1"><CaseStatus status={c.status} />{c.noticesOverdue > 0 && <Chip tone="leak" icon="clock">{t('Reply overdue')}</Chip>}</div></td>
              <td><Chip tone="ok" icon="check">{t('{n} sealed', { n: c.evidence })}</Chip></td>
              <td className="whitespace-nowrap text-mute">{fmtDate(c.filedAt)}</td>
              <td className="text-mute"><Icon name="cr" size="sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
