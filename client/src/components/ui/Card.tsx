import { cn } from '@/lib/format';
import { Link } from '@/lib/router';

type Div = React.HTMLAttributes<HTMLDivElement>;

/** White rounded surface: the basic building block of every page. */
export function Card({ className, small, flat, ...rest }: Div & { small?: boolean; flat?: boolean }) {
  return <div className={cn('glass flex min-w-0 flex-col border border-edge ring-1 ring-line/60', small ? 'gap-3 rounded-xl p-4' : 'gap-4 rounded-2xl p-6', !flat && 'shadow-card', className)} {...rest} />;
}

export function CardLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return <Link to={to} className={cn('glass flex min-w-0 flex-col gap-4 rounded-2xl border border-edge p-6 text-ink shadow-card ring-1 ring-line/60 transition duration-300 hover:-translate-y-0.5 hover:text-ink hover:shadow-pop hover:ring-accent/40', className)}>{children}</Link>;
}

/** Navy panel with dotted texture, used for hero areas. */
export function DarkPanel({ className, ...rest }: Div) {
  return <div className={cn('dots relative flex flex-col gap-4 overflow-hidden rounded-[18px] bg-navy p-8 text-on shadow-pop', className)} {...rest} />;
}

export function Well({ className, ...rest }: Div) {
  return <div className={cn('flex flex-col gap-2 rounded-xl bg-soft/80 p-4', className)} {...rest} />;
}

/** Teal box that holds an AI result. */
export function AiCard({ className, ...rest }: Div) {
  return <div className={cn('flex flex-col gap-2.5 rounded-2xl border border-accent/25 bg-accent-s p-5', className)} {...rest} />;
}

export const Divider = () => <hr className="m-0 h-px w-full border-0 bg-line" />;
