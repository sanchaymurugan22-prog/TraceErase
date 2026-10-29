import { cn } from '@/lib/format';
import { Link } from '@/lib/router';

type Div = React.HTMLAttributes<HTMLDivElement>;

/** White rounded surface: the basic building block of every page. */
export function Card({ className, small, flat, ...rest }: Div & { small?: boolean; flat?: boolean }) {
  return <div className={cn('glass flex min-w-0 flex-col border border-edge ring-1 ring-line/60', small ? 'gap-3 rounded-[20px] p-4' : 'gap-4 rounded-[26px] p-6', !flat && 'shadow-card', className)} {...rest} />;
}

export function CardLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return <Link to={to} className={cn('glass flex min-w-0 flex-col gap-4 rounded-[26px] border border-edge p-6 text-ink shadow-card ring-1 ring-line/60 transition duration-300 hover:-translate-y-0.5 hover:text-ink hover:shadow-pop hover:ring-accent-b/40', className)}>{children}</Link>;
}

/** Navy panel with dotted texture, used for hero areas. */
export function DarkPanel({ className, ...rest }: Div) {
  return <div className={cn('dots relative flex flex-col gap-4 overflow-hidden rounded-[28px] bg-navy p-8 text-on shadow-pop', className)} {...rest} />;
}

export function Well({ className, ...rest }: Div) {
  return <div className={cn('flex flex-col gap-2 rounded-[20px] bg-soft/80 p-4', className)} {...rest} />;
}

/** Teal box that holds an AI result. */
export function AiCard({ className, ...rest }: Div) {
  return <div className={cn('flex flex-col gap-2.5 rounded-[24px] border border-accent-b/30 bg-[linear-gradient(135deg,rgba(45,212,191,.14),rgba(47,102,214,.08))] p-5', className)} {...rest} />;
}

export const Divider = () => <hr className="m-0 h-px w-full border-0 bg-line" />;
