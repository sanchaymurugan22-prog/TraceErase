import { useT } from '@/i18n/I18nProvider';
import { ButtonLink, CompanyAvatar, Icon, ProgressBar, StatusChip, Tile } from '@/components/ui';

const DEMO_ROWS: [string, string, string][] = [['Zomato', 'k8', 'partial'], ['Razorpay', 'k3', 'partial'], ['Myntra', 'k2', 'claimed'], ['Flipkart', 'k9', 'sent'], ['AdNexa (ad network)', 'k7', 'overdue']];

export function Hero() {
  const t = useT();
  return (
    <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] items-center gap-16 px-10 pb-28 pt-16 max-[1100px]:grid-cols-1 max-[820px]:px-4">
      <div className="flex flex-col gap-7">
        <span className="inline-flex items-center gap-2 self-start text-[12.5px] font-bold uppercase tracking-[.14em] text-accent">
          <Icon name="scale" size="sm" />{t('Built on the DPDP Act 2023 · works with any app')}
        </span>
        <h1 className="hero-title text-[80px] leading-[84px] tracking-tight text-ink max-[820px]:text-5xl">
          {t('You clicked delete.')}<br /><span className="text-ocean-d">{t('Did they?')}</span>
        </h1>
        <p className="max-w-[560px] text-xl leading-8 text-ink2">{t('TraceErase uses AI to find every company holding your personal data, deletes it everywhere, including the partners they quietly shared it with, and gives you proof no one can fake.')}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/signup" size="lg">{t('Get started free')}<Icon name="ar" /></ButtonLink>
          <a href="#how" className="inline-flex h-[52px] items-center gap-2 px-2 font-semibold text-brand-d underline decoration-1 underline-offset-[6px] transition hover:text-ink"><Icon name="play" />{t('See how it works')}</a>
        </div>
        <div className="flex flex-wrap gap-6 border-t border-line pt-5 text-sm text-ink2">
          <span className="flex items-center gap-2"><Icon name="check" size="sm" className="text-accent" />{t('Nothing for companies to install')}</span>
          <span className="flex items-center gap-2"><Icon name="check" size="sm" className="text-accent" />{t('Your real email and number stay private')}</span>
        </div>
      </div>

      <div className="relative min-h-[500px] max-[1100px]:hidden" aria-hidden="true">
        <div className="absolute left-16 right-2 top-2 h-[86%] rotate-[3deg] rounded-md border border-line bg-[#EDE7D8]" />
        <div className="absolute left-10 right-0 top-6 flex -rotate-[1.2deg] flex-col gap-4 rounded-md border border-line bg-card p-8 text-ink shadow-pop">
          <span className="absolute -bottom-7 -right-6 z-10 grid size-[86px] rotate-[-14deg] place-items-center rounded-full border-2 border-accent bg-card text-center text-[10px] font-bold leading-tight tracking-[.08em] text-accent outline outline-1 outline-offset-[3px] outline-accent">SEALED<br />&amp;<br />VERIFIED</span>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5"><span className="text-[11.5px] uppercase tracking-[.14em] text-mute">{t('Deletion request')} · DR-0417</span><span className="font-display text-xl font-bold">{t('Deleting from {n} companies', { n: 6 })}</span></div>
            <span className="rounded-md border border-line2 px-2.5 py-1 font-display text-[13px] italic text-accent">{t('Day {n} of 30', { n: 10 })}</span>
          </div>
          <div className="flex flex-col gap-1.5"><ProgressBar pct={66} /><span className="text-[13px] text-mute">{t('{a} of {b} resolved', { a: 4, b: 6 })}</span></div>
          <div className="flex flex-col">
            {DEMO_ROWS.map(([n, k, s]) => (
              <div key={n} className="flex items-center gap-3.5 border-b border-line py-3 last:border-b-0">
                <CompanyAvatar company={{ name: n, color: k }} size="sm" /><span className="flex-1 font-semibold">{n}</span><StatusChip status={s} short />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 flex w-[360px] rotate-[1.5deg] items-center gap-3 rounded-md border-[1.5px] border-[#E7B8AE] bg-card px-[18px] py-4 text-ink shadow-pop">
          <Tile icon="siren" tone="leak" />
          <span className="flex flex-col gap-0.5"><span className="font-bold">{t('Leak caught')}</span><span className="text-[13px] text-mute">{t('PizzaPoint emailed your Zomato-only address')}</span></span>
        </div>
      </div>
    </div>
  );
}
