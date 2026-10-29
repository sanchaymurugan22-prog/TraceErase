import { Link } from '@/lib/router';
import { Logo } from '@/components/ui';
import { LanguageMenu } from './LanguageMenu';

/** Two-column layout for sign-up and log-in: navy story on the left, form on the right. */
export function AuthSplit({ left, children }: { left: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen max-[820px]:flex-col">
      <aside className="dots relative isolate flex flex-[0_0_44%] flex-col gap-8 overflow-hidden bg-navy px-14 py-10 text-on max-[1100px]:basis-[40%] max-[1100px]:p-8 max-[820px]:basis-auto">
        <Link to="/welcome" aria-label="TraceErase"><Logo /></Link>
        <span className="particles -right-40 top-1/4 h-[520px] w-[660px] opacity-50" aria-hidden="true" />
        <span className="aurora-blob -left-24 top-1/3 size-[380px] bg-accent-b/20" aria-hidden="true" />
        <span className="aurora-blob -bottom-32 right-0 size-[360px] bg-[#3B6FE0]/25 [animation-delay:-11s]" aria-hidden="true" />
        <div className="relative flex flex-1 flex-col gap-8">{left}</div>
      </aside>
      <main className="relative isolate flex min-w-0 flex-1 flex-col overflow-hidden px-14 py-10 max-[1100px]:p-8 max-[640px]:px-5">
        <span className="aurora-blob -right-40 -top-40 size-[420px] bg-accent-b/15" aria-hidden="true" />
        <span className="aurora-blob -bottom-48 left-10 size-[460px] bg-brand/10 [animation-delay:-8s]" aria-hidden="true" />
        <div className="relative flex justify-end"><LanguageMenu showLabel /></div>
        <div className="glass relative m-auto flex w-full max-w-[480px] animate-fade flex-col gap-5 rounded-[30px] border border-edge p-9 shadow-pop ring-1 ring-line/50 max-[640px]:p-6">{children}</div>
      </main>
    </div>
  );
}
