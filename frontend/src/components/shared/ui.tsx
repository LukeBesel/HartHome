import { ReactNode, useEffect } from 'react';
import {
  X, LucideProps, HelpCircle, CheckSquare, Trash2, Utensils, UtensilsCrossed,
  BedDouble, Dog, Wind, Trees, Shirt, Gift, Clapperboard, Tv, IceCream,
  DollarSign, Users, ListChecks, ShoppingCart, Car, Refrigerator, Zap, Wallet,
  Home, Wrench, Droplet, Flame, Wifi, Phone, Plug, Star, Heart, BookOpen,
  Dumbbell, Sparkles, Cake, Sun, Moon, Bike, Plane, Briefcase, GraduationCap,
  Baby, PawPrint, Hammer, Paintbrush, Leaf, Coffee, Pizza, Apple, Bus,
} from 'lucide-react';
import type { User } from '../../types';
import { initials } from '../../utils/format';

// A curated registry of icons that records reference by string name. Using a
// map (instead of `import * as lucide`) keeps the whole icon library out of the
// main bundle while still letting data drive which glyph shows. Unknown names
// fall back to a neutral placeholder.
const ICONS: Record<string, React.ElementType> = {
  CheckSquare, Trash2, Utensils, UtensilsCrossed, BedDouble, Dog, Wind, Trees,
  Shirt, Gift, Clapperboard, Tv, IceCream, DollarSign, Users, ListChecks,
  ShoppingCart, Car, Refrigerator, Zap, Wallet, Home, Wrench, Droplet, Flame,
  Wifi, Phone, Plug, Star, Heart, BookOpen, Dumbbell, Sparkles, Cake, Sun, Moon,
  Bike, Plane, Briefcase, GraduationCap, Baby, PawPrint, Hammer, Paintbrush,
  Leaf, Coffee, Pizza, Apple, Bus,
};

export function Icon({ name, ...props }: { name?: string | null } & LucideProps) {
  const Cmp = (name && ICONS[name]) || HelpCircle;
  return <Cmp {...props} />;
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, icon: IconCmp, actions }: {
  title: string; subtitle?: string; icon?: React.ElementType; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {IconCmp && (
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}>
            <IconCmp size={20} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: IconCmp, label, value, sub, tone = 'indigo' }: {
  icon?: React.ElementType; label: string; value: ReactNode; sub?: ReactNode; tone?: string;
}) {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600', rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600', teal: 'bg-teal-50 text-teal-600',
  };
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        {IconCmp && <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone] || tones.indigo}`}><IconCmp size={16} /></span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col animate-popIn`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`input-field ${p.className || ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`input-field ${p.className || ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`input-field ${p.className || ''}`} />;

export function EmptyState({ icon: IconCmp, title, message, action }: {
  icon?: React.ElementType; title: string; message?: string; action?: ReactNode;
}) {
  return (
    <div className="card py-14 px-6 text-center flex flex-col items-center">
      {IconCmp && <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4"><IconCmp size={26} /></div>}
      <h3 className="font-semibold text-gray-800">{title}</h3>
      {message && <p className="text-sm text-gray-500 mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ user, size = 36, ring }: { user?: Partial<User> | null; size?: number; ring?: boolean }) {
  const color = user?.avatar_color || '#94a3b8';
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${ring ? 'ring-2 ring-white shadow' : ''}`}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
      title={user?.display_name}
    >
      {initials(user?.display_name)}
    </div>
  );
}

export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color || 'linear-gradient(90deg, var(--accent), var(--secondary))' }} />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex bg-gray-100 rounded-xl p-1 text-sm">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${value === o.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    upcoming: 'badge-blue', paid: 'badge-green', done: 'badge-green', overdue: 'badge-red',
    todo: 'badge-gray', active: 'badge-blue', pending: 'badge-amber', approved: 'badge-blue',
    fulfilled: 'badge-green', denied: 'badge-red', archived: 'badge-gray',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}
