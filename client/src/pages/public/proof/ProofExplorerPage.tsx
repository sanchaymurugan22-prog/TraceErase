// Proof Explorer: a public, live view of TraceErase's tamper-proof ledger. It shows only seals (number, time,
// how many records, the seal's code, whether it links to the one before, and its Polygon transaction), never
// receipts or anything about a person. Anyone can audit the ledger; each person checks their own receipt by ID.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { useApi } from '@/hooks/useApi';
import { cn, fmtTime, shortHash } from '@/lib/format';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/pages/landing/sections/Footer';
import { Button, Card, ErrorBox, Icon, Input, Spinner } from '@/components/ui';

interface Seal {
  number: number; sealedAt: string; records: number; root: string; chainHash: string; linked: boolean;
  network: string; txHash: string | null; explorerUrl: string | null; onChain: boolean; confirmed: boolean; pending: boolean;
}
interface Ledger {
  stats: { seals: number; records: number; onChain: number; lastSealAt: string | null; chainUnbroken: boolean; brokenAt: number | null; publicChain: boolean; network: string; intervalSec: number };
  seals: Seal[];
}

/** "23 seconds ago", updated every second. */
function useAgo(iso: string | null | undefined) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick(x => x + 1), 1000); return () => window.clearInterval(id); }, []);
  if (!iso) return null;
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return { n: s, unit: 'seconds' };
  if (s < 3600) return { n: Math.round(s / 60), unit: 'minutes' };
  if (s < 86400) return { n: Math.round(s / 3600), unit: 'hours' };
  return { n: Math.round(s / 86400), unit: 'days' };
}

export default function ProofExplorerPage() {
  const t = useT();
  const navigate = useNavigate();
  const { data, error, loading } = useApi<Ledger>('/public/ledger?limit=25', { interval: 6000 });
  const [id, setId] = useState('');
  const ago = useAgo(data?.stats.lastSealAt);

  // Highlight seals that arrived while the page is open
  const seen = useRef<number | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!data?.seals.length) return;
    const top = data.seals[0].number;
    if (seen.current !== null && top > seen.current) {
      const added = new Set(data.seals.filter(s => s.number > (seen.current as number)).map(s => s.number));
      setFresh(added);
      const timer = window.setTimeout(() => setFresh(new Set()), 6000);
      seen.current = top;
      return () => window.clearTimeout(timer);
    }
    seen.current = top;
  }, [data]);

  const st = data?.stats;
  return (
    <div className="min-h-screen">
      <section className="dots relative isolate overflow-hidden bg-navy text-on">
        <span className="aurora-blob -left-40 -top-40 size-[600px] bg-[#A8D5BE]/22" aria-hidden="true" />
        <span className="aurora-blob -right-40 -top-20 size-[560px] bg-[#C9B98F]/28 [animation-delay:-10s]" aria-hidden="true" />
        <PublicNav />
        <div className="mx-auto flex max-w-[1320px] flex-col gap-7 px-10 pb-14 pt-12 max-[820px]:px-4">
          <div className="flex max-w-[860px] flex-col gap-4">
            <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-white/10 px-3 text-[13px] font-semibold">
              <span className="relative inline-flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#A8D5BE] opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-[#A8D5BE]" /></span>
              {t('Live · updates every few seconds')}
            </span>
            <h1 className="text-6xl font-extrabold tracking-tight text-white max-[820px]:text-4xl">{t('Proof Explorer')}</h1>
            <p className="text-lg leading-[30px] text-onm">{t('Every minute, TraceErase seals new proof records together and publishes the seal on a public blockchain. Anyone can watch the ledger here. It shows that proofs exist, never what is inside them.')}</p>
          </div>
          {st && (
            <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2">
              {[
                [st.seals.toLocaleString('en-IN'), 'Seals made'],
                [st.records.toLocaleString('en-IN'), 'Proof records sealed'],
                [ago ? t(`{n} ${ago.unit} ago`, { n: ago.n }) : '—', 'Last seal'],
                [st.publicChain ? st.network : t('Tamper-proof log'), st.publicChain ? 'Published on the public blockchain' : 'Kept in TraceErase\'s sealed chain']
              ].map(([v, l]) => (
                <div key={l} className="rounded-[18px] border border-white/10 bg-white/6 p-5">
                  <b className="font-display text-[30px] font-extrabold leading-[40px] text-white max-[820px]:text-2xl">{v}</b>
                  <div className="text-[13px] text-onm">{t(l)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto flex max-w-[1320px] flex-col gap-6 px-10 py-10 max-[820px]:px-4">
        <ErrorBox error={error} />
        {loading && !data && <Spinner />}

        {st && (
          <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-4', st.chainUnbroken ? 'border-ok/25 bg-ok-s' : 'border-leak/30 bg-leak-s')}>
            <span className={cn('inline-flex size-10 flex-none items-center justify-center rounded-xl bg-card', st.chainUnbroken ? 'text-ok' : 'text-leak')}><Icon name={st.chainUnbroken ? 'shieldc' : 'alert'} /></span>
            <span className="min-w-[240px] flex-1">
              <b className="block text-ink">{st.chainUnbroken ? t('All {n} seals are linked. No record has been changed.', { n: st.seals }) : t('The chain breaks at seal #{n}. A record was changed after it was sealed.', { n: st.brokenAt || 0 })}</b>
              <span className="text-sm text-ink2">{t('Each seal contains the code of the seal before it, so changing any old record would break every link after it, and it would show here.')}</span>
            </span>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6 max-[1100px]:grid-cols-1">
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
              <h2 className="text-xl font-bold">{t('Latest seals')}</h2>
              <span className="text-sm text-mute">{st ? t('A new seal every {n} seconds when there is activity', { n: st.intervalSec }) : ''}</span>
            </div>
            <div className="grid grid-cols-[90px_120px_110px_minmax(0,1fr)_120px_190px] gap-3 border-b border-line bg-soft/60 px-6 py-2.5 text-xs font-bold uppercase tracking-[.08em] text-mute max-[1000px]:hidden">
              <span>{t('Seal')}</span><span>{t('Time')}</span><span>{t('Records')}</span><span>{t('Seal code')}</span><span>{t('Linked')}</span><span>{t('Blockchain')}</span>
            </div>
            {data?.seals.length === 0 && <p className="px-6 py-10 text-center text-mute">{t('No seals yet. The first one appears a minute after someone uses TraceErase.')}</p>}
            {data?.seals.map(s => (
              <div key={s.number} className={cn('grid grid-cols-[90px_120px_110px_minmax(0,1fr)_120px_190px] items-center gap-3 border-b border-line px-6 py-3.5 transition-colors duration-700 last:border-b-0 max-[1000px]:grid-cols-2 max-[1000px]:gap-y-1.5',
                fresh.has(s.number) ? 'animate-fade bg-accent-s' : '')}>
                <span className="flex items-center gap-2 font-mono text-[15px] font-bold text-ink">#{s.number}{fresh.has(s.number) && <span className="rounded-md bg-accent px-1.5 py-0.5 font-sans text-[11px] font-bold text-white">{t('New')}</span>}</span>
                <span className="text-sm text-ink2">{fmtTime(s.sealedAt)}</span>
                <span className="text-sm text-ink2">{s.records === 1 ? t('1 record') : t('{n} records', { n: s.records })}</span>
                <span className="truncate font-mono text-xs text-mute max-[1000px]:col-span-2" title={s.root} translate="no">{shortHash(s.root, 12, 8)}</span>
                <span className={cn('flex items-center gap-1.5 text-sm font-semibold', s.linked ? 'text-ok' : 'text-leak')}><Icon name={s.linked ? 'link' : 'alert'} size="sm" />{s.linked ? t('Linked') : t('Broken')}</span>
                <span className="text-sm">
                  {s.explorerUrl
                    ? <a href={s.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold">{s.confirmed ? '✓ ' : ''}{t('View on PolygonScan')}<Icon name="ext" size="xs" /></a>
                    : s.pending ? <span className="inline-flex items-center gap-1.5 text-mute"><Icon name="clock" size="xs" />{t('Publishing…')}</span>
                      : <span className="text-mute">{t('Sealed in TraceErase log')}</span>}
                </span>
              </div>
            ))}
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="gap-3">
              <h2 className="text-lg font-bold">{t('Check your own proof')}</h2>
              <p className="text-sm text-mute">{t('Only you have your receipt ID: it is on your certificate and receipts. Paste it to see your record and its seal.')}</p>
              <form className="flex flex-col gap-2" onSubmit={e => { e.preventDefault(); if (id.trim()) navigate('/verify/' + encodeURIComponent(id.trim())); }}>
                <Input value={id} onChange={e => setId(e.target.value)} placeholder={t('Receipt ID')} aria-label={t('Receipt ID')} className="font-mono" />
                <Button type="submit"><Icon name="shieldc" />{t('Verify')}</Button>
              </form>
            </Card>
            <Card className="gap-3">
              <h2 className="text-lg font-bold">{t('What this page shows')}</h2>
              {[
                ['check', 'ok', 'That a seal was made, when, and how many records it holds'],
                ['check', 'ok', 'That every seal links to the one before it'],
                ['check', 'ok', 'Where each seal sits on the public blockchain'],
                ['eyeoff', 'leak', 'Never names, emails, phone numbers, companies or what was deleted']
              ].map(([ic, tone, txt]) => (
                <span key={txt} className="flex items-start gap-2.5 text-sm text-ink2"><Icon name={ic as any} size="sm" className={cn('mt-0.5 flex-none', tone === 'ok' ? 'text-ok' : 'text-leak')} />{t(txt)}</span>
              ))}
              <p className="rounded-xl bg-soft p-3 text-[13px] text-ink2">{t('Like a post office board that says "10 letters posted today": everyone sees that letters were posted, nobody can read yours.')}</p>
            </Card>
            {st?.publicChain && (
              <Link to="/verify" className="text-sm font-semibold">{t('How verification works')} →</Link>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
