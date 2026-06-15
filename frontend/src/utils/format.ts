import type { User } from '../types';

export const money = (n: number | null | undefined, opts: { cents?: boolean } = {}) => {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });
};

export const fmtDate = (s?: string | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(+d)) return '—';
  return d.toLocaleDateString('en-US', opts);
};

export const fmtTime = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const fmtDateTime = (s?: string | null) =>
  `${fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(s)}`;

export const relativeTime = (s?: string | null) => {
  if (!s) return '';
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(s);
};

// Days until a date; negative means overdue.
export const daysUntil = (s?: string | null): number | null => {
  if (!s) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(s); d.setHours(0, 0, 0, 0);
  return Math.round((+d - +today) / 864e5);
};

export const dueLabel = (s?: string | null) => {
  const n = daysUntil(s);
  if (n === null) return 'No date';
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return `In ${n} days`;
  return fmtDate(s);
};

export const toLocalInput = (s?: string | null) => {
  const d = s ? new Date(s) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(+d - off * 60000).toISOString().slice(0, 16);
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const memberById = (members: User[], id?: string | null) => members.find(m => m.id === id);

export const initials = (name?: string) =>
  (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
