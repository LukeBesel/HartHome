import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, CheckSquare, Receipt, ShoppingCart, Target, Car, Gift,
  Cake, Megaphone, Activity as ActivityIcon, Wallet, ArrowRight, Send,
  Image as ImageIcon, SlidersHorizontal, GripVertical, Settings2, Eye, EyeOff, HeartPulse, ExternalLink, Footprints, Moon as MoonIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { openHartCare, fetchHartCareSummary, HartCareSummary } from '../api/hartcare';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAsync } from '../hooks/useCollection';
import { useLiveRefresh } from '../api/live';
import { Spinner, StatCard, Avatar, ProgressBar, Icon, Modal, Select } from '../components/shared/ui';
import { money, fmtTime, fmtDate, dueLabel, daysUntil, relativeTime, memberById } from '../utils/format';
import type { DashboardWidgetPref } from '../types';

// Each home-screen widget: an id, a label for the customizer, and the grid span
// it occupies on a 6-column desktop grid. Order + visibility are user prefs.
// Ordered so the default layout packs the 6-column grid with no gaps:
// stats(6) · schedule(4)+bulletin(2) · chores(4)+points(2) ·
// goals(3)+maintenance(3) · lists(2)+photos(2)+activity(2) · hartcare(2).
const WIDGETS: { id: string; label: string; span: string }[] = [
  { id: 'stats', label: 'Quick stats', span: 'lg:col-span-6' },
  { id: 'schedule', label: "Today's schedule", span: 'lg:col-span-4' },
  { id: 'bulletin', label: 'Family bulletin', span: 'lg:col-span-2' },
  { id: 'chores', label: 'Chores', span: 'lg:col-span-4' },
  { id: 'points', label: 'Points race', span: 'lg:col-span-2' },
  { id: 'goals', label: 'Goals', span: 'lg:col-span-3' },
  { id: 'maintenance', label: 'Maintenance', span: 'lg:col-span-3' },
  { id: 'lists', label: 'Lists', span: 'lg:col-span-2' },
  { id: 'photos', label: 'Photos', span: 'lg:col-span-2' },
  { id: 'activity', label: 'Recent activity', span: 'lg:col-span-2' },
  { id: 'hartcare', label: 'HartCare', span: 'lg:col-span-2' },
];
const DEFAULT_ORDER: DashboardWidgetPref[] = WIDGETS.map(w => ({ id: w.id, enabled: true }));

// Per-widget settings, surfaced in the Customize panel.
const opts = (arr: (string | number)[]) => arr.map(v => ({ value: String(v), label: String(v) }));
const SETTINGS: Record<string, { key: string; label: string; options: { value: string; label: string }[]; def: string }[]> = {
  schedule: [{ key: 'range', label: 'Show', def: 'today', options: [{ value: 'today', label: 'Today' }, { value: '3days', label: 'Next 3 days' }, { value: 'week', label: 'This week' }] }],
  chores: [{ key: 'limit', label: 'Items', def: '6', options: opts([3, 6, 10, 20]) }],
  goals: [{ key: 'limit', label: 'Items', def: '6', options: opts([2, 4, 6]) }],
  points: [{ key: 'limit', label: 'Show', def: '99', options: [{ value: '3', label: 'Top 3' }, { value: '5', label: 'Top 5' }, { value: '99', label: 'Everyone' }] }],
  lists: [{ key: 'limit', label: 'Items', def: '6', options: opts([3, 6, 10]) }],
  photos: [{ key: 'count', label: 'Photos', def: '6', options: opts([3, 6, 9, 12]) }],
  activity: [{ key: 'limit', label: 'Items', def: '8', options: opts([5, 8, 12]) }],
};

export default function Dashboard() {
  const { user } = useAuth();
  const { prefs, setPrefs } = useTheme();
  const { data, loading, refresh } = useAsync(() => api.dashboard(), []);
  const { data: photos } = useAsync(() => api.photos(), []);
  useLiveRefresh(refresh);
  const [msg, setMsg] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);

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
  const widgetConfig = prefs.dashboard?.config || {};
  const saveLayout = (next: DashboardWidgetPref[]) => setPrefs({ dashboard: { ...prefs.dashboard, widgets: next } });
  const toggle = (id: string) => saveLayout(layout.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  const cfg = (id: string, key: string) => widgetConfig[id]?.[key] ?? SETTINGS[id]?.find(s => s.key === key)?.def ?? '';
  const setCfg = (id: string, key: string, value: string) =>
    setPrefs({ dashboard: { ...prefs.dashboard, widgets: layout, config: { ...widgetConfig, [id]: { ...widgetConfig[id], [key]: value } } } });

  // Reorder via native drag-and-drop in the customize list.
  const reorder = (from: string, to: string) => {
    if (from === to) return;
    const next = [...layout];
    const fi = next.findIndex(w => w.id === from), ti = next.findIndex(w => w.id === to);
    if (fi < 0 || ti < 0) return;
    const [moved] = next.splice(fi, 1);
    next.splice(ti, 0, moved);
    saveLayout(next);
  };
  const lim = (id: string, key: string) => parseInt(cfg(id, key), 10) || 99;

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();
  const postAnnouncement = async () => { if (!msg.trim()) return; await api.createAnnouncement(msg.trim()); setMsg(''); refresh(); };
  const completeChore = async (id: string) => { await api.completeChore(id); refresh(); };

  const widgetNode = (id: string) => {
    switch (id) {
      case 'stats': return (
        <div className={`grid grid-cols-2 ${data.financeHidden ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-3 sm:gap-4`}>
          <Link to="/calendar"><StatCard icon={CalendarDays} label="Today" value={data.counts.events} sub="events" tone="indigo" /></Link>
          <Link to="/chores"><StatCard icon={CheckSquare} label="Chores due" value={data.counts.chores} sub="to do" tone="teal" /></Link>
          {!data.financeHidden && <Link to="/bills"><StatCard icon={Receipt} label="Bills due" value={money(data.finance.billsTotal)} sub={`${data.counts.bills} upcoming`} tone="rose" /></Link>}
          {!data.financeHidden && <Link to="/budget"><StatCard icon={Wallet} label="Net worth" value={money(data.finance.netWorth, { cents: false })} sub={`${money(data.finance.monthSpend, { cents: false })} spent`} tone="emerald" /></Link>}
        </div>
      );
      case 'schedule': {
        const range = cfg('schedule', 'range');
        const within = range === '3days' ? 3 : 7;
        const evs = range === 'today'
          ? data.todayEvents
          : [...data.todayEvents, ...data.upcomingEvents.filter(e => (daysUntil(e.start_at) ?? 99) <= within)];
        const titleTxt = range === 'today' ? "Today's schedule" : range === '3days' ? 'Next 3 days' : 'This week';
        return (
          <Section title={titleTxt} icon={CalendarDays} to="/calendar">
            {evs.length === 0 ? <Muted>Nothing scheduled. Enjoy the calm. 🌿</Muted> : (
              <div className="space-y-2">{evs.map(e => {
                const d = daysUntil(e.start_at) ?? 0;
                return (
                  <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                    <span className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0"><div className="font-medium text-gray-800 text-sm truncate">{e.title}</div>
                      <div className="text-xs text-gray-500">{range !== 'today' && d > 0 ? `${fmtDate(e.start_at)} · ` : ''}{e.all_day ? 'All day' : fmtTime(e.start_at)}{e.location ? ` · ${e.location}` : ''}</div></div>
                    {e.member_id && <Avatar user={memberById(m, e.member_id)} size={26} />}
                  </div>);
              })}
              </div>
            )}
          </Section>
        );
      }
      case 'chores': return (
        <Section title="Chores to knock out" icon={CheckSquare} to="/chores">
          {data.choresDue.length === 0 ? <Muted>All chores done — nice work! ✨</Muted> : (
            <div className="space-y-1.5">{data.choresDue.slice(0, lim('chores', 'limit')).map(c => (
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
          <div className="grid sm:grid-cols-2 gap-3">{data.goals.slice(0, lim('goals', 'limit')).map(g => (
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
          <div className="space-y-2.5">{[...m].sort((a, b) => b.points - a.points).slice(0, lim('points', 'limit')).map((mem, i) => (
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
            <div className="space-y-1.5">{data.groceryLists.slice(0, lim('lists', 'limit')).map(l => (
              <Link key={l.id} to="/lists" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <span className="text-sm text-gray-700">{l.name}</span><span className="badge-gray">{l.open_items} open</span>
              </Link>))}
            </div>
          )}
        </Section>
      );
      case 'photos': return !photos || photos.length === 0 ? null : (
        <Section title="Photos" icon={ImageIcon} to="/photos">
          <div className="grid grid-cols-3 gap-1.5">{photos.slice(0, lim('photos', 'count')).map(p => (
            <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-black"><img src={p.url} alt={p.caption} className="w-full h-full object-cover" loading="lazy" /></div>
          ))}</div>
        </Section>
      );
      case 'activity': return (
        <Section title="Recent activity" icon={ActivityIcon}>
          {data.activity.length === 0 ? <Muted>Nothing yet.</Muted> : (
            <div className="space-y-2">{data.activity.slice(0, lim('activity', 'limit')).map(a => (
              <div key={a.id} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent)' }} />
                <span><span className="font-medium text-gray-800">{a.member_name || 'Someone'}</span> {a.message} <span className="text-gray-400">· {relativeTime(a.created_at)}</span></span>
              </div>))}
            </div>
          )}
        </Section>
      );
      case 'hartcare': return <HartCareTile url={user?.household?.hartcare_url} isPlus={user?.household?.plan === 'plus'} />;
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
        <p className="text-sm text-gray-500">Drag to reorder, toggle visibility, and tune each card. Saved to your profile.</p>
        <div className="space-y-1.5">
          {layout.map((w) => {
            const meta = WIDGETS.find(x => x.id === w.id)!;
            const settings = SETTINGS[w.id];
            const expanded = settingsFor === w.id;
            return (
              <div key={w.id}
                draggable
                onDragStart={() => setDragId(w.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) reorder(dragId, w.id); setDragId(null); }}
                onDragEnd={() => setDragId(null)}
                className={`rounded-xl border border-gray-100 transition-all ${dragId === w.id ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2 p-2">
                  <GripVertical size={15} className="text-gray-300 cursor-grab active:cursor-grabbing" />
                  <span className={`flex-1 text-sm font-medium ${w.enabled ? 'text-gray-800' : 'text-gray-400'}`}>{meta.label}</span>
                  {settings && (
                    <button className={`btn-ghost p-1 ${expanded ? 'text-indigo-600' : ''}`} onClick={() => setSettingsFor(expanded ? null : w.id)} aria-label="Widget settings"><Settings2 size={14} /></button>
                  )}
                  <button onClick={() => toggle(w.id)} className="btn-ghost p-1" aria-label={w.enabled ? 'Hide' : 'Show'} title={w.enabled ? 'Shown' : 'Hidden'}>
                    {w.enabled ? <Eye size={15} className="text-emerald-600" /> : <EyeOff size={15} className="text-gray-400" />}
                  </button>
                </div>
                {settings && expanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-50">
                    {settings.map(s => (
                      <label key={s.key} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-500">{s.label}</span>
                        <Select value={cfg(w.id, s.key)} onChange={(e) => setCfg(w.id, s.key, e.target.value)} className="w-36">
                          {s.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                      </label>
                    ))}
                  </div>
                )}
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

// Live HartCare tile — pulls a wellness summary if HartCare is connected and has
// implemented the summary endpoint; otherwise degrades to a launch/connect card.
function HartCareTile({ url, isPlus }: { url?: string; isPlus?: boolean }) {
  const [summary, setSummary] = useState<HartCareSummary | null>(null);
  useEffect(() => { if (url && isPlus) fetchHartCareSummary(url).then(setSummary).catch(() => {}); }, [url, isPlus]);
  // Free plan: a teaser that links to the HartCare hub (with its upgrade CTA).
  if (!isPlus) {
    return (
      <div className="card p-4 sm:p-5 h-full" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(245,158,11,0.06))' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><HeartPulse size={16} className="text-rose-500" /><h2 className="font-semibold text-gray-800 text-sm">HartCare</h2></div>
          <span className="badge badge-amber">Hart+</span>
        </div>
        <p className="text-sm text-gray-600">Your family's health & wellness, connected to this home — steps, sleep and reminders right here.</p>
        <Link to="/hartcare" className="btn-primary mt-3 inline-flex">See what's included</Link>
      </div>
    );
  }
  return (
    <div className="card p-4 sm:p-5 h-full" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(245,158,11,0.06))' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><HeartPulse size={16} className="text-rose-500" /><h2 className="font-semibold text-gray-800 text-sm">HartCare</h2></div>
        {url && <button onClick={() => openHartCare(url)} className="text-xs font-medium text-rose-500 hover:text-rose-600 flex items-center gap-0.5">Open <ExternalLink size={12} /></button>}
      </div>
      {!url ? (
        <div className="text-sm text-gray-500">Connect your family's wellness app in <Link to="/settings" className="font-medium" style={{ color: 'var(--accent)' }}>Settings</Link>.</div>
      ) : summary ? (
        <div className="space-y-2.5">
          {summary.headline && <div className="text-sm text-gray-700">{summary.headline}</div>}
          <div className="grid grid-cols-3 gap-2">
            {summary.steps != null && <Metric icon={Footprints} label="steps" value={summary.steps.toLocaleString()} />}
            {summary.activeMinutes != null && <Metric icon={HeartPulse} label="active min" value={String(summary.activeMinutes)} />}
            {summary.sleepHours != null && <Metric icon={MoonIcon} label="sleep" value={`${summary.sleepHours}h`} />}
          </div>
          {summary.reminders?.length ? <ul className="text-xs text-gray-500 list-disc pl-4 space-y-0.5">{summary.reminders.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          <p>Your family wellness hub.</p>
          <button onClick={() => openHartCare(url)} className="btn-secondary mt-3"><ExternalLink size={15} /> Open HartCare</button>
        </div>
      )}
    </div>
  );
}
function Metric({ icon: I, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="rounded-xl bg-white/70 border border-gray-100 p-2 text-center"><I size={14} className="mx-auto text-rose-500" /><div className="text-base font-bold text-gray-900 mt-0.5">{value}</div><div className="text-[10px] text-gray-400">{label}</div></div>;
}
