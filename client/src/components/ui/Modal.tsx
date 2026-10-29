import { useEffect } from 'react';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

export function Modal({ children, onClose, label, wide, className }: { children: React.ReactNode; onClose?: () => void; label: string; wide?: boolean; className?: string }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade items-center justify-center bg-[#061423]/55 p-6 backdrop-blur-md max-[640px]:p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div role="dialog" aria-modal="true" aria-label={label}
        className={cn('relative flex max-h-[90vh] w-full animate-fade flex-col gap-5 overflow-y-auto rounded-[30px] border border-edge bg-card p-8 shadow-modal max-[640px]:p-5', wide ? 'max-w-3xl' : 'max-w-xl', className)}>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-mute transition hover:bg-soft hover:text-ink">
            <Icon name="x" size="sm" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
