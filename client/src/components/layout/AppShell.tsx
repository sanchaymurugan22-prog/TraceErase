import { useEffect, useState } from 'react';
import { Link, useNavigate, useRouter } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { get } from '@/lib/api';
import { cn, initials } from '@/lib/format';
import { Icon, LogoMark, Wordmark, ButtonLink, type IconName } from '@/components/ui';
import { DemoPanel } from '@/components/demo/DemoPanel';
import { LanguageMenu } from './LanguageMenu';

type NavItem = { section: string } | { to: string; icon: IconName; label: string; count?: 'companies' | 'alerts' };
const NAV: NavItem[] = [
  { section: 'Overview' },
  { to: '/app', icon: 'grid', label: 'Dashboard' },
  { to: '/app/map', icon: 'map', label: 'Data map' },
  { to: '/app/companies', icon: 'building', label: 'Companies', count: 'companies' },
  { to: '/app/alerts', icon: 'bell', label: 'Alerts', count: 'alerts' },
  { section: 'Take action' },
  { to: '/app/requests', icon: 'trash', label: 'Deletion requests' },
  { to: '/app/protect', icon: 'plus', label: 'Protect a sign-up' },
  { to: '/app/evidence', icon: 'file', label: 'Evidence and proof' },
  { to: '/app/assistant', icon: 'sparkle', label: 'Ask TraceErase' },
  { to: '/app/activity', icon: 'inbox', label: 'Activity log' },
  { to: '/app/settings', icon: 'settings', label: 'Settings' }
];

function useCounts() {
  const [c, setC] = useState({ companies: 0, alerts: 0 });
  const { path } = useRouter();
  useEffect(() => {
    let alive = true;
    const load = () => Promise.all([get<any[]>('/companies').catch(() => []), get<any[]>('/alerts').catch(() => [])])
      .then(([cs, as]) => { if (alive) setC({ companies: cs.length, alerts: as.filter(a => !a.read).length }); });
    load();
    window.addEventListener('te:refresh', load);
    return () => { alive = false; window.removeEventListener('te:refresh', load); };
  }, [path]);
  return c;
}

/** The signed-in layout: navy sidebar, top bar, page content. */
export function AppShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const { user, flags } = useSession();
  const { path } = useRouter();
  const navigate = useNavigate();
  const t = useT();
  const counts = useCounts();
  const [q, setQ] = useState('');
  const links = NAV.filter((n): n is Extract<NavItem, { to: string }> => 'to' in n);
  const current = active || links.map(n => n.to).filter(p => p === path || (p !== '/app' && path.startsWith(p))).sort((a, b) => b.length - a.length)[0] || '/app';

  return (
    <div className="flex min-h-screen max-[820px]:flex-col">
      <aside className="dots sticky top-0 flex h-screen w-[272px] flex-none flex-col gap-1 overflow-y-auto bg-navy px-4 py-6 text-on max-[820px]:static max-[820px]:h-auto max-[820px]:w-auto max-[820px]:flex-row max-[820px]:items-center max-[820px]:overflow-x-auto max-[820px]:px-3 max-[820px]:py-2.5">
        <Link to="/app" className="flex flex-none items-center gap-2.5 px-2 pb-6 text-white max-[820px]:pb-0" aria-label="TraceErase"><LogoMark size={32} /><span className="max-[820px]:hidden"><Wordmark /></span></Link>
        <nav className="flex flex-col gap-0.5 max-[820px]:flex-row max-[820px]:gap-1" aria-label={t('Main')}>
          {NAV.map((n, i) => 'section' in n
            ? <span key={i} className="px-3.5 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-[.14em] text-[#6F8BA3] max-[820px]:hidden">{t(n.section)}</span>
            : (
              <Link key={n.to} to={n.to} aria-current={current === n.to ? 'page' : undefined}
                className={cn('flex min-h-11 flex-none items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 text-[14.5px] font-semibold transition duration-200 max-[820px]:min-h-9 max-[820px]:text-[13.5px]',
                  current === n.to ? 'bg-[linear-gradient(100deg,rgba(45,212,191,.20),rgba(59,111,224,.14))] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] [&>svg]:text-accent-b' : 'text-onm hover:bg-white/6 hover:text-white')}>
                <Icon name={n.icon} />{t(n.label)}
                {n.count === 'companies' && counts.companies > 0 && <span className="ml-auto rounded-full bg-white/12 px-2 text-xs font-bold leading-[22px] text-white">{counts.companies}</span>}
                {n.count === 'alerts' && counts.alerts > 0 && <span className="ml-auto rounded-full bg-[linear-gradient(120deg,#F06A6E,#E5484D)] px-2 text-xs font-bold leading-[22px] text-white shadow-[0_4px_12px_-3px_rgba(229,72,77,.6)]">{counts.alerts}</span>}
              </Link>
            ))}
        </nav>
        <div className="glass-dark mt-auto flex flex-col gap-2.5 rounded-[22px] p-4 max-[820px]:hidden">
          <span className="text-[13px] text-onm">{t('Protected number')}</span>
          {user?.protectedNumber
            ? <><span className="font-mono text-[15px] text-white" translate="no">{user.protectedNumber}</span><span className="text-[13px] text-onm">{t('Calls and SMS from apps you use ring through')}</span></>
            : <span className="text-[13px] text-onm">{t('Not available yet: phone protection needs a paid phone service. Try it in the demo.')}</span>}
          {flags?.protectedEmail !== false && <ButtonLink to="/app/protect" variant="outline" size="sm" full><Icon name="plus" size="sm" />{t('New protected email')}</ButtonLink>}
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-[72px] flex-none items-center gap-4 border-b border-line/70 px-8 max-[820px]:static max-[820px]:px-4">
          <form role="search" className="flex h-11 max-w-[480px] flex-1 items-center max-[640px]:hidden gap-2.5 rounded-full border border-line/70 bg-card/70 px-4 text-mute transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-b/15"
            onSubmit={e => { e.preventDefault(); navigate(`/app/companies?q=${encodeURIComponent(q)}`); }}>
            <Icon name="search" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search companies')} aria-label={t('Search companies')}
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
          </form>
          <span className="flex-1" />
          <ButtonLink to="/app/delete" aria-label={t('Delete my data')} className="max-[640px]:w-11 max-[640px]:px-0"><Icon name="trash" /><span className="max-[640px]:hidden">{t('Delete my data')}</span></ButtonLink>
          <LanguageMenu />
          <Link to="/app/alerts" aria-label={t('Alerts')} className="relative inline-flex size-11 items-center justify-center rounded-full border border-line bg-card/80 text-ink2 transition hover:bg-card hover:shadow-card">
            <Icon name="bell" />{counts.alerts > 0 && <span className="absolute right-[11px] top-2.5 size-2 rounded-full border-2 border-white bg-[#E5484D]" />}
          </Link>
          <Link to="/app/settings" aria-label={t('Account')} className="bg-ocean inline-flex size-10 flex-none items-center justify-center rounded-full font-display text-sm font-bold text-white shadow-glow ring-2 ring-white hover:text-white" translate="no">{initials(user?.name)}</Link>
        </header>
        {user?.demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[#F3E2B5] bg-[linear-gradient(90deg,#FFF8E6,#FDF1D3,#FFF8E6)] px-4 py-2 text-center text-[13px] text-[#6B4E00]" role="status">
            <Icon name="play" size="sm" /><b>{t('Demo account')}</b><span>{t('Sample data only. Nothing is sent to real companies, and this account is removed after 3 days.')}</span>
            <Link to="/signup" className="font-semibold text-[#6B4E00] underline">{t('Create a real account')}</Link>
          </div>
        )}
        <main key={path} className="mx-auto flex w-full max-w-[1280px] animate-fade flex-col gap-6 p-8 max-[820px]:px-4 max-[820px]:py-5">{children}</main>
      </div>
      {flags?.demoMode && user?.demo && <DemoPanel />}
    </div>
  );
}
