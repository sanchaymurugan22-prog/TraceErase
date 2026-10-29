import { useT } from '@/i18n/I18nProvider';
import { ButtonLink, CompanyAvatar, Icon, ProgressBar, StatusChip, Tile } from '@/components/ui';

const DEMO_ROWS: [string, string, string][] = [['Zomato', 'k8', 'partial'], ['Razorpay', 'k3', 'partial'], ['Myntra', 'k2', 'claimed'], ['Flipkart', 'k9', 'sent'], ['AdNexa (ad network)', 'k7', 'overdue']];

export function Hero() {
  const t = useT();
  return (
    <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] items-center gap-16 px-10 pb-28 pt-16 max-[1100px]:grid-cols-1 max-[820px]:px-4">
      <div className="flex flex-col gap-7">
        <span className="glass-dark inline-flex h-9 items-center gap-2 self-start rounded-full px-4 text-[13px] font-semibold text-on">
          <Icon name="scale" size="sm" className="text-accent-b" />{t('Built on the DPDP Act 2023 · works with any app')}
        </span>
        <h1 className="hero-title text-[74px] font-extrabold leading-[80px] tracking-tight text-white max-[820px]:text-5xl">
          {t('You clicked delete.')}<br /><span className="text-ocean">{t('Did they?')}</span>
        </h1>
        <p className="max-w-[560px] text-xl leading-8 text-onm">{t('TraceErase uses AI to find every company holding your personal data, deletes it everywhere, including the partners they quietly shared it with, and gives you proof no one can fake.')}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/signup" size="lg">{t('Get started free')}<Icon name="ar" /></ButtonLink>
          <a href="#how" className="inline-flex h-[52px] items-center gap-2 rounded-full border border-white/25 bg-white/5 px-7 font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-white/12 hover:text-white"><Icon name="play" />{t('See how it works')}</a>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-onm">
          <span className="flex items-center gap-2"><Icon name="check" size="sm" className="text-accent-b" />{t('Nothing for companies to install')}</span>
          <span className="flex items-center gap-2"><Icon name="check" size="sm" className="text-accent-b" />{t('Your real email and number stay private')}</span>
        </div>
      </div>

      <div className="relative min-h-[500px] max-[1100px]:hidden" aria-hidden="true">
        <div className="absolute left-10 right-0 top-6 flex animate-float flex-col gap-4 rounded-[28px] border border-edge bg-card/95 p-7 text-ink shadow-modal backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5"><span className="text-[13px] text-mute">{t('Deletion request')} · DR-0417</span><span className="font-display text-xl font-bold">{t('Deleting from {n} companies', { n: 6 })}</span></div>
            <span className="bg-ocean rounded-full px-3 py-1 text-[13px] font-semibold text-white">{t('Day {n} of 30', { n: 10 })}</span>
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
        <div className="absolute bottom-0 left-0 flex w-[360px] animate-float items-center gap-3 rounded-[22px] border-[1.5px] border-[#F6C4BF] bg-card px-[18px] py-4 text-ink shadow-modal [animation-delay:-3.5s]">
          <Tile icon="siren" tone="leak" />
          <span className="flex flex-col gap-0.5"><span className="font-bold">{t('Leak caught')}</span><span className="text-[13px] text-mute">{t('PizzaPoint emailed your Zomato-only address')}</span></span>
        </div>
      </div>
    </div>
  );
}
