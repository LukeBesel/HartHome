import { useMemo, useState } from 'react';
import { CheckSquare, Check, Plus, Trash2, Pencil, RotateCcw, Repeat, Award, Clock } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Textarea, Select, EmptyState, Avatar, Segmented, Icon,
} from '../components/shared/ui';
import { dueLabel, daysUntil, memberById } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import type { Chore } from '../types';

const RECURRENCES = ['once', 'daily', 'weekly', 'monthly'];

interface ChoreForm {
  id?: string;
  title: string;
  description: string;
  assignee_id: string;
  points: number;
  recurrence: string;
  due_date: string;
  icon: string;
}

const blankForm = (): ChoreForm => ({
  title: '', description: '', assignee_id: '', points: 5, recurrence: 'once', due_date: '', icon: 'CheckSquare',
});

export default function Chores() {
  const { data: chores, loading, refresh } = useAsync(() => api.chores(), []);
  const { data: members } = useAsync(() => api.members(), []);
  const { isParent } = useAuth();

  const [filter, setFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ChoreForm>(blankForm());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const memberList = members || [];
  const allChores = chores || [];

  const filtered = useMemo(
    () => (filter === 'all' ? allChores : allChores.filter((c) => c.assignee_id === filter)),
    [allChores, filter],
  );

  const open = filtered.filter((c) => c.status === 'todo');
  const done = filtered.filter((c) => c.status === 'done');

  const stats = useMemo(() => ({
    open: allChores.filter((c) => c.status === 'todo').length,
    done: allChores.filter((c) => c.status === 'done').length,
    points: allChores.filter((c) => c.status === 'todo').reduce((s, c) => s + (c.points || 0), 0),
  }), [allChores]);

  const filterOptions = [
    { value: 'all', label: 'All' },
    ...memberList.map((m) => ({ value: m.id, label: m.display_name })),
  ];

  const openCreate = () => { setForm(blankForm()); setModalOpen(true); };
  const openEdit = (c: Chore) => {
    setForm({
      id: c.id,
      title: c.title,
      description: c.description || '',
      assignee_id: c.assignee_id || '',
      points: c.points,
      recurrence: c.recurrence || 'once',
      due_date: c.due_date || '',
      icon: c.icon || 'CheckSquare',
    });
    setModalOpen(true);
  };

  const complete = async (id: string) => {
    setBusyId(id);
    try { await api.completeChore(id); await refresh(); } finally { setBusyId(null); }
  };
  const reopen = async (id: string) => {
    setBusyId(id);
    try { await api.reopenChore(id); await refresh(); } finally { setBusyId(null); }
  };
  const remove = async (id: string) => {
    setBusyId(id);
    try { await api.deleteChore(id); await refresh(); } finally { setBusyId(null); }
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body: Partial<Chore> = {
        title: form.title.trim(),
        description: form.description,
        assignee_id: form.assignee_id || null,
        points: Number(form.points) || 0,
        recurrence: form.recurrence,
        due_date: form.due_date || null,
        icon: form.icon || 'CheckSquare',
      };
      if (form.id) await api.updateChore(form.id, body);
      else await api.createChore(body);
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Chores"
        subtitle="Keep the household running"
        icon={CheckSquare}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> New chore</button>}
      />

      {loading && !chores ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Clock} label="Open chores" value={stats.open} tone="amber" />
            <StatCard icon={Check} label="Completed" value={stats.done} tone="emerald" />
            <StatCard icon={Award} label="Points up for grabs" value={stats.points} tone="indigo" />
          </div>

          {memberList.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <Segmented options={filterOptions} value={filter} onChange={setFilter} />
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">Open · {open.length}</h2>
            {open.length === 0 ? (
              <EmptyState icon={CheckSquare} title="All clear" message="No open chores here. Nice work!" />
            ) : (
              <div className="space-y-2">
                {open.map((c) => {
                  const m = memberById(memberList, c.assignee_id);
                  const overdue = c.due_date != null && (daysUntil(c.due_date) ?? 0) < 0;
                  return (
                    <div key={c.id} className="card flex items-center gap-3 p-3">
                      <button
                        onClick={() => complete(c.id)}
                        disabled={busyId === c.id}
                        className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-transparent hover:border-emerald-400 hover:text-emerald-500 transition-colors flex-shrink-0"
                        aria-label="Complete chore"
                      >
                        <Check size={18} />
                      </button>
                      <span className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 flex-shrink-0">
                        <Icon name={c.icon || 'CheckSquare'} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 truncate">{c.title}</div>
                        <div className="text-xs flex items-center gap-2 flex-wrap mt-0.5">
                          {c.due_date && <span className={overdue ? 'text-red-500 font-medium' : 'text-gray-500'}>{dueLabel(c.due_date)}</span>}
                          {c.recurrence && c.recurrence !== 'once' && (
                            <span className="badge badge-blue inline-flex items-center gap-1"><Repeat size={11} />{c.recurrence}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 flex-shrink-0">+{c.points}</span>
                      {m && <Avatar user={m} size={30} />}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button className="btn-ghost p-1.5" onClick={() => openEdit(c)} aria-label="Edit"><Pencil size={15} /></button>
                        <button className="btn-ghost p-1.5 text-red-500" onClick={() => remove(c.id)} disabled={busyId === c.id} aria-label="Delete"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {done.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">Done · {done.length}</h2>
              <div className="space-y-2">
                {done.map((c) => {
                  const m = memberById(memberList, c.assignee_id);
                  return (
                    <div key={c.id} className="card flex items-center gap-3 p-3 opacity-70">
                      <span className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
                        <Check size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-500 line-through truncate">{c.title}</div>
                      </div>
                      <span className="text-sm font-bold text-gray-400 flex-shrink-0">+{c.points}</span>
                      {m && <Avatar user={m} size={30} />}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button className="btn-ghost p-1.5 inline-flex items-center gap-1 text-xs" onClick={() => reopen(c.id)} disabled={busyId === c.id}><RotateCcw size={14} /> Reopen</button>
                        {isParent && <button className="btn-ghost p-1.5 text-red-500" onClick={() => remove(c.id)} disabled={busyId === c.id} aria-label="Delete"><Trash2 size={15} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit chore' : 'New chore'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Take out the trash" />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Any details" />
        </Field>
        <Field label="Assignee" hint="Optional">
          <Select value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
            <option value="">Anyone</option>
            {memberList.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Points">
            <Input type="number" min={0} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          </Field>
          <Field label="Recurrence">
            <Select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
              {RECURRENCES.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Due date" hint="Optional">
          <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </Field>
        <Field label="Icon" hint="Lucide icon name e.g. Trash2">
          <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="CheckSquare" />
        </Field>
      </Modal>
    </div>
  );
}
