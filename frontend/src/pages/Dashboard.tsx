import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, CheckSquare, Receipt, ShoppingCart, Target, Car, Gift,
  Cake, Megaphone, Activity as ActivityIcon, Wallet, ArrowRight, Send,
  Image as ImageIcon, SlidersHorizontal, GripVertical, ChevronUp, ChevronDown,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAsync } from '../hooks/useCollection';
import { useLiveRefresh } from '../api/live';
import { Spinner, StatCard, Avatar, ProgressBar, Icon, Modal } from '../components/shared/ui';
import { money, fmtTime, dueLabel, daysUntil, relativeTime, memberById } from '../utils/format';
import type { DashboardWidgetPref } from '../types';

// Each home-screen widget: an id, a label for the customizer, and the grid span
// it occupies on a 6-column desktop grid. Order + visibility are user prefs.
const WIDGETS: { id: string; label: string; span: string }[] = [
  { id: 'stats', label: 'Quick stats', span: 'lg:col-span-6' },
  { id: 'schedule', label: "Today's schedule", span: 'lg:col-span-4' },
  { id: 'chores', label: 'Chores', span: 'lg:col-span-4' },
  { id: 'bulletin', label: 'Family bulletin', span: 'lg:col-span-2' },
  { id: 'points', label: 'Points race', span: 'lg:col-span-2' },
  { id: 'goals', label: 'Goals', span: 'lg:col-span-3' },
  { id: 'maintenance', label: 'Maintenance', span: 'lg:col-span-3' },
  { id: 'lists', label: 'Lists', span: 'lg:col-span-2' },
  { id: 'photos', label: 'Photos', span: 'lg:col-span-2' },
  { id: 'activity', label: 'Recent activity', span: 'lg:col-span-2' },
];
const DEFAULT_ORDER: DashboardWidgetPref[] = WIDGETS.map(w => ({ id: w.id, enabled: true }));

export default function Dashboard() {
  const { user } = useAuth();
  const { prefs, setPrefs } = useTheme();
  const { data, loading, refresh } = useAsync(() => api.dashboard(), []);
  const { data: photos } = useAsync(() => api.photos(), []);
  useLiveRefresh(refresh);
  const [msg, setMsg] = useState('');
  const [customizing, setCustomizing] = useState(false);

  if (loading && !data) return <div className="p-6"><Spinner /></div>;
  if (!data) return null;
  const m = data.members;

  // Resolve the widget layout from prefs, healing it against the registry so new
  // widgets appear and removed ones drop out.
  const saved = prefs.dashboard?.widgets || DEFAULT_ORDER;
  const layout: DashboardWidgetPref[] = [
    ...saved.filter(w => WIDGETS.some(x => x.id === w.id)),
    ...WIDGETS.filter(x => !saved.some(w => w.id === x.id)).map(x => ({ id: x.id, enabled: true })),
  ];
  const saveLayout = (next: DashboardWidgetPref[]) => setPrefs({ dashboard: { widgets: next } });
  const move = (i: number, dir: number) => {
    const next = [...layout]; const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    saveLayout(next);
  };
  const toggle = (id: string) => saveLayout(layout.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();
  const postAnnouncement = async () => { if (!msg.trim()) return; await api.createAnnouncement(msg.trim()); setMsg(''); refresh(); };
  const completeChore = async (id: string) => { await api.completeChore(id); refresh(); };

  const widgetNode = (id: string) => {
    switch (id) {
      case 'stats': return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link to="/calendar"><StatCard icon={CalendarDays} label="Today" value={data.counts.events} sub="events" tone="indigo" /></Link>
          <Link to="/chores"><StatCard icon={CheckSquare} label="Chores due" value={data.counts.chores} sub="to do" tone="teal" /></Link>
          <Link to="/bills"><StatCard icon={Receipt} label="Bills due" value={money(data.finance.billsTotal)} sub={`${data.counts.bills} upcoming`} tone="rose" /></Link>
          <Link to="/budget"><StatCard icon={Wallet} label="Net worth" value={money(data.finance.netWorth, { cents: false })} sub={`${money(data.finance.monthSpend, { cents: false })} spent`} tone="emerald" /></Link>
        </div>
      );
      case 'schedule': return (
        <Section title="Today's schedule" icon={CalendarDays} to="/calendar">
          {data.todayEvents.length === 0 ? <Muted>Nothing scheduled today. Enjoy the calm. 🌿</Muted> : (
            <div className="space-y-2">{data.todayEvents.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                <span className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: e.color }} />
                <div className="flex-1 min-w-0"><div className="font-medium text-gray-800 text-sm truncate">{e.title}</div>
                  <div className="text-xs text-gray-500">{e.all_day ? 'All day' : fmtTime(e.start_at)}{e.location ? ` · ${e.location}` : ''}</div></div>
                {e.member_id && <Avatar user={memberById(m, e.member_id)} size={26} />}
              </div>))}
            </div>
          )}
        </Section>
      );
      case 'chores': return (
        <Section title="Chores to knock out" icon={CheckSquare} to="/chores">
          {data.choresDue.length === 0 ? <Muted>All chores done — nice work! ✨</Muted> : (
            <div className="space-y-1.5">{data.choresDue.slice(0, 6).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 group">
                <button onClick={() => completeChore(c.id)} className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex-shrink-0" title="Mark done" />
                <Icon name={c.icon} size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-800 truncate">{c.title}</div>
                  {c.due_date && <div className="text-xs text-gray-400">{dueLabel(c.due_date)}</div>}</div>
                {c.assignee_id && <Avatar user={memberById(m, c.assignee_id)} size={24} />}
                <span className="text-xs font-semibold text-emerald-600">+{c.points}</span>
              </div>))}
            </div>
          )}
        </Section>
      );
      case 'goals': return data.goals.length === 0 ? null : (
        <Section title="Family goals" icon={Target} to="/goals">
          <div className="grid sm:grid-cols-2 gap-3">{data.goals.map(g => (
            <div key={g.id} className="p-3 rounded-xl border border-gray-100">
              <div className="text-sm font-medium text-gray-800 truncate mb-1.5">{g.title}</div>
              <ProgressBar value={g.current} max={g.target} />
              <div className="text-xs text-gray-500 mt-1.5">{g.unit === '$' ? money(g.current) : g.current} / {g.unit === '$' ? money(g.target) : `${g.target} ${g.unit}`}</div>
            </div>))}
          </div>
        </Section>
      );
      case 'maintenance': return data.maintenanceDue.length === 0 ? null : (
        <Section title="Upcoming maintenance" icon={Car} to="/assets">
          <div className="space-y-1.5">{data.maintenanceDue.map(t => {
            const overdue = (daysUntil(t.due_date) ?? 0) < 0;
            return (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${overdue ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-800 truncate">{t.title}</div><div className="text-xs text-gray-400">{t.asset_name}</div></div>
                <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>{dueLabel(t.due_date)}</span>
              </div>);
          })}</div>
        </Section>
      );
      case 'bulletin': return (
        <Section title="Family bulletin" icon={Megaphone}>
          <div className="flex gap-2 mb-3">
            <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && postAnnouncement()} placeholder="Post a note…" className="input-field text-sm" />
            <button onClick={postAnnouncement} className="btn-primary px-3"><Send size={15} /></button>
          </div>
          <div className="space-y-2.5">{data.announcements.length === 0 ? <Muted>No messages yet.</Muted> : data.announcements.map(a => (
            <div key={a.id} className="flex gap-2.5">
              <Avatar user={{ display_name: a.author_name, avatar_color: a.avatar_color }} size={28} />
              <div className="flex-1 min-w-0"><div className="text-sm text-gray-700">{a.body}</div><div className="text-[11px] text-gray-400">{a.author_name} · {relativeTime(a.created_at)}</div></div>
            </div>))}
          </div>
        </Section>
      );
      case 'points': return (
        <Section title="Points race" icon={Gift} to="/leaderboard">
          <div className="space-y-2.5">{[...m].sort((a, b) => b.points - a.points).map((mem, i) => (
            <div key={mem.id} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span><Avatar user={mem} size={28} />
              <span className="flex-1 text-sm font-medium text-gray-700 truncate">{mem.display_name}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{mem.points}</span>
            </div>))}
          </div>
        </Section>
      );
      case 'lists': return (
        <Section title="Lists" icon={ShoppingCart} to="/lists">
          {data.groceryLists.length === 0 ? <Muted>No lists yet.</Muted> : (
            <div className="space-y-1.5">{data.groceryLists.map(l => (
              <Link key={l.id} to="/lists" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <span className="text-sm text-gray-700">{l.name}</span><span className="badge-gray">{l.open_items} open</span>
              </Link>))}
            </div>
          )}
        </Section>
      );
      case 'photos': return !photos || photos.length === 0 ? null : (
        <Section title="Photos" icon={ImageIcon} to="/photos">
          <div className="grid grid-cols-3 gap-1.5">{photos.slice(0, 6).map(p => (
            <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-black"><img src={p.url} alt={p.caption} className="w-full h-full object-cover" loading="lazy" /></div>
          ))}</div>
        </Section>
      );
      case 'activity': return (
        <Section title="Recent activity" icon={ActivityIcon}>
          {data.activity.length === 0 ? <Muted>Nothing yet.</Muted> : (
            <div className="space-y-2">{data.activity.slice(0, 8).map(a => (
              <div key={a.id} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent)' }} />
                <span><span className="font-medium text-gray-800">{a.member_name || 'Someone'}</span> {a.message} <span className="text-gray-400">· {relativeTime(a.created_at)}</span></span>
              </div>))}
            </div>
          )}
        </Section>
      );
      default: return null;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{greeting}, {user?.display_name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {data.counts.events} events today</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">{m.map(mem => <Avatar key={mem.id} user={mem} size={36} ring />)}</div>
          <button className="btn-secondary" onClick={() => setCustomizing(true)}><SlidersHorizontal size={15} /> Customize</button>
        </div>
      </div>

      {data.birthdays.length > 0 && (
        <div className="card p-4 flex items-center gap-3 border-l-4" style={{ borderLeftColor: 'var(--secondary)' }}>
          <Cake className="text-rose-500" size={22} />
          <div className="text-sm text-gray-700"><span className="font-semibold">{data.birthdays.map(b => b.display_name).join(', ')}</span> {data.birthdays.length > 1 ? 'have' : 'has'} a birthday coming up soon! 🎉</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 sm:gap-6 items-start">
        {layout.filter(w => w.enabled).map(w => {
          const meta = WIDGETS.find(x => x.id === w.id)!;
          const node = widgetNode(w.id);
          if (!node) return null;
          return <div key={w.id} className={meta.span}>{node}</div>;
        })}
      </div>

      <Modal open={customizing} title="Customize your home screen" onClose={() => setCustomizing(false)}
        footer={<button className="btn-primary" onClick={() => setCustomizing(false)}>Done</button>}>
        <p className="text-sm text-gray-500">Show, hide, and reorder the cards on your dashboard. Saved to your profile.</p>
        <div className="space-y-1.5">
          {layout.map((w, i) => {
            const meta = WIDGETS.find(x => x.id === w.id)!;
            return (
              <div key={w.id} className="flex items-center gap-2 p-2 rounded-xl border border-gray-100">
                <GripVertical size={15} className="text-gray-300" />
                <span className={`flex-1 text-sm font-medium ${w.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{meta.label}</span>
                <button className="btn-ghost p-1" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ChevronUp size={15} /></button>
                <button className="btn-ghost p-1" onClick={() => move(i, 1)} disabled={i === layout.length - 1} aria-label="Move down"><ChevronDown size={15} /></button>
                <button onClick={() => toggle(w.id)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${w.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  {w.enabled ? 'Shown' : 'Hidden'}
                </button>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, icon: IconCmp, to, children }: { title: string; icon: React.ElementType; to?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><IconCmp size={16} className="text-gray-400" /><h2 className="font-semibold text-gray-800 text-sm">{title}</h2></div>
        {to && <Link to={to} className="text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-0.5">View all <ArrowRight size={12} /></Link>}
      </div>
      {children}
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-gray-400 py-2">{children}</p>;
