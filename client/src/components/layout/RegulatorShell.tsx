import { Link, useNavigate, useRouter } from '@/lib/router';
import { useSession } from '@/lib/session';
import { useT } from '@/i18n/I18nProvider';
import { cn } from '@/lib/format';
import { Icon, LogoMark, Wordmark, Button, type IconName } from '@/components/ui';
import { LanguageMenu } from './LanguageMenu';

const NAV: { to: string; icon: IconName; label: string; group?: string }[] = [
  { to: '/regulator', icon: 'grid', label: 'Overview' },
  { to: '/regulator/complaints', icon: 'scale', label: 'Complaints' },
  { to: '/regulator/companies', icon: 'building', label: 'Companies' },
  { to: '/regulator/notices', icon: 'send', label: 'Notices and inquiries' },
  { to: '/regulator/scores', icon: 'chart', label: 'Public company scores', group: 'Tools' },
  { to: '/regulator/verify', icon: 'shieldc', label: 'Verify a receipt' },
  { to: '/regulator/activity', icon: 'clock', label: 'Officer activity' }
];
const isActive = (path: string, to: string) => (to === '/regulator' ? path === to : path === to || path.startsWith(to + '/')) ||
  (to === '/regulator/notices' && path.startsWith('/regulator/inquiries'));

/** Layout for the regulator console (Data Protection Board officers). */
export function RegulatorShell({ children }: { children: React.ReactNode }) {
  const { staff, logoutStaff } = useSession();
  const { path } = useRouter();
  const navigate = useNavigate();
  const t = useT();
  return (
    <div className="flex min-h-screen max-[820px]:flex-col">
      <aside className="dots sticky top-0 flex h-screen w-[272px] flex-none flex-col gap-1 overflow-y-auto bg-navy px-4 py-6 text-on max-[820px]:static max-[820px]:h-auto max-[820px]:w-auto max-[820px]:flex-row max-[820px]:items-center max-[820px]:overflow-x-auto max-[820px]:px-3 max-[820px]:py-2.5">
        <Link to="/regulator" className="flex flex-none items-center gap-2.5 px-2 pb-6 text-white max-[820px]:pb-0"><LogoMark size={32} /><span className="max-[820px]:hidden"><Wordmark /></span></Link>
        <span className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[.1em] text-[#7F8DA8] max-[820px]:hidden">{t('Regulator console')}</span>
        {NAV.map(n => (<div key={n.to} className="contents">
          {n.group && <span className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[.1em] text-[#7F8DA8] max-[820px]:hidden">{t(n.group)}</span>}
          <Link to={n.to} className={cn('flex min-h-11 flex-none items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 text-[14.5px] font-semibold transition duration-200 max-[820px]:min-h-9 max-[820px]:text-[13.5px]', isActive(path, n.to) ? 'bg-[linear-gradient(100deg,rgba(45,212,191,.20),rgba(59,111,224,.14))] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] [&>svg]:text-accent-b' : 'text-onm hover:bg-white/6 hover:text-white')}>
            <Icon name={n.icon} />{t(n.label)}
          </Link>
        </div>))}
        <div className="glass-dark mt-auto flex flex-col gap-2 rounded-[22px] p-4 max-[820px]:hidden">
          <span className="text-[13px] text-onm">{t('Signed in as')}</span>
          <span className="truncate text-sm font-semibold text-white" translate="no">{staff?.email}</span>
          <span className="text-[13px] text-onm">{t(staff?.org || 'Data Protection Board (demo)')}</span>
          <Button variant="outline" size="sm" full onClick={async () => { await logoutStaff(); navigate('/welcome'); }}><Icon name="logout" size="sm" />{t('Log out')}</Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-line/70 px-8 max-[820px]:static max-[820px]:px-4">
          <span className="font-display text-lg font-bold max-[820px]:text-base">{t('Data Protection Board')}</span>
          <span className="rounded-full border border-[#F3E2B5] bg-part-s px-2.5 py-1 text-xs font-bold text-part">{t('Prototype')}</span>
          <span className="flex-1" />
          <LanguageMenu />
          <button type="button" aria-label={t('Log out')} title={t('Log out')} onClick={async () => { await logoutStaff(); navigate('/welcome'); }} className="hidden size-10 items-center justify-center rounded-full border border-line text-mute max-[820px]:inline-flex"><Icon name="logout" size="sm" /></button>
        </header>
        <main className="mx-auto flex w-full max-w-[1280px] animate-fade flex-col gap-6 p-8 max-[820px]:p-4">{children}</main>
      </div>
    </div>
  );
}
