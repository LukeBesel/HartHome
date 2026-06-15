import { useEffect, useMemo, useState } from 'react';
import { Gift, Plus, Trash2, Pencil, Check, X, Coins } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, Spinner, Modal, Field, Input, Textarea, Avatar, EmptyState, Icon, StatusBadge,
} from '../components/shared/ui';
import { relativeTime, memberById } from '../utils/format';
import type { Reward, Redemption, User } from '../types';

interface RewardForm {
  id?: string;
  title: string;
  description: string;
  cost: number;
  icon: string;
  stock: number;
  active: boolean;
}

const emptyForm = (): RewardForm => ({
  title: '', description: '', cost: 50, icon: 'Gift', stock: -1, active: true,
});

export default function Rewards() {
  const { user, isParent } = useAuth();
  const { data: rewards, loading, refresh: refreshRewards } = useAsync(() => api.rewards(), []);
  const { data: members, refresh: refreshMembers } = useAsync(() => api.members(), []);
  const { data: redemptions, refresh: refreshRedemptions } = useAsync(() => api.redemptions(), []);

  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RewardForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const memberList: User[] = members || [];
  const rewardList: Reward[] = rewards || [];
  const redemptionList: Redemption[] = redemptions || [];

  // Default the "who's redeeming" selector to the current user once members load.
  useEffect(() => {
    if (!selectedMemberId && user) setSelectedMemberId(user.id);
  }, [user, selectedMemberId]);

  const selectedMember = useMemo(
    () => memberById(memberList, selectedMemberId) || (user as User | null) || null,
    [memberList, selectedMemberId, user],
  );
  const balance = selectedMember?.points ?? 0;

  const refreshAll = async () => {
    await Promise.all([refreshRewards(), refreshRedemptions(), refreshMembers()]);
  };

  const redeem = async (r: Reward) => {
    setBusy(r.id);
    try { await api.redeemReward(r.id, selectedMemberId || undefined); await refreshAll(); } finally { setBusy(null); }
  };

  const setRedemptionStatus = async (id: string, status: Redemption['status']) => {
    setBusy(id);
    try { await api.updateRedemption(id, status); await refreshAll(); } finally { setBusy(null); }
  };

  const openCreate = () => { setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (r: Reward) => {
    setForm({
      id: r.id,
      title: r.title,
      description: r.description || '',
      cost: r.cost,
      icon: r.icon || 'Gift',
      stock: r.stock,
      active: r.active === 1,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const body: Partial<Reward> = {
      title: form.title.trim(),
      description: form.description,
      cost: Number(form.cost) || 0,
      icon: form.icon.trim() || 'Gift',
      stock: Number.isNaN(Number(form.stock)) ? -1 : Number(form.stock),
      active: form.active ? 1 : 0,
    };
    try {
      if (form.id) await api.updateReward(form.id, body);
      else await api.createReward(body);
      setModalOpen(false);
      await refreshRewards();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try { await api.deleteReward(form.id); setModalOpen(false); await refreshRewards(); } finally { setSaving(false); }
  };

  if (loading && !rewards) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Rewards"
        subtitle="Spend points on something fun"
        icon={Gift}
        actions={isParent ? <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New reward</button> : undefined}
      />

      {/* Who's redeeming + balance */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Redeeming as</span>
          <div className="flex items-center gap-2 flex-wrap">
            {memberList.map((m) => {
              const active = m.id === selectedMemberId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`rounded-full transition-all ${active ? 'ring-2 ring-offset-2 ring-indigo-400' : 'opacity-70 hover:opacity-100'}`}
                  title={m.display_name}
                  aria-label={`Redeem as ${m.display_name}`}
                >
                  <Avatar user={m} size={36} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-right">
          <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Coins size={18} /></span>
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-none">{balance}</div>
            <div className="text-xs text-gray-500 mt-0.5">{selectedMember?.display_name || 'points'} balance</div>
          </div>
        </div>
      </div>

      {/* Reward store */}
      {rewardList.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No rewards yet"
          message={isParent ? 'Add a reward for the family to work toward.' : 'Check back soon for rewards to redeem.'}
          action={isParent ? <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New reward</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewardList.map((r) => {
            const outOfStock = r.stock === 0;
            const disabled = busy === r.id || balance < r.cost || outOfStock || r.active === 0;
            return (
              <div key={r.id} className={`card card-hover p-4 flex flex-col gap-3 ${r.active === 0 ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}>
                    <Icon name={r.icon || 'Gift'} size={22} />
                  </div>
                  {isParent && (
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1.5" aria-label="Edit reward" onClick={() => openEdit(r)}><Pencil size={15} /></button>
                      <button
                        className="btn-ghost p-1.5 text-red-500"
                        aria-label="Delete reward"
                        onClick={async () => { setBusy(r.id); try { await api.deleteReward(r.id); await refreshRewards(); } finally { setBusy(null); } }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  {r.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
                </div>

                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <div className="text-sm">
                    <span className="font-bold text-amber-600">{r.cost} pts</span>
                    {r.stock >= 0 && (
                      <span className={`ml-2 text-xs ${outOfStock ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {outOfStock ? 'Out of stock' : `${r.stock} left`}
                      </span>
                    )}
                  </div>
                  <button className="btn-primary text-sm px-3 py-1.5" disabled={disabled} onClick={() => redeem(r)}>
                    {busy === r.id ? '…' : 'Redeem'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Redemption requests */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Redemption requests</h2>
        {redemptionList.length === 0 ? (
          <EmptyState icon={Gift} title="No redemptions yet" message="Redeemed rewards will show up here." />
        ) : (
          <div className="space-y-2">
            {redemptionList.map((rd) => {
              const mem = memberById(memberList, rd.member_id);
              return (
                <div key={rd.id} className="card p-3 flex items-center gap-3">
                  {mem && <Avatar user={mem} size={32} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{rd.reward_title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                      <span>{mem?.display_name || 'Member'}</span>
                      <span>·</span>
                      <span className="text-amber-600 font-medium">{rd.cost} pts</span>
                      <span>·</span>
                      <span>{relativeTime(rd.created_at)}</span>
                    </div>
                  </div>
                  <StatusBadge status={rd.status} />
                  {isParent && rd.status === 'pending' && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button className="btn-success text-xs px-2 py-1" disabled={busy === rd.id} onClick={() => setRedemptionStatus(rd.id, 'approved')}>
                        <Check size={14} /> Approve
                      </button>
                      <button className="btn-secondary text-xs px-2 py-1" disabled={busy === rd.id} onClick={() => setRedemptionStatus(rd.id, 'fulfilled')}>
                        Fulfill
                      </button>
                      <button className="btn-danger text-xs px-2 py-1" disabled={busy === rd.id} onClick={() => setRedemptionStatus(rd.id, 'denied')}>
                        <X size={14} /> Deny
                      </button>
                    </div>
                  )}
                  {isParent && rd.status === 'approved' && (
                    <button className="btn-secondary text-xs px-2 py-1 flex-shrink-0" disabled={busy === rd.id} onClick={() => setRedemptionStatus(rd.id, 'fulfilled')}>
                      Mark fulfilled
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / edit reward modal */}
      <Modal
        open={modalOpen}
        title={form.id ? 'Edit reward' : 'New reward'}
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
          <Input value={form.title} placeholder="Movie night pick" onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} rows={3} placeholder="Details…" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost (points)">
            <Input type="number" min={0} value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Stock" hint="-1 = unlimited">
            <Input type="number" value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value === '' ? -1 : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Icon" hint="Lucide icon name e.g. Gift">
          <Input value={form.icon} placeholder="Gift" onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Active (available to redeem)
        </label>
      </Modal>
    </div>
  );
}
