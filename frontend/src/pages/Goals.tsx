import { useMemo, useState } from 'react';
import { Target, Plus, Trash2, Pencil, Check, Minus, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Textarea, Select, Segmented, Avatar, EmptyState, ProgressBar,
} from '../components/shared/ui';
import { money, dueLabel, daysUntil, memberById } from '../utils/format';
import type { Goal, User } from '../types';

const CATEGORIES = ['family', 'finance', 'health', 'learning', 'home', 'personal'];
type Filter = 'active' | 'done' | 'all';

interface GoalForm {
  id?: string;
  title: string;
  description: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  member_id: string;
  due_date: string;
}

const emptyForm = (): GoalForm => ({
  title: '', description: '', category: 'family', target: 100, current: 0, unit: '%', member_id: '', due_date: '',
});

const fmtValue = (n: number, unit: string) => (unit === '$' ? money(n) : `${n}${unit && unit !== '$' ? ' ' + unit : ''}`);

export default function Goals() {
  const { data: goals, loading, refresh } = useAsync(() => api.goals(), []);
  const { data: members } = useAsync(() => api.members(), []);
  const [filter, setFilter] = useState<Filter>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<GoalForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Progress-update modal
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [progressValue, setProgressValue] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  const memberList: User[] = members || [];
  const allGoals: Goal[] = goals || [];

  const filtered = useMemo(
    () => (filter === 'all' ? allGoals : allGoals.filter((g) => g.status === filter)),
    [allGoals, filter],
  );

  const activeCount = allGoals.filter((g) => g.status === 'active').length;
  const doneCount = allGoals.filter((g) => g.status === 'done').length;
  const avgProgress = useMemo(() => {
    const active = allGoals.filter((g) => g.status === 'active');
    if (!active.length) return 0;
    const sum = active.reduce((s, g) => s + Math.min(100, (g.current / (g.target || 1)) * 100), 0);
    return Math.round(sum / active.length);
  }, [allGoals]);

  const openCreate = () => { setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (g: Goal) => {
    setForm({
      id: g.id,
      title: g.title,
      description: g.description || '',
      category: g.category || 'family',
      target: g.target,
      current: g.current,
      unit: g.unit || '',
      member_id: g.member_id || '',
      due_date: g.due_date ? g.due_date.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const body: Partial<Goal> = {
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      target: Number(form.target) || 0,
      current: Number(form.current) || 0,
      unit: form.unit.trim(),
      member_id: form.member_id || null,
      due_date: form.due_date || null,
    };
    try {
      if (form.id) await api.updateGoal(form.id, body);
      else await api.createGoal(body);
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try { await api.deleteGoal(form.id); setModalOpen(false); await refresh(); } finally { setSaving(false); }
  };

  const step = (g: Goal) => {
    const raw = (g.target || 0) / 20;
    if (raw >= 1) return Math.max(1, Math.round(raw));
    return Math.round(raw * 100) / 100 || 1;
  };

  const nudge = async (g: Goal, dir: 1 | -1) => {
    setBusy(g.id);
    try { await api.goalProgress(g.id, { delta: dir * step(g) }); await refresh(); } finally { setBusy(null); }
  };

  const openProgress = (g: Goal) => { setProgressGoal(g); setProgressValue(String(g.current)); };
  const saveProgress = async () => {
    if (!progressGoal) return;
    setBusy(progressGoal.id);
    try {
      await api.goalProgress(progressGoal.id, { current: Number(progressValue) || 0 });
      setProgressGoal(null);
      await refresh();
    } finally { setBusy(null); }
  };

  if (loading && !goals) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Goals"
        subtitle="Track what the family is working toward"
        icon={Target}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> New goal</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Target} label="Active goals" value={activeCount} tone="blue" />
        <StatCard icon={Check} label="Completed" value={doneCount} tone="emerald" />
        <StatCard icon={Sparkles} label="Avg progress" value={`${avgProgress}%`} sub="across active goals" tone="purple" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Segmented<Filter>
          options={[
            { value: 'active', label: 'Active' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          message="Set a goal and start making progress together."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> New goal</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => {
            const mem = memberById(memberList, g.member_id);
            const pct = Math.min(100, Math.round((g.current / (g.target || 1)) * 100));
            const isDone = g.status === 'done';
            const overdue = !isDone && g.due_date != null && (daysUntil(g.due_date) ?? 0) < 0;
            return (
              <div
                key={g.id}
                className={`card card-hover p-4 flex flex-col gap-3 ${isDone ? 'ring-1 ring-emerald-200 bg-emerald-50/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="badge badge-purple capitalize">{g.category}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isDone && (
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center" title="Completed">
                        <Check size={14} />
                      </span>
                    )}
                    <button className="btn-ghost p-1.5" aria-label="Edit goal" onClick={() => openEdit(g)}><Pencil size={15} /></button>
                    <button
                      className="btn-ghost p-1.5 text-red-500"
                      aria-label="Delete goal"
                      onClick={async () => { setBusy(g.id); try { await api.deleteGoal(g.id); await refresh(); } finally { setBusy(null); } }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className={`font-semibold text-gray-900 ${isDone ? 'line-through text-gray-500' : ''}`}>{g.title}</h3>
                  {g.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{g.description}</p>}
                </div>

                <div className="space-y-1.5">
                  <ProgressBar value={g.current} max={g.target} color={isDone ? '#10b981' : undefined} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-medium">
                      {fmtValue(g.current, g.unit)} / {fmtValue(g.target, g.unit)}
                    </span>
                    <span className="text-gray-400 font-semibold">{pct}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <div className="flex items-center gap-3 text-xs">
                    {g.due_date && (
                      <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-500'}>{dueLabel(g.due_date)}</span>
                    )}
                    {mem && <Avatar user={mem} size={24} />}
                  </div>
                  {!isDone && (
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-ghost p-1.5"
                        aria-label="Decrease progress"
                        disabled={busy === g.id}
                        onClick={() => nudge(g, -1)}
                      >
                        <Minus size={15} />
                      </button>
                      <button
                        className="btn-ghost p-1.5"
                        aria-label="Increase progress"
                        disabled={busy === g.id}
                        onClick={() => nudge(g, 1)}
                      >
                        <Plus size={15} />
                      </button>
                      <button className="btn-secondary text-xs px-2 py-1" onClick={() => openProgress(g)}>Update</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modalOpen}
        title={form.id ? 'Edit goal' : 'New goal'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            {form.id && <button className="btn-danger mr-auto" onClick={remove} disabled={saving}><Trash2 size={16} /> Delete</button>}
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Title">
          <Input value={form.title} placeholder="Save for vacation" onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} rows={3} placeholder="Details…" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Target">
            <Input type="number" value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Current">
            <Input type="number" value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Unit" hint="%, $, books…">
            <Input value={form.unit} placeholder="%" onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </Field>
        </div>
        <Field label="Assignee" hint="Optional">
          <Select value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
            <option value="">Whole family</option>
            {memberList.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </Select>
        </Field>
        <Field label="Due date" hint="Optional">
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </Field>
      </Modal>

      {/* Progress modal */}
      <Modal
        open={!!progressGoal}
        title="Update progress"
        onClose={() => setProgressGoal(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setProgressGoal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveProgress} disabled={busy === progressGoal?.id}>Save</button>
          </>
        }
      >
        {progressGoal && (
          <Field label={`Current value (target ${fmtValue(progressGoal.target, progressGoal.unit)})`}>
            <Input
              type="number"
              autoFocus
              value={progressValue}
              onChange={(e) => setProgressValue(e.target.value)}
            />
          </Field>
        )}
      </Modal>
    </div>
  );
}
