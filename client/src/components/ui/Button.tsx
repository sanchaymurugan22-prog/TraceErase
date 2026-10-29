import { useState, type ButtonHTMLAttributes } from 'react';
import { Link } from '@/lib/router';
import { cn } from '@/lib/format';
import { Spinner } from './Spinner';
import { useToast } from './Toast';
import { useT } from '@/i18n/I18nProvider';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'white' | 'outline' | 'dark' | 'accent';
export type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'border-transparent bg-ocean text-white shadow-glow hover:-translate-y-px hover:brightness-110 hover:text-white active:translate-y-0',
  secondary: 'border-line bg-card/90 text-ink shadow-[0_1px_2px_rgba(15,50,80,.05)] backdrop-blur hover:border-line2 hover:bg-card hover:text-ink',
  ghost: 'border-transparent bg-transparent text-brand hover:bg-brand-s',
  danger: 'border-transparent bg-[linear-gradient(120deg,#E5484D,#B42318)] text-white shadow-[0_10px_26px_-10px_rgba(180,35,24,.55)] hover:-translate-y-px hover:brightness-110 hover:text-white',
  white: 'border-transparent bg-white text-navy shadow-[0_10px_30px_-10px_rgba(45,212,191,.55)] hover:-translate-y-px hover:bg-[#F0FBFA] hover:text-navy',
  outline: 'border-white/25 bg-white/5 text-white backdrop-blur hover:border-white/40 hover:bg-white/12 hover:text-white',
  dark: 'border-transparent bg-[linear-gradient(120deg,#0C2036,#143152)] text-white shadow-[0_10px_26px_-12px_rgba(6,20,35,.6)] hover:-translate-y-px hover:brightness-125 hover:text-white',
  accent: 'border-transparent bg-[linear-gradient(120deg,#14B8A6,#0C8577)] text-white shadow-[0_10px_26px_-10px_rgba(20,184,166,.55)] hover:-translate-y-px hover:brightness-110 hover:text-white'
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-full',
  md: 'h-11 px-5 text-[15px] rounded-full',
  lg: 'h-[52px] px-7 text-base rounded-full'
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', full = false, className?: string) =>
  cn('inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-5 no-underline transition-all duration-200 disabled:pointer-events-none disabled:opacity-55',
    VARIANTS[variant], SIZES[size], full && 'w-full', className);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean; loading?: boolean };

export function Button({ variant, size, full, loading, className, children, disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={buttonClass(variant, size, full, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}{children}
    </button>
  );
}

export function ButtonLink({ to, variant, size, full, className, children, ...rest }: { to: string; variant?: Variant; size?: Size; full?: boolean; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <Link to={to} className={buttonClass(variant, size, full, className)} {...rest}>{children}</Link>;
}

/** A button that runs an async action, shows a spinner, and reports errors as a toast. */
export function ActionButton({ onClick, children, ...rest }: Omit<BtnProps, 'onClick'> & { onClick: () => unknown | Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const t = useT();
  return (
    <Button {...rest} loading={busy} onClick={async () => {
      setBusy(true);
      try { await onClick(); } catch (err: any) { toast(t(err?.message || 'Something went wrong'), 'err'); } finally { setBusy(false); }
    }}>{children}</Button>
  );
}

export function LinkButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('border-0 bg-transparent p-0 font-semibold text-brand hover:text-brand-d', className)} {...rest} />;
}
