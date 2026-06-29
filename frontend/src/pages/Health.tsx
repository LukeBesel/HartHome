import { useEffect, useMemo, useState } from 'react';
import {
  HeartPulse, Plus, Trash2, Droplet, Footprints, Moon, Scale, Smile, Dumbbell, Pill,
  Target, Lock, Users, Trophy,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useCollection';
import { useLiveRefresh } from '../api/live';
import { PageHeader, Spinner, Modal, Field, Input, Select, Avatar } from '../components/shared/ui';
import { fmtDate } from '../utils/format';
import type { HealthMember, HealthSummary } from '../types';

// Each loggable metric and how it behaves.
const METRICS = [
  { type: 'water', label: 'Water', icon: Droplet, unit: 'glasses', quick: 1, goalDefault: 8, tone: '#06b6d4' },
  { type: 'steps', label: 'Steps', icon: Footprints, unit: 'steps', goalDefault: 10000, tone: '#10b981' },
  { type: 'sleep', label: 'Sleep', icon: Moon, unit: 'hours', goalDefault: 8, tone: '#8b5cf6' },
  { type: 'weight', label: 'Weight', icon: Scale, unit: 'lb', tone: '#6366f1' },
  { type: 'mood', label: 'Mood', icon: Smile, unit: '', tone: '#f59e0b' },
  { type: 'workout', label: 'Workout', icon: Dumbbell, unit: 'min', tone: '#ef4444' },
  { type: 'medication', label: 'Meds', icon: Pill, unit: '', tone: '#ec4899' },
];
const MOODS = ['😣', '😕', '😐', '🙂', '😄'];
const SHARE_LABELS: Record<string, string> = { private: 'Private (only me)', parents: 'Parents can see', household: 'Whole household' };

function Ring({ value, max, color, label, sub }: { value: number; max: number; color: string; label: string; sub: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="-mt-[52px] mb-[30px] text-center"><div className="text-sm font-bold text-gray-900">{label}</div></div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

export default function Health() {
  const { user } = useAuth();
  const { data: members } = useAsync(() => api.healthMembers(), []);
  const [memberId, setMemberId] = useState<string | undefined>(undefined);
  const { data: summary, loading, refresh } = useAsync<HealthSummary>(() => api.healthSummary(memberId), [memberId]);
  useLiveRefresh(refresh);

  const [logType, setLogType] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [chType, setChType] = useState('steps');

  const me = members?.find(m => m.is_self);
  const active: HealthMember | undefined = members?.find(m => m.id === (memberId || me?.id)) || me;
  const canEdit = summary?.member.can_edit ?? active?.can_edit ?? false;

  if (loading && !summary) return <div className="p-6"><Spinner /></div>;

  const goalFor = (t: string) => summary?.goals.find(g => g.type === t);
  const todayVal = (t: string): number => {
    if (!summary) return 0;
    if (t === 'water') return summary.today.water || 0;
    if (t === 'steps') return summary.today.steps || 0;
    if (t === 'sleep') return summary.today.sleep || 0;
    if (t === 'workout') return summary.today.workout || 0;
    return 0;
  };

  // 7-day bar data for steps & water.
  const weekData = useMemo(() => {
    const days: { d: string; label: string; steps: number; water: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 864e5);
      const key = dt.toISOString().slice(0, 10);
      const steps = summary?.trends.week.find(w => w.d === key && w.type === 'steps');
      const water = summary?.trends.week.find(w => w.d === key && w.type === 'water');
      days.push({ d: key, label: dt.toLocaleDateString('en-US', { weekday: 'narrow' }), steps: steps?.m || 0, water: water?.s || 0 });
    }
    return days;
  }, [summary]);
  const weightData = (summary?.trends.weight || []).map(w => ({ d: w.d.slice(5), v: w.v }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Health & Wellness" subtitle="Private by default — you choose what to share" icon={HeartPulse}
        actions={canEdit ? <button className="btn-primary" onClick={() => setLogType('water')}><Plus size={16} /> Log</button> : undefined}
      />

      {/* Member switcher */}
      {members && members.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {members.map(m => (
            <button key={m.id} onClick={() => setMemberId(m.id)}
              className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${(memberId || me?.id) === m.id ? 'border-transparent text-white' : 'border-gray-200 text-gray-600'}`}
              style={(memberId || me?.id) === m.id ? { backgroundColor: m.avatar_color } : {}}>
              <Avatar user={m} size={22} /> {m.display_name.split(' ')[0]}{m.is_self ? ' (me)' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Today rings */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Today</h2>
          {summary?.member && <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Lock size={11} /> {SHARE_LABELS[summary.member.health_share]}</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Ring color="#06b6d4" value={todayVal('water')} max={goalFor('water')?.target || 8} label={`${todayVal('water')}/${goalFor('water')?.target || 8}`} sub="glasses water" />
          <Ring color="#10b981" value={todayVal('steps')} max={goalFor('steps')?.target || 10000} label={`${(todayVal('steps') / 1000).toFixed(1)}k`} sub={`steps / ${((goalFor('steps')?.target || 10000) / 1000)}k`} />
          <Ring color="#8b5cf6" value={todayVal('sleep')} max={goalFor('sleep')?.target || 8} label={`${todayVal('sleep') || '—'}h`} sub="sleep" />
          <div className="flex flex-col items-center justify-center">
            <div className="text-3xl">{summary?.today.mood ? MOODS[(summary.today.mood.value || 3) - 1] : '🙂'}</div>
            <div className="text-sm font-bold text-gray-900 mt-1">{summary?.weight ? `${summary.weight.value} ${summary.weight.unit || 'lb'}` : '—'}</div>
            <div className="text-xs text-gray-500">latest weight</div>
          </div>
        </div>
      </div>

      {/* Quick log */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {METRICS.map(mt => (
            <button key={mt.type} onClick={() => setLogType(mt.type)} className="btn-secondary">
              <mt.icon size={15} style={{ color: mt.tone }} /> {mt.label}
            </button>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Weight trend</h2>
          {weightData.length < 2 ? <p className="text-sm text-gray-400 py-10 text-center">Log your weight a few times to see the trend.</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightData}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="d" fontSize={11} /><YAxis domain={['auto', 'auto']} fontSize={11} width={32} /><Tooltip /><Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-gray-800 mb-3">This week</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={32} /><Tooltip /><Bar dataKey="steps" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-400 text-center mt-1">daily steps</div>
        </div>
      </div>

      {/* Goals */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Target size={16} className="text-gray-400" /> Goals</h2>
          {canEdit && <button className="btn-ghost text-sm" onClick={() => setGoalOpen(true)}><Plus size={15} /> Set goal</button>}
        </div>
        {!summary?.goals.length ? <p className="text-sm text-gray-400">No goals yet.</p> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.goals.map(g => {
              const mt = METRICS.find(m => m.type === g.type);
              const cur = todayVal(g.type);
              const pct = Math.min(100, g.target ? (cur / g.target) * 100 : 0);
              return (
                <div key={g.id} className="p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-800 capitalize flex items-center gap-1.5">{mt && <mt.icon size={14} style={{ color: mt.tone }} />}{g.type}</span>
                    {canEdit && <button onClick={() => api.deleteHealthGoal(g.id).then(refresh)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>}
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: mt?.tone || 'var(--accent)' }} /></div>
                  <div className="text-xs text-gray-500 mt-1.5">{cur} / {g.target} {g.unit} <span className="text-gray-400">· {g.period}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Privacy + family challenge */}
      <div className="grid lg:grid-cols-2 gap-6">
        {summary?.member && canEdit && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-1"><Lock size={16} className="text-gray-400" /> Privacy</h2>
            <p className="text-sm text-gray-500 mb-3">Health data is private by default. Choose who can see {summary.member.id === me?.id ? 'yours' : `${summary.member.display_name}'s`}.</p>
            <Select value={summary.member.health_share} onChange={(e) => api.setHealthShare(e.target.value, summary.member.id).then(refresh)} className="w-full sm:w-72">
              <option value="private">Private — only {summary.member.id === me?.id ? 'me' : 'them'}</option>
              <option value="parents">Parents can see</option>
              <option value="household">Whole household (joins challenges)</option>
            </Select>
          </div>
        )}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Family challenge</h2>
            <Select value={chType} onChange={(e) => setChType(e.target.value)} className="w-32"><option value="steps">Steps</option><option value="water">Water</option></Select>
          </div>
          <Challenge type={chType} />
          <p className="text-[11px] text-gray-400 mt-2">Opt-in: only members who share health with the whole household appear.</p>
        </div>
      </div>

      {logType && <LogModal type={logType} memberId={summary?.member.id} onClose={() => setLogType(null)} onSaved={() => { setLogType(null); refresh(); }} />}
      {goalOpen && <GoalModal memberId={summary?.member.id} onClose={() => setGoalOpen(false)} onSaved={() => { setGoalOpen(false); refresh(); }} />}
    </div>
  );
}

function Challenge({ type }: { type: string }) {
  const { data } = useAsync(() => api.healthChallenge(type, 'week'), [type]);
  if (!data) return <Spinner />;
  if (!data.leaderboard.length) return <p className="text-sm text-gray-400 py-4">No one's joined yet — set health sharing to “Whole household” to play.</p>;
  return (
    <div className="space-y-2">
      {data.leaderboard.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
          <Avatar user={r} size={26} />
          <span className="flex-1 text-sm text-gray-700 truncate">{r.display_name}</span>
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{Math.round(r.total).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function LogModal({ type, memberId, onClose, onSaved }: { type: string; memberId?: string; onClose: () => void; onSaved: () => void }) {
  const mt = METRICS.find(m => m.type === type)!;
  const [t, setT] = useState(type);
  const def = METRICS.find(m => m.type === t)!;
  const [value, setValue] = useState<string>(def.type === 'water' ? '1' : '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.createHealthLog({ member_id: memberId, type: t, value: value ? Number(value) : (t === 'medication' ? 1 : undefined), text, unit: def.unit });
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Modal open title="Log health" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <Field label="What">
        <Select value={t} onChange={(e) => { setT(e.target.value); setValue(e.target.value === 'water' ? '1' : ''); }}>
          {METRICS.map(m => <option key={m.type} value={m.type}>{m.label}</option>)}
        </Select>
      </Field>
      {t === 'mood' ? (
        <Field label="How are you feeling?">
          <div className="flex gap-2">{MOODS.map((emo, i) => (
            <button key={i} onClick={() => setValue(String(i + 1))} className={`text-3xl p-1.5 rounded-xl ${value === String(i + 1) ? 'bg-amber-100 ring-2 ring-amber-300' : 'hover:bg-gray-50'}`}>{emo}</button>
          ))}</div>
        </Field>
      ) : t === 'medication' ? (
        <Field label="Medication / vitamin"><Input value={text} placeholder="e.g. Vitamin D" onChange={(e) => setText(e.target.value)} /></Field>
      ) : (
        <>
          <Field label={`Amount (${def.unit})`}><Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          {(t === 'workout' || t === 'measurement') && <Field label="Note / type"><Input value={text} placeholder={t === 'workout' ? 'e.g. Run' : 'e.g. Waist'} onChange={(e) => setText(e.target.value)} /></Field>}
        </>
      )}
    </Modal>
  );
}

function GoalModal({ memberId, onClose, onSaved }: { memberId?: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('water');
  const def = METRICS.find(m => m.type === type)!;
  const [target, setTarget] = useState(String(def.goalDefault ?? 0));
  const [period, setPeriod] = useState('day');
  const save = async () => {
    await api.createHealthGoal({ member_id: memberId, type, target: Number(target), unit: def.unit, period });
    onSaved();
  };
  return (
    <Modal open title="Set a goal" onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save goal</button></>}>
      <Field label="Metric"><Select value={type} onChange={(e) => { setType(e.target.value); const d = METRICS.find(m => m.type === e.target.value)!; setTarget(String(d.goalDefault ?? 0)); }}>
        {METRICS.filter(m => m.type !== 'mood' && m.type !== 'medication').map(m => <option key={m.type} value={m.type}>{m.label}</option>)}
      </Select></Field>
      <Field label={`Target (${def.unit})`}><Input type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      <Field label="Per"><Select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="day">Day</option><option value="week">Week</option></Select></Field>
    </Modal>
  );
}
