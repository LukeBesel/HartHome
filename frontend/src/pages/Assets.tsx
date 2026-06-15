import { useMemo, useState } from 'react';
import {
  Car, Plus, Pencil, Trash2, Wrench, AlertTriangle, ShieldAlert, Check, Gauge, CalendarClock,
} from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Textarea, Select, EmptyState, Icon, Segmented,
} from '../components/shared/ui';
import { money, dueLabel, daysUntil, fmtDate } from '../utils/format';
import type { Asset, Maintenance } from '../types';

const ASSET_TYPES = ['vehicle', 'appliance', 'home', 'electronics', 'tool', 'other'];
const MAINT_TYPES = ['service', 'repair', 'inspection', 'registration', 'warranty', 'other'];

interface AssetForm {
  id?: string;
  name: string;
  type: string;
  make: string;
  model: string;
  year: string;
  identifier: string;
  purchase_date: string;
  purchase_price: number;
  current_value: number;
  mileage: string;
  warranty_expires: string;
  location: string;
  icon: string;
  notes: string;
}

interface MaintForm {
  id?: string;
  title: string;
  type: string;
  due_date: string;
  due_mileage: string;
  provider: string;
  cost: number;
  recurrence_months: number;
  recurrence_miles: number;
  notes: string;
}

const emptyAsset = (): AssetForm => ({
  name: '', type: 'vehicle', make: '', model: '', year: '', identifier: '',
  purchase_date: '', purchase_price: 0, current_value: 0, mileage: '',
  warranty_expires: '', location: '', icon: 'Car', notes: '',
});

const emptyMaint = (): MaintForm => ({
  title: '', type: 'service', due_date: '', due_mileage: '', provider: '',
  cost: 0, recurrence_months: 0, recurrence_miles: 0, notes: '',
});

// A maintenance item counts as effectively overdue if the server flagged it
// overdue OR its due date is in the past and it has not been completed.
const isOverdue = (m: Maintenance): boolean => {
  if (m.status === 'done') return false;
  if (m.status === 'overdue') return true;
  const d = daysUntil(m.due_date);
  return d !== null && d < 0;
};

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export default function Assets() {
  const { data: assets, loading: loadingAssets, refresh: refreshAssets } = useAsync(() => api.assets(), []);
  const { data: maintenance, refresh: refreshMaint } = useAsync(() => api.maintenance(), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'done'>('upcoming');

  const [assetModal, setAssetModal] = useState(false);
  const [assetForm, setAssetForm] = useState<AssetForm>(emptyAsset());
  const [maintModal, setMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState<MaintForm>(emptyMaint());

  const [completeFor, setCompleteFor] = useState<Maintenance | null>(null);
  const [completeCost, setCompleteCost] = useState<string>('');
  const [completeMileage, setCompleteMileage] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const assetList: Asset[] = assets || [];
  const maintList: Maintenance[] = maintenance || [];

  const selected = assetList.find((a) => a.id === selectedId) || null;

  // Per-asset open maintenance counts for badges on the asset cards.
  const counts = useMemo(() => {
    const map: Record<string, { open: number; overdue: number }> = {};
    for (const m of maintList) {
      if (!map[m.asset_id]) map[m.asset_id] = { open: 0, overdue: 0 };
      if (m.status !== 'done') {
        map[m.asset_id].open += 1;
        if (isOverdue(m)) map[m.asset_id].overdue += 1;
      }
    }
    return map;
  }, [maintList]);

  const totalValue = assetList.reduce((s, a) => s + (a.current_value || 0), 0);
  const upcomingCount = maintList.filter((m) => m.status !== 'done').length;
  const overdueCount = maintList.filter(isOverdue).length;
  const vehicleCount = assetList.filter((a) => a.type === 'vehicle').length;

  const selectedMaint = selected
    ? maintList
      .filter((m) => m.asset_id === selected.id)
      .filter((m) => (tab === 'done' ? m.status === 'done' : m.status !== 'done'))
      .sort((a, b) => {
        const da = a.due_date || '';
        const db = b.due_date || '';
        return tab === 'done' ? db.localeCompare(da) : da.localeCompare(db);
      })
    : [];

  // ── Asset CRUD ──
  const openCreateAsset = () => { setAssetForm(emptyAsset()); setAssetModal(true); };
  const openEditAsset = (a: Asset) => {
    setAssetForm({
      id: a.id, name: a.name, type: a.type || 'other', make: a.make || '', model: a.model || '',
      year: a.year != null ? String(a.year) : '', identifier: a.identifier || '',
      purchase_date: a.purchase_date || '', purchase_price: a.purchase_price || 0,
      current_value: a.current_value || 0, mileage: a.mileage != null ? String(a.mileage) : '',
      warranty_expires: a.warranty_expires || '', location: a.location || '',
      icon: a.icon || 'Car', notes: a.notes || '',
    });
    setAssetModal(true);
  };

  const saveAsset = async () => {
    if (!assetForm.name.trim()) return;
    setSaving(true);
    const body: Partial<Asset> = {
      name: assetForm.name.trim(),
      type: assetForm.type,
      make: assetForm.make.trim(),
      model: assetForm.model.trim(),
      year: numOrNull(assetForm.year),
      identifier: assetForm.identifier.trim(),
      purchase_date: assetForm.purchase_date || null,
      purchase_price: Number(assetForm.purchase_price) || 0,
      current_value: Number(assetForm.current_value) || 0,
      mileage: numOrNull(assetForm.mileage),
      warranty_expires: assetForm.warranty_expires || null,
      location: assetForm.location.trim(),
      icon: assetForm.icon.trim() || 'Car',
      notes: assetForm.notes.trim(),
    };
    try {
      if (assetForm.id) await api.updateAsset(assetForm.id, body);
      else await api.createAsset(body);
      setAssetModal(false);
      await refreshAssets();
    } finally { setSaving(false); }
  };

  const removeAsset = async () => {
    if (!assetForm.id) return;
    setSaving(true);
    try {
      await api.deleteAsset(assetForm.id);
      if (selectedId === assetForm.id) setSelectedId(null);
      setAssetModal(false);
      await Promise.all([refreshAssets(), refreshMaint()]);
    } finally { setSaving(false); }
  };

  // ── Maintenance CRUD ──
  const openCreateMaint = () => { setMaintForm(emptyMaint()); setMaintModal(true); };
  const openEditMaint = (m: Maintenance) => {
    setMaintForm({
      id: m.id, title: m.title, type: m.type || 'service', due_date: m.due_date || '',
      due_mileage: m.due_mileage != null ? String(m.due_mileage) : '', provider: m.provider || '',
      cost: m.cost || 0, recurrence_months: m.recurrence_months || 0,
      recurrence_miles: m.recurrence_miles || 0, notes: m.notes || '',
    });
    setMaintModal(true);
  };

  const saveMaint = async () => {
    if (!selected || !maintForm.title.trim()) return;
    setSaving(true);
    const body: Partial<Maintenance> = {
      asset_id: selected.id,
      title: maintForm.title.trim(),
      type: maintForm.type,
      due_date: maintForm.due_date || null,
      due_mileage: numOrNull(maintForm.due_mileage),
      provider: maintForm.provider.trim(),
      cost: Number(maintForm.cost) || 0,
      recurrence_months: Number(maintForm.recurrence_months) || 0,
      recurrence_miles: Number(maintForm.recurrence_miles) || 0,
      notes: maintForm.notes.trim(),
    };
    try {
      if (maintForm.id) await api.updateMaintenance(maintForm.id, body);
      else await api.createMaintenance(body);
      setMaintModal(false);
      await refreshMaint();
    } finally { setSaving(false); }
  };

  const removeMaint = async (id: string) => {
    setBusy(id);
    try { await api.deleteMaintenance(id); await refreshMaint(); } finally { setBusy(null); }
  };

  const openComplete = (m: Maintenance) => {
    setCompleteFor(m);
    setCompleteCost(m.cost ? String(m.cost) : '');
    setCompleteMileage('');
  };

  const confirmComplete = async () => {
    if (!completeFor) return;
    setSaving(true);
    const payload: { cost?: number; mileage?: number } = {};
    if (completeCost.trim() !== '') payload.cost = Number(completeCost);
    if (completeMileage.trim() !== '') payload.mileage = Number(completeMileage);
    try {
      await api.completeMaintenance(completeFor.id, payload);
      setCompleteFor(null);
      await Promise.all([refreshMaint(), refreshAssets()]);
    } finally { setSaving(false); }
  };

  if (loadingAssets && !assets) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Assets & maintenance"
        subtitle="Cars, appliances, warranties — and everything that needs upkeep"
        icon={Car}
        actions={<button className="btn-primary" onClick={openCreateAsset}><Plus size={16} /> Add asset</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Car} label="Total value" value={money(totalValue, { cents: false })} sub="current value" tone="indigo" />
        <StatCard icon={Wrench} label="Upcoming" value={upcomingCount} sub="maintenance items" tone="blue" />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdueCount} sub="need attention" tone="red" />
        <StatCard icon={Car} label="Vehicles" value={vehicleCount} tone="teal" />
      </div>

      {assetList.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No assets yet"
          message="Add your car, home, or appliances to track maintenance, oil changes, registration, and warranties."
          action={<button className="btn-primary" onClick={openCreateAsset}><Plus size={16} /> Add asset</button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Asset list */}
          <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {assetList.map((a) => {
              const c = counts[a.id] || { open: 0, overdue: 0 };
              const active = selectedId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(active ? null : a.id)}
                  className={`card card-hover p-4 text-left flex flex-col gap-3 ${active ? 'ring-2' : ''}`}
                  style={active ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                      style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}
                    >
                      <Icon name={a.icon || 'Car'} size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                        <span
                          role="button"
                          aria-label="Edit asset"
                          className="btn-ghost p-1.5 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); openEditAsset(a); }}
                        >
                          <Pencil size={14} />
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {[a.year || '', a.make, a.model].filter(Boolean).join(' ') || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-gray capitalize">{a.type}</span>
                    {c.overdue > 0 && <span className="badge badge-red">{c.overdue} overdue</span>}
                    {c.overdue === 0 && c.open > 0 && <span className="badge badge-amber">{c.open} due</span>}
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {a.type === 'vehicle' && a.mileage != null && (
                        <div className="flex items-center gap-1"><Gauge size={12} /> {a.mileage.toLocaleString()} mi</div>
                      )}
                      {a.warranty_expires && (
                        <div className="flex items-center gap-1">
                          <ShieldAlert size={12} /> Warranty {dueLabel(a.warranty_expires)}
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-gray-900">{money(a.current_value, { cents: false })}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Maintenance panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="card p-8 text-center text-gray-500 h-full flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
                  <Wrench size={26} />
                </div>
                <h3 className="font-semibold text-gray-800">Select an asset</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Choose an asset to view and log its maintenance — services, inspections, registration, and warranties.
                </p>
              </div>
            ) : (
              <section className="card p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-900 truncate flex items-center gap-2">
                      <Icon name={selected.icon || 'Car'} size={18} /> {selected.name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[selected.year || '', selected.make, selected.model].filter(Boolean).join(' ') || '—'}
                      {selected.identifier ? ` · ${selected.identifier}` : ''}
                    </p>
                  </div>
                  <button className="btn-secondary text-sm" onClick={openCreateMaint}>
                    <Plus size={15} /> Add maintenance
                  </button>
                </div>

                <Segmented<'upcoming' | 'done'>
                  value={tab}
                  onChange={setTab}
                  options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'done', label: 'History' }]}
                />

                {selectedMaint.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    {tab === 'done' ? 'No completed maintenance yet.' : 'No upcoming maintenance scheduled.'}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedMaint.map((m) => {
                      const overdue = isOverdue(m);
                      return (
                        <div key={m.id} className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-gray-900 truncate">{m.title}</h4>
                                <span className="badge badge-gray capitalize">{m.type}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                                {tab === 'done' ? (
                                  <span className="flex items-center gap-1">
                                    <Check size={12} /> {fmtDate(m.completed_at)}
                                  </span>
                                ) : (
                                  <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                                    <CalendarClock size={12} /> {dueLabel(m.due_date)}
                                  </span>
                                )}
                                {m.due_mileage != null && <span>@ {m.due_mileage.toLocaleString()} mi</span>}
                                {m.provider && <span>{m.provider}</span>}
                                {(m.cost > 0 && tab === 'done') && <span className="font-medium text-gray-700">{money(m.cost)}</span>}
                                {m.recurrence_months > 0 && <span>every {m.recurrence_months} mo</span>}
                                {m.recurrence_miles > 0 && <span>every {m.recurrence_miles.toLocaleString()} mi</span>}
                              </div>
                              {m.notes && <p className="text-xs text-gray-400 mt-1">{m.notes}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button className="btn-ghost p-1.5" aria-label="Edit" onClick={() => openEditMaint(m)}>
                                <Pencil size={14} />
                              </button>
                              <button
                                className="btn-ghost p-1.5 text-red-500"
                                aria-label="Delete"
                                disabled={busy === m.id}
                                onClick={() => removeMaint(m.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {m.status !== 'done' && (
                            <button className="btn-success text-sm self-start" onClick={() => openComplete(m)}>
                              <Check size={15} /> Log / Complete
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Asset modal */}
      <Modal
        open={assetModal}
        wide
        title={assetForm.id ? 'Edit asset' : 'Add asset'}
        onClose={() => setAssetModal(false)}
        footer={
          <>
            {assetForm.id && (
              <button className="btn-danger mr-auto" onClick={removeAsset} disabled={saving}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button className="btn-secondary" onClick={() => setAssetModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveAsset} disabled={saving || !assetForm.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <Field label="Name">
          <Input value={assetForm.name} placeholder="Family SUV" onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })}>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Year">
            <Input type="number" value={assetForm.year} placeholder="2021" onChange={(e) => setAssetForm({ ...assetForm, year: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make">
            <Input value={assetForm.make} placeholder="Toyota" onChange={(e) => setAssetForm({ ...assetForm, make: e.target.value })} />
          </Field>
          <Field label="Model">
            <Input value={assetForm.model} placeholder="Highlander" onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })} />
          </Field>
        </div>
        <Field label="Identifier" hint="VIN / serial #">
          <Input value={assetForm.identifier} onChange={(e) => setAssetForm({ ...assetForm, identifier: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase date">
            <Input type="date" value={assetForm.purchase_date} onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })} />
          </Field>
          <Field label="Warranty expires">
            <Input type="date" value={assetForm.warranty_expires} onChange={(e) => setAssetForm({ ...assetForm, warranty_expires: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase price">
            <Input type="number" value={assetForm.purchase_price}
              onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Current value">
            <Input type="number" value={assetForm.current_value}
              onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mileage" hint={assetForm.type === 'vehicle' ? 'current odometer' : 'vehicles only'}>
            <Input type="number" value={assetForm.mileage} onChange={(e) => setAssetForm({ ...assetForm, mileage: e.target.value })} />
          </Field>
          <Field label="Location">
            <Input value={assetForm.location} placeholder="Garage" onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} />
          </Field>
        </div>
        <Field label="Icon" hint="Lucide icon name e.g. Car, Refrigerator, Wind, Trees">
          <Input value={assetForm.icon} placeholder="Car" onChange={(e) => setAssetForm({ ...assetForm, icon: e.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} />
        </Field>
      </Modal>

      {/* Maintenance modal */}
      <Modal
        open={maintModal}
        wide
        title={maintForm.id ? 'Edit maintenance' : 'Add maintenance'}
        onClose={() => setMaintModal(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setMaintModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveMaint} disabled={saving || !maintForm.title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <Field label="Title">
          <Input value={maintForm.title} placeholder="Oil change" onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={maintForm.type} onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value })}>
              {MAINT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Provider">
            <Input value={maintForm.provider} placeholder="Jiffy Lube" onChange={(e) => setMaintForm({ ...maintForm, provider: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <Input type="date" value={maintForm.due_date} onChange={(e) => setMaintForm({ ...maintForm, due_date: e.target.value })} />
          </Field>
          <Field label="Due mileage">
            <Input type="number" value={maintForm.due_mileage} onChange={(e) => setMaintForm({ ...maintForm, due_mileage: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost">
            <Input type="number" value={maintForm.cost}
              onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
          <Field label="Recurrence (months)" hint="0 = none">
            <Input type="number" value={maintForm.recurrence_months}
              onChange={(e) => setMaintForm({ ...maintForm, recurrence_months: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Recurrence (miles)" hint="0 = none">
          <Input type="number" value={maintForm.recurrence_miles}
            onChange={(e) => setMaintForm({ ...maintForm, recurrence_miles: e.target.value === '' ? 0 : Number(e.target.value) })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={maintForm.notes} onChange={(e) => setMaintForm({ ...maintForm, notes: e.target.value })} />
        </Field>
      </Modal>

      {/* Complete maintenance modal */}
      <Modal
        open={!!completeFor}
        title="Log completion"
        onClose={() => setCompleteFor(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCompleteFor(null)}>Cancel</button>
            <button className="btn-success" onClick={confirmComplete} disabled={saving}>
              {saving ? 'Saving…' : 'Mark complete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-500">
          Marking <span className="font-medium text-gray-700">{completeFor?.title}</span> as done.
          Recurring items will be auto-scheduled for next time.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost" hint="optional">
            <Input type="number" value={completeCost} onChange={(e) => setCompleteCost(e.target.value)} />
          </Field>
          <Field label="Mileage" hint="optional — updates odometer">
            <Input type="number" value={completeMileage} onChange={(e) => setCompleteMileage(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
