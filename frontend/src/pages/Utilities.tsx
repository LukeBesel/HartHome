import { useState } from 'react';
import {
  Zap, Droplet, Flame, Wifi, Trash2, Phone, Tv, Plug, Plus, Pencil,
} from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Select, EmptyState,
} from '../components/shared/ui';
import { money, fmtDate, todayISO } from '../utils/format';
import type { Utility, UtilityReading } from '../types';

const UTILITY_TYPES = ['electric', 'water', 'gas', 'internet', 'trash', 'phone', 'streaming', 'other'];

const TYPE_ICONS: Record<string, React.ElementType> = {
  electric: Zap,
  water: Droplet,
  gas: Flame,
  internet: Wifi,
  trash: Trash2,
  phone: Phone,
  streaming: Tv,
  other: Plug,
};

const typeIcon = (type: string): React.ElementType => TYPE_ICONS[type] || Plug;

interface UtilityForm {
  id?: string;
  name: string;
  provider: string;
  type: string;
  account_number: string;
  monthly_estimate: number;
  unit: string;
  contact: string;
}

interface ReadingForm {
  reading: number;
  cost: number;
  period: string;
}

const emptyUtility = (): UtilityForm => ({
  name: '', provider: '', type: 'electric', account_number: '',
  monthly_estimate: 0, unit: '', contact: '',
});

const emptyReading = (): ReadingForm => ({ reading: 0, cost: 0, period: todayISO().slice(0, 7) });

export default function Utilities() {
  const { data: utilities, loading, refresh } = useAsync(() => api.utilities(), []);
  const [selected, setSelected] = useState<Utility | null>(null);
  const {
    data: readings,
    refresh: refreshReadings,
  } = useAsync<UtilityReading[]>(
    () => (selected ? api.readings(selected.id) : Promise.resolve([])),
    [selected?.id],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<UtilityForm>(emptyUtility());
  const [readingModal, setReadingModal] = useState(false);
  const [readingForm, setReadingForm] = useState<ReadingForm>(emptyReading());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const utilityList: Utility[] = utilities || [];
  const readingList: UtilityReading[] = readings || [];
  const totalEstimate = utilityList.reduce((s, u) => s + (u.monthly_estimate || 0), 0);

  const openCreate = () => { setForm(emptyUtility()); setModalOpen(true); };
  const openEdit = (u: Utility) => {
    setForm({
      id: u.id,
      name: u.name,
      provider: u.provider || '',
      type: u.type || 'other',
      account_number: u.account_number || '',
      monthly_estimate: u.monthly_estimate || 0,
      unit: u.unit || '',
      contact: u.contact || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const body: Partial<Utility> = {
      name: form.name.trim(),
      provider: form.provider.trim(),
      type: form.type,
      account_number: form.account_number.trim(),
      monthly_estimate: Number(form.monthly_estimate) || 0,
      unit: form.unit.trim(),
      contact: form.contact.trim(),
    };
    try {
      if (form.id) await api.updateUtility(form.id, body);
      else await api.createUtility(body);
      setModalOpen(false);
      await refresh();
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      await api.deleteUtility(form.id);
      if (selected?.id === form.id) setSelected(null);
      setModalOpen(false);
      await refresh();
    } finally { setSaving(false); }
  };

  const toggleSelect = (u: Utility) => setSelected((cur) => (cur?.id === u.id ? null : u));

  const saveReading = async () => {
    if (!selected) return;
    setSaving(true);
    const body: Partial<UtilityReading> = {
      utility_id: selected.id,
      reading: Number(readingForm.reading) || 0,
      cost: Number(readingForm.cost) || 0,
      period: readingForm.period.trim(),
    };
    try {
      await api.createReading(body);
      setReadingModal(false);
      await refreshReadings();
    } finally { setSaving(false); }
  };

  const removeReading = async (id: string) => {
    setBusy(id);
    try { await api.deleteReading(id); await refreshReadings(); } finally { setBusy(null); }
  };

  if (loading && !utilities) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Utilities"
        subtitle="Track providers, estimates, and meter readings"
        icon={Zap}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add utility</button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Zap} label="Monthly estimate" value={money(totalEstimate)} sub="across all utilities" tone="amber" />
        <StatCard icon={Plug} label="Utilities" value={utilityList.length} tone="blue" />
        <StatCard icon={Tv} label="Providers" value={new Set(utilityList.map((u) => u.provider).filter(Boolean)).size} tone="purple" />
      </div>

      {utilityList.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No utilities yet"
          message="Add your electric, water, internet, and other providers to track costs."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add utility</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {utilityList.map((u) => {
            const TypeIcon = typeIcon(u.type);
            const active = selected?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleSelect(u)}
                className={`card card-hover p-4 text-left flex flex-col gap-2 ${active ? 'ring-2' : ''}`}
                style={active ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0">
                      <TypeIcon size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{u.name}</h3>
                      {u.provider && <p className="text-xs text-gray-500 truncate">{u.provider}</p>}
                    </div>
                  </div>
                  <span
                    role="button"
                    aria-label="Edit utility"
                    className="btn-ghost p-1.5 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); openEdit(u); }}
                  >
                    <Pencil size={15} />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="badge badge-gray capitalize">{u.type}</span>
                  <span className="font-bold text-gray-900">{money(u.monthly_estimate)}<span className="text-xs font-normal text-gray-400">/mo</span></span>
                </div>
                {(u.account_number || u.unit) && (
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    {u.account_number && <span className="truncate">#{u.account_number}</span>}
                    {u.unit && <span>{u.unit}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <section className="card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 truncate">{selected.name} readings</h2>
              {selected.contact && <p className="text-xs text-gray-500 truncate">{selected.contact}</p>}
            </div>
            <button className="btn-secondary text-sm" onClick={() => { setReadingForm(emptyReading()); setReadingModal(true); }}>
              <Plus size={15} /> Add reading
            </button>
          </div>
          {readingList.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No readings logged yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {readingList.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{r.period || fmtDate(r.recorded_at)}</div>
                    <div className="text-xs text-gray-500">{r.reading}{selected.unit ? ` ${selected.unit}` : ''}</div>
                  </div>
                  <span className="font-bold text-gray-900">{money(r.cost)}</span>
                  <button
                    className="btn-ghost p-1.5 text-red-500 flex-shrink-0"
                    aria-label="Delete reading"
                    disabled={busy === r.id}
                    onClick={() => removeReading(r.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Utility modal */}
      <Modal
        open={modalOpen}
        title={form.id ? 'Edit utility' : 'Add utility'}
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
          <Input value={form.name} placeholder="Electricity" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <Input value={form.provider} placeholder="City Power" onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {UTILITY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Account number">
          <Input value={form.account_number} placeholder="0001234567" onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly estimate">
            <Input type="number" value={form.monthly_estimate}
              onChange={(e) => setForm({ ...form, monthly_estimate: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Unit" hint="e.g. kWh, gal">
            <Input value={form.unit} placeholder="kWh" onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </Field>
        </div>
        <Field label="Contact" hint="Support phone or email">
          <Input value={form.contact} placeholder="1-800-555-0100" onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        </Field>
      </Modal>

      {/* Reading modal */}
      <Modal
        open={readingModal}
        title="Add reading"
        onClose={() => setReadingModal(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReadingModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveReading} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reading" hint={selected?.unit ? `in ${selected.unit}` : undefined}>
            <Input type="number" value={readingForm.reading}
              onChange={(e) => setReadingForm({ ...readingForm, reading: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Cost">
            <Input type="number" value={readingForm.cost}
              onChange={(e) => setReadingForm({ ...readingForm, cost: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Period" hint="e.g. 2026-06">
          <Input value={readingForm.period} placeholder="2026-06" onChange={(e) => setReadingForm({ ...readingForm, period: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
}
