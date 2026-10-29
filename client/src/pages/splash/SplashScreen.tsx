// Screen 1: Splash. Shows for exactly 3 seconds, then opens the Language screen.
import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useT } from '@/i18n/I18nProvider';
import { Icon, LogoMark, ProgressBar } from '@/components/ui';

const DURATION = 3000;

export default function SplashScreen() {
  const navigate = useNavigate();
  const t = useT();
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - start) / DURATION) * 100);
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => navigate('/language', { replace: true }), DURATION);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
  }, [navigate]);

  return (
    <main className="dots relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy p-6 text-on">
      {/* slow aurora */}
      <span className="aurora-blob left-[-10%] top-[-15%] size-[620px] bg-[#14B8A6]/30" aria-hidden="true" />
      <span className="aurora-blob bottom-[-20%] right-[-10%] size-[680px] bg-[#2F66D6]/35 [animation-delay:-9s]" aria-hidden="true" />
      <span className="aurora-blob left-[35%] top-[55%] size-[420px] bg-[#5EEAD4]/15 [animation-delay:-15s]" aria-hidden="true" />
      <span className="particles left-1/2 top-1/2 h-[640px] w-[820px] -translate-x-1/2 -translate-y-1/2 opacity-40" aria-hidden="true" />
      {/* calm ripples, like a drop in still water */}
      <span className="absolute size-[340px] animate-ripple rounded-full border border-accent-b/30" aria-hidden="true" />
      <span className="absolute size-[340px] animate-ripple rounded-full border border-accent-b/25 [animation-delay:1.5s]" aria-hidden="true" />
      <span className="absolute size-[340px] animate-ripple rounded-full border border-white/15 [animation-delay:3s]" aria-hidden="true" />
      <div className="relative flex animate-fade flex-col items-center gap-6">
        <span className="relative grid place-items-center">
          <span className="absolute size-44 animate-breathe rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.35),transparent_70%)]" aria-hidden="true" />
          <span className="relative animate-float"><LogoMark size={120} /></span>
        </span>
        <span className="font-display text-7xl font-extrabold tracking-tight text-white max-[640px]:text-5xl" translate="no">Trace<span className="text-ocean">Erase</span></span>
        <span className="text-lg tracking-wide text-onm">{t('Find it. Delete it. Prove it.')}</span>
      </div>
      <div className="relative mt-16 flex w-72 flex-col items-center gap-3">
        <ProgressBar pct={pct} dark className="h-1.5" />
        <span className="text-[13px] tracking-wide text-onm">{t('Securing your session')}</span>
      </div>
      <div className="absolute bottom-8 flex flex-wrap justify-center gap-3 px-4 text-[13px] text-onm">
        {([['lock', 'Passkey-signed requests'], ['hash', 'Tamper-proof receipts'], ['scale', 'Built on the DPDP Act 2023']] as const).map(([ic, l]) => (
          <span key={l} className="glass-dark flex items-center gap-1.5 rounded-full px-3.5 py-1.5"><Icon name={ic} size="sm" className="text-accent-b" />{t(l)}</span>
        ))}
      </div>
    </main>
  );
}
