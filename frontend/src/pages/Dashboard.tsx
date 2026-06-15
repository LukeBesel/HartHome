import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, CheckSquare, Receipt, ShoppingCart, Target, Car, Gift,
  Cake, Megaphone, Activity as ActivityIcon, Plus, Wallet, ArrowRight, Send,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useCollection';
import { Spinner, StatCard, Avatar, ProgressBar, Icon, EmptyState } from '../components/shared/ui';
import { money, fmtTime, dueLabel, daysUntil, relativeTime, memberById } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, refresh } = useAsync(() => api.dashboard(), []);
  const [msg, setMsg] = useState('');

  if (loading && !data) return <div className="p-6"><Spinner /></div>;
  if (!data) return null;
  const m = data.members;

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();

  const postAnnouncement = async () => {
    if (!msg.trim()) return;
    await api.createAnnouncement(msg.trim());
    setMsg('');
    refresh();
  };

  const completeChore = async (id: string) => { await api.completeChore(id); refresh(); };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{greeting}, {user?.display_name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {data.counts.events} events today</p>
        </div>
        <div className="flex -space-x-2">
          {m.map(mem => <Avatar key={mem.id} user={mem} size={36} ring />)}
        </div>
      </div>

      {/* Birthday banner */}
      {data.birthdays.length > 0 && (
        <div className="card p-4 flex items-center gap-3 border-l-4" style={{ borderLeftColor: 'var(--secondary)' }}>
          <Cake className="text-rose-500" size={22} />
          <div className="text-sm text-gray-700">
            <span className="font-semibold">{data.birthdays.map(b => b.display_name).join(', ')}</span> {data.birthdays.length > 1 ? 'have' : 'has'} a birthday coming up soon! 🎉
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link to="/calendar"><StatCard icon={CalendarDays} label="Today" value={data.counts.events} sub="events" tone="indigo" /></Link>
        <Link to="/chores"><StatCard icon={CheckSquare} label="Chores due" value={data.counts.chores} sub="to do" tone="teal" /></Link>
        <Link to="/bills"><StatCard icon={Receipt} label="Bills due" value={money(data.finance.billsTotal)} sub={`${data.counts.bills} upcoming`} tone="rose" /></Link>
        <Link to="/budget"><StatCard icon={Wallet} label="Net worth" value={money(data.finance.netWorth, { cents: false })} sub={`${money(data.finance.monthSpend, { cents: false })} spent this month`} tone="emerald" /></Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's schedule */}
          <Section title="Today's schedule" icon={CalendarDays} to="/calendar">
            {data.todayEvents.length === 0 ? <Muted>Nothing scheduled today. Enjoy the calm. 🌿</Muted> : (
              <div className="space-y-2">
                {data.todayEvents.map(e => (
                  <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50">
                    <span className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0"><div className="font-medium text-gray-800 text-sm truncate">{e.title}</div>
                      <div className="text-xs text-gray-500">{e.all_day ? 'All day' : fmtTime(e.start_at)}{e.location ? ` · ${e.location}` : ''}</div></div>
                    {e.member_id && <Avatar user={memberById(m, e.member_id)} size={26} />}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Chores */}
          <Section title="Chores to knock out" icon={CheckSquare} to="/chores">
            {data.choresDue.length === 0 ? <Muted>All chores done — nice work! ✨</Muted> : (
              <div className="space-y-1.5">
                {data.choresDue.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 group">
                    <button onClick={() => completeChore(c.id)} className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 transition-colors flex-shrink-0" title="Mark done" />
                    <Icon name={c.icon} size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-800 truncate">{c.title}</div>
                      {c.due_date && <div className="text-xs text-gray-400">{dueLabel(c.due_date)}</div>}</div>
                    {c.assignee_id && <Avatar user={memberById(m, c.assignee_id)} size={24} />}
                    <span className="text-xs font-semibold text-emerald-600">+{c.points}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Goals */}
          {data.goals.length > 0 && (
            <Section title="Family goals" icon={Target} to="/goals">
              <div className="grid sm:grid-cols-2 gap-3">
                {data.goals.map(g => (
                  <div key={g.id} className="p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-1.5"><span className="text-sm font-medium text-gray-800 truncate">{g.title}</span></div>
                    <ProgressBar value={g.current} max={g.target} />
                    <div className="text-xs text-gray-500 mt-1.5">{g.unit === '$' ? money(g.current) : `${g.current}`} / {g.unit === '$' ? money(g.target) : `${g.target} ${g.unit}`}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Maintenance */}
          {data.maintenanceDue.length > 0 && (
            <Section title="Upcoming maintenance" icon={Car} to="/assets">
              <div className="space-y-1.5">
                {data.maintenanceDue.map(t => {
                  const overdue = (daysUntil(t.due_date) ?? 0) < 0;
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${overdue ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-800 truncate">{t.title}</div><div className="text-xs text-gray-400">{t.asset_name}</div></div>
                      <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>{dueLabel(t.due_date)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Bulletin */}
          <Section title="Family bulletin" icon={Megaphone}>
            <div className="flex gap-2 mb-3">
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && postAnnouncement()}
                placeholder="Post a note for everyone…" className="input-field text-sm" />
              <button onClick={postAnnouncement} className="btn-primary px-3"><Send size={15} /></button>
            </div>
            <div className="space-y-2.5">
              {data.announcements.length === 0 ? <Muted>No messages yet.</Muted> : data.announcements.map(a => (
                <div key={a.id} className="flex gap-2.5">
                  <Avatar user={{ display_name: a.author_name, avatar_color: a.avatar_color }} size={28} />
                  <div className="flex-1 min-w-0"><div className="text-sm text-gray-700">{a.body}</div>
                    <div className="text-[11px] text-gray-400">{a.author_name} · {relativeTime(a.created_at)}</div></div>
                </div>
              ))}
            </div>
          </Section>

          {/* Points race */}
          <Section title="Points race" icon={Gift} to="/leaderboard">
            <div className="space-y-2.5">
              {[...m].sort((a, b) => b.points - a.points).map((mem, i) => (
                <div key={mem.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <Avatar user={mem} size={28} />
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">{mem.display_name}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{mem.points}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Grocery quick */}
          <Section title="Lists" icon={ShoppingCart} to="/lists">
            {data.groceryLists.length === 0 ? <Muted>No lists yet.</Muted> : (
              <div className="space-y-1.5">
                {data.groceryLists.map(l => (
                  <Link key={l.id} to="/lists" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{l.name}</span>
                    <span className="badge-gray">{l.open_items} open</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* Activity */}
          <Section title="Recent activity" icon={ActivityIcon}>
            {data.activity.length === 0 ? <Muted>Nothing yet.</Muted> : (
              <div className="space-y-2">
                {data.activity.slice(0, 8).map(a => (
                  <div key={a.id} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent)' }} />
                    <span><span className="font-medium text-gray-800">{a.member_name || 'Someone'}</span> {a.message} <span className="text-gray-400">· {relativeTime(a.created_at)}</span></span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: IconCmp, to, children }: { title: string; icon: React.ElementType; to?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><IconCmp size={16} className="text-gray-400" /><h2 className="font-semibold text-gray-800 text-sm">{title}</h2></div>
        {to && <Link to={to} className="text-xs font-medium text-gray-400 hover:text-gray-600 flex items-center gap-0.5">View all <ArrowRight size={12} /></Link>}
      </div>
      {children}
    </div>
  );
}
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-gray-400 py-2">{children}</p>;
