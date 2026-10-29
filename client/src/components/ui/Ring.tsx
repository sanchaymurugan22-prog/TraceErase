/** Circular progress ring with content in the middle. */
export function Ring({ pct, size = 150, color, children }: { pct: number; size?: number; color?: string; children?: React.ReactNode }) {
  const inner = size - 32;
  return (
    <div className="grid flex-none place-items-center rounded-full" style={{ width: size, height: size, background: color ? `conic-gradient(${color} 0 ${pct}%, var(--color-soft2) ${pct}% 100%)` : `conic-gradient(#14B8A6 0%, #2F66D6 ${pct}%, var(--color-soft2) ${pct}% 100%)`, boxShadow: '0 12px 30px -14px rgba(47,102,214,.45)' }}>
      <div className="flex flex-col items-center justify-center rounded-full bg-card" style={{ width: inner, height: inner }}>{children}</div>
    </div>
  );
}

export function ProgressBar({ pct, color, dark, className }: { pct: number; color?: string; dark?: boolean; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${dark ? 'bg-white/12' : 'bg-soft2'} ${className || ''}`}>
      <span className={`block h-full rounded-full transition-[width] duration-700 ${color ? '' : 'bg-ocean'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}
