import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Star, Crown, Cake, Mail, Lock, Unlock } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Select, EmptyState, Avatar,
} from '../components/shared/ui';
import { fmtDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import type { User, Role } from '../types';

const ROLES: Role[] = ['parent', 'member', 'child'];
const SWATCHES = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e', '#3b82f6'];

const ROLE_BADGE: Record<string, string> = {
  owner: 'badge-purple', parent: 'badge-blue', member: 'badge-gray', child: 'badge-green',
};

interface MemberForm {
  id?: string;
  role?: Role; // tracked for owner-role guard when editing
  display_name: string;
  email: string;
  password: string;
  newRole: Role;
  avatar_color: string;
  birthday: string;
}

const emptyMember = (): MemberForm => ({
  display_name: '', email: '', password: '', newRole: 'member', avatar_color: SWATCHES[0], birthday: '',
});

export default function Members() {
  const { data: members, loading, refresh } = useAsync(() => api.members(), []);
  const { data: profiles, refresh: refreshProfiles } = useAsync(() => api.profiles(), []);
  const { isParent } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<MemberForm>(emptyMember());
  const [saving, setSaving] = useState(false);

  // PIN management — protects a profile on the shared-screen switcher.
  const [pinFor, setPinFor] = useState<User | null>(null);
  const [pinValue, setPinValue] = useState('');
  const hasPin = (id: string) => !!profiles?.find((p) => p.id === id)?.has_pin;
  const savePin = async (clear = false) => {
    if (!pinFor) return;
    await api.setPin(pinFor.id, clear ? null : pinValue);
    setPinFor(null); setPinValue('');
    refreshProfiles();
  };

  const memberList: User[] = members || [];
  const totalPoints = memberList.reduce((s, m) => s + (m.points || 0), 0);
  const childCount = memberList.filter((m) => m.role === 'child').length;

  const editingOwner = form.id != null && form.role === 'owner';

  const openCreate = () => { setForm(emptyMember()); setModalOpen(true); };
  const openEdit = (m: User) => {
    setForm({
      id: m.id, role: m.role, display_name: m.display_name, email: m.email || '',
      password: '', newRole: m.role === 'owner' ? 'parent' : m.role,
      avatar_color: m.avatar_color || SWATCHES[0], birthday: m.birthday || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.display_name.trim()) return;
    setSaving(true);
    const body: Partial<User> & { password?: string } = {
      display_name: form.display_name.trim(),
      email: form.email.trim() || null,
      avatar_color: form.avatar_color,
      birthday: form.birthday || null,
    };
    // Never change an owner's role.
    if (!editingOwner) body.role = form.newRole;
    if (form.password.trim()) body.password = form.password.trim();
    try {
      if (form.id) await api.updateMember(form.id, body);
      else await api.createMember(body);
      setModalOpen(false);
      await refresh();
    } finally { setSaving(false); }
  };

  const remove = async (m: User) => {
    if (!window.confirm(`Remove ${m.display_name} from the household?`)) return;
    await api.deleteMember(m.id);
    await refresh();
  };

  if (loading && !members) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Family"
        subtitle="Everyone in your household"
        icon={Users}
        actions={isParent ? <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add member</button> : undefined}
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Members" value={memberList.length} tone="indigo" />
        <StatCard icon={Star} label="Total points" value={totalPoints.toLocaleString()} tone="amber" />
        <StatCard icon={Cake} label="Children" value={childCount} tone="teal" />
      </div>

      {memberList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          message={isParent ? 'Add your family members and kids to get started.' : 'No household members to show.'}
          action={isParent ? <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add member</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberList.map((m) => {
            const owner = m.role === 'owner';
            return (
              <div key={m.id} className="card p-5 flex flex-col items-center text-center gap-2 relative">
                {isParent && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button className={`btn-ghost p-1.5 ${hasPin(m.id) ? 'text-indigo-500' : ''}`} aria-label="Set PIN" title={hasPin(m.id) ? 'PIN set — manage' : 'Set a profile PIN'} onClick={() => { setPinFor(m); setPinValue(''); }}>
                      {hasPin(m.id) ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    <button className="btn-ghost p-1.5" aria-label="Edit member" onClick={() => openEdit(m)}><Pencil size={14} /></button>
                    {!owner && (
                      <button className="btn-ghost p-1.5 text-red-500" aria-label="Remove member" onClick={() => remove(m)}><Trash2 size={14} /></button>
                    )}
                  </div>
                )}

                <Avatar user={m} size={56} ring />
                <h3 className="font-bold text-gray-900 truncate max-w-full mt-1">{m.display_name}</h3>

                <span className={`badge capitalize flex items-center gap-1 ${ROLE_BADGE[m.role] || 'badge-gray'}`}>
                  {owner && <Crown size={12} />} {m.role}
                </span>

                <div className="flex items-center gap-1 text-sm text-amber-600 font-semibold">
                  <Star size={14} className="fill-amber-400 text-amber-400" /> {(m.points || 0).toLocaleString()} pts
                </div>

                <p className="flex items-center gap-1.5 text-xs text-gray-500 truncate max-w-full">
                  <Mail size={12} className="flex-shrink-0" /> {m.email || 'Profile account'}
                </p>
                {m.birthday && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Cake size={12} /> {fmtDate(m.birthday)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit member' : 'Add member'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.display_name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <Field label="Display name">
          <Input value={form.display_name} placeholder="Jordan" onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </Field>
        <Field label="Email" hint="Leave blank for a kids' profile — they sign in by tapping their avatar">
          <Input type="email" value={form.email} placeholder="name@example.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" hint="Only needed if they'll log in with email">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select
            value={editingOwner ? 'owner' : form.newRole}
            disabled={editingOwner}
            onChange={(e) => setForm({ ...form, newRole: e.target.value as Role })}
          >
            {editingOwner && <option value="owner">Owner</option>}
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </Select>
        </Field>
        <Field label="Avatar color">
          <div className="flex flex-wrap gap-2 mt-1">
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => setForm({ ...form, avatar_color: color })}
                className={`w-8 h-8 rounded-full transition-transform ${form.avatar_color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </Field>
        <Field label="Birthday">
          <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
        </Field>
      </Modal>

      {/* Profile PIN */}
      <Modal
        open={!!pinFor}
        title={`${pinFor?.display_name ?? ''} — profile PIN`}
        onClose={() => { setPinFor(null); setPinValue(''); }}
        footer={
          <>
            {pinFor && hasPin(pinFor.id) && <button className="btn-ghost text-red-600 mr-auto" onClick={() => savePin(true)}>Remove PIN</button>}
            <button className="btn-secondary" onClick={() => { setPinFor(null); setPinValue(''); }}>Cancel</button>
            <button className="btn-primary" onClick={() => savePin(false)} disabled={pinValue.replace(/\D/g, '').length < 4}>Save PIN</button>
          </>
        }
      >
        <p className="text-sm text-gray-500">A PIN protects this profile on the shared-screen switcher, so only {pinFor?.display_name?.split(' ')[0]} can open it. 4–8 digits.</p>
        <Field label="New PIN">
          <Input inputMode="numeric" value={pinValue} placeholder="••••" maxLength={8}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </Field>
      </Modal>
    </div>
  );
}
