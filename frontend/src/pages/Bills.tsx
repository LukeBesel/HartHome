import { useMemo, useState } from 'react';
import { Receipt, Plus, Trash2, Pencil, Check, Zap } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Textarea, Select, Segmented, Avatar, EmptyState,
} from '../components/shared/ui';
import { money, dueLabel, daysUntil, memberById, todayISO } from '../utils/format';
import type { Bill, User } from '../types';

const CATEGORIES = ['housing', 'utilities', 'auto', 'insurance', 'subscriptions', 'debt', 'childcare', 'other'];
const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', 'once'];
const STATUSES: Bill['status'][] = ['upcoming', 'overdue', 'paid'];

type Filter = 'all' | 'upcoming' | 'overdue' | 'paid';

interface BillForm {
  id?: string;
  name: string;
  amount: number;
  category: string;
  frequency: string;
  next_due: string;
  autopay: boolean;
  account: string;
  member_id: string;
  status: Bill['status'];
  notes: string;
}

const emptyForm = (): BillForm => ({
  name: '', amount: 0, category: 'utilities', frequency: 'monthly', next_due: todayISO(),
  autopay: false, account: '', member_id: '', status: 'upcoming', notes: '',
});

export default function Bills() {
  const { data: bills, loading, refresh } = useAsync(() => api.bills(), []);
  const { data: members } = useAsync(() => api.members(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<BillForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const memberList: User[] = members || [];
  const allBills: Bill[] = bills || [];

  const filtered = useMemo(
    () => (filter === 'all' ? allBills : allBills.filter((b) => b.status === filter)),
    [allBills, filter],
  );

  const upcomingTotal = allBills.filter((b) => b.status !== 'paid').reduce((s, b) => s + (b.amount || 0), 0);
  const overdueCount = allBills.filter((b) => b.status === 'overdue').length;
  const monthlyTotal = allBills.filter((b) => b.frequency === 'monthly').reduce((s, b) => s + (b.amount || 0), 0);
  const autopayCount = allBills.filter((b) => b.autopay).length;

  const openCreate = () => { setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (b: Bill) => {
    setForm({
      id: b.id,
      name: b.name,
      amount: b.amount,
      category: b.category || 'other',
      frequency: b.frequency || 'monthly',
      next_due: b.next_due ? b.next_due.slice(0, 10) : '',
      autopay: !!b.autopay,
      account: b.account || '',
      member_id: b.member_id || '',
      status: b.status,
      notes: b.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const body: Partial<Bill> = {
      name: form.name.trim(),
      amount: Number(form.amount) || 0,
      category: form.category,
      frequency: form.frequency,
      next_due: form.next_due || null,
      autopay: form.autopay ? 1 : 0,
      account: form.account.trim(),
      member_id: form.member_id || null,
      status: form.status,
      notes: form.notes,
    };
    try {
      if (form.id) await api.updateBill(form.id, body);
      else await api.createBill(body);
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try { await api.deleteBill(form.id); setModalOpen(false); await refresh(); } finally { setSaving(false); }
  };

  const pay = async (b: Bill) => {
    setBusy(b.id);
    try { await api.payBill(b.id); await refresh(); } finally { setBusy(null); }
  };

  if (loading && !bills) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Bills"
        subtitle="Keep on top of what's due"
        icon={Receipt}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add bill</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Receipt} label="Upcoming total" value={money(upcomingTotal)} sub="unpaid bills" tone="blue" />
        <StatCard icon={Receipt} label="Overdue" value={overdueCount} tone="red" />
        <StatCard icon={Receipt} label="Monthly total" value={money(monthlyTotal)} tone="indigo" />
        <StatCard icon={Zap} label="Autopay" value={autopayCount} sub="bills on autopay" tone="emerald" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Segmented<Filter>
          options={[
            { value: 'all', label: 'All' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'paid', label: 'Paid' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills here"
          message="Add a bill to start tracking due dates and autopay."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add bill</button>}
        />
      ) : (
        <div className="card divide-y divide-gray-100">
          {filtered.map((b) => {
            const mem = memberById(memberList, b.member_id);
            const overdue = b.status === 'overdue' || (b.status !== 'paid' && (daysUntil(b.next_due) ?? 0) < 0);
            const isPaid = b.status === 'paid';
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold text-gray-900 truncate ${isPaid ? 'line-through text-gray-500' : ''}`}>{b.name}</h3>
                    <span className="badge badge-gray capitalize">{b.category}</span>
                    {b.autopay ? <span className="badge badge-blue">Autopay</span> : null}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                    <span className={overdue ? 'text-red-600 font-medium' : 'text-gray-500'}>{dueLabel(b.next_due)}</span>
                    <span className="badge badge-gray capitalize">{b.frequency}</span>
                    {b.account && <span className="text-gray-400">{b.account}</span>}
                  </div>
                </div>
                {mem && <Avatar user={mem} size={28} />}
                <div className="text-right">
                  <div className="font-bold text-gray-900">{money(b.amount)}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isPaid && (
                    <button className="btn-success text-xs px-2.5 py-1.5" disabled={busy === b.id} onClick={() => pay(b)}>
                      <Check size={14} /> Pay
                    </button>
                  )}
                  <button className="btn-ghost p-1.5" aria-label="Edit bill" onClick={() => openEdit(b)}><Pencil size={15} /></button>
                  <button
                    className="btn-ghost p-1.5 text-red-500"
                    aria-label="Delete bill"
                    disabled={busy === b.id}
                    onClick={async () => { setBusy(b.id); try { await api.deleteBill(b.id); await refresh(); } finally { setBusy(null); } }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit bill' : 'Add bill'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            {form.id && <button className="btn-danger mr-auto" onClick={remove} disabled={saving}><Trash2 size={16} /> Delete</button>}
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Name">
          <Input value={form.name} placeholder="Electric bill" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input type="number" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency">
            <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Next due">
            <Input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} />
          </Field>
        </div>
        <Field label="Account" hint="Which account pays this">
          <Input value={form.account} placeholder="Checking" onChange={(e) => setForm({ ...form, account: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee" hint="Optional">
            <Select value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              <option value="">Whole family</option>
              {memberList.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Bill['status'] })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.autopay} onChange={(e) => setForm({ ...form, autopay: e.target.checked })} />
          On autopay
        </label>
        <Field label="Notes">
          <Textarea value={form.notes} rows={2} placeholder="Optional notes…" onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
}
