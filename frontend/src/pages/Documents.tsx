import { useMemo, useRef, useState } from 'react';
import { toast } from '../components/shared/Toast';
import { FileText, Plus, Pencil, Trash2, AlertTriangle, Hash, Paperclip, Download, X } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Textarea, Select, EmptyState,
} from '../components/shared/ui';
import { dueLabel, daysUntil } from '../utils/format';
import type { DocItem } from '../types';

const CATEGORIES = ['identity', 'insurance', 'financial', 'medical', 'legal', 'warranty', 'vehicle', 'home', 'other'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface DocForm {
  id?: string;
  name: string;
  category: string;
  reference: string;
  expires_at: string;
  notes: string;
  file_data: string;
  file_name: string;
}

const emptyDoc = (): DocForm => ({ name: '', category: 'identity', reference: '', expires_at: '', notes: '', file_data: '', file_name: '' });

export default function Documents() {
  const { data: documents, loading, refresh } = useAsync(() => api.documents(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<DocForm>(emptyDoc());
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('Please choose a file under 8 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, file_data: String(reader.result), file_name: file.name }));
    reader.readAsDataURL(file);
  };

  const docList: DocItem[] = documents || [];

  const expiringSoon = docList.filter((d) => {
    const n = daysUntil(d.expires_at);
    return d.expires_at != null && n !== null && n >= 0 && n <= 60;
  }).length;

  const grouped = useMemo(() => {
    const map: Record<string, DocItem[]> = {};
    for (const d of docList) {
      const cat = CATEGORIES.includes(d.category) ? d.category : 'other';
      (map[cat] ||= []).push(d);
    }
    return CATEGORIES
      .filter((cat) => map[cat]?.length)
      .map((cat) => ({ cat, items: map[cat].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [docList]);

  const openCreate = () => { setForm(emptyDoc()); setModalOpen(true); };
  const openEdit = (d: DocItem) => {
    setForm({
      id: d.id, name: d.name, category: d.category || 'other',
      reference: d.reference || '', expires_at: d.expires_at || '', notes: d.notes || '',
      file_data: d.file_data || '', file_name: d.file_name || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const body: Partial<DocItem> = {
      name: form.name.trim(),
      category: form.category,
      reference: form.reference.trim(),
      expires_at: form.expires_at || null,
      notes: form.notes.trim(),
      file_data: form.file_data || null,
      file_name: form.file_name || null,
    };
    try {
      if (form.id) await api.updateDocument(form.id, body);
      else await api.createDocument(body);
      setModalOpen(false);
      await refresh();
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try { await api.deleteDocument(form.id); setModalOpen(false); await refresh(); }
    finally { setSaving(false); }
  };

  // Color the expiry label: red if past, amber if within 60 days, gray otherwise.
  const expiryClass = (s?: string | null): string => {
    const n = daysUntil(s);
    if (n === null) return 'text-gray-400';
    if (n < 0) return 'text-red-600 font-medium';
    if (n <= 60) return 'text-amber-600 font-medium';
    return 'text-gray-500';
  };

  if (loading && !documents) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Your important-document vault and renewal reminders"
        icon={FileText}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add document</button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard icon={FileText} label="Documents" value={docList.length} tone="indigo" />
        <StatCard icon={AlertTriangle} label="Expiring soon" value={expiringSoon} sub="within 60 days" tone="amber" />
      </div>

      <p className="text-xs text-gray-500">
        Store document details, renewal reminders, and attach a file (PDF or photo) from your computer.
      </p>

      {docList.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          message="Track passports, insurance policies, licenses, and warranties — with renewal reminders."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add document</button>}
        />
      ) : (
        <div className="space-y-7">
          {grouped.map(({ cat, items }) => (
            <section key={cat} className="space-y-3">
              <h2 className="section-label">{cap(cat)} <span className="text-xs text-gray-400">({items.length})</span></h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((d) => (
                  <div key={d.id} className="card p-4 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{d.name}</h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button className="btn-ghost p-1.5" aria-label="Edit document" onClick={() => openEdit(d)}><Pencil size={14} /></button>
                        <button className="btn-ghost p-1.5 text-red-500" aria-label="Delete document" onClick={() => openEdit(d)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <span className="badge badge-gray w-fit capitalize">{cap(d.category)}</span>
                    {d.reference && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Hash size={12} className="flex-shrink-0" /> {d.reference}
                      </p>
                    )}
                    {d.expires_at && (
                      <p className={`text-xs ${expiryClass(d.expires_at)}`}>
                        Expires {dueLabel(d.expires_at)}
                      </p>
                    )}
                    {d.notes && <p className="text-xs text-gray-400">{d.notes}</p>}
                    {d.file_data && (
                      <a href={d.file_data} download={d.file_name || d.name} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium mt-1 w-fit" style={{ color: 'var(--accent)' }}>
                        <Download size={12} /> {d.file_name || 'Open file'}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit document' : 'Add document'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            {form.id && (
              <button className="btn-danger mr-auto" onClick={remove} disabled={saving}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <Field label="Name">
          <Input value={form.name} placeholder="Passport — Alex" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </Select>
        </Field>
        <Field label="Reference" hint="Policy / account / license #">
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Field label="Expires">
          <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <Field label="Attached file" hint="PDF or photo from your computer, up to 8 MB.">
          <input ref={fileRef} type="file" className="hidden" onChange={pickFile} />
          {form.file_data ? (
            <div className="flex items-center gap-2 p-2 rounded-xl border border-gray-200">
              <Paperclip size={15} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate flex-1">{form.file_name || 'Attached file'}</span>
              <a href={form.file_data} download={form.file_name} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" title="Preview"><Download size={15} /></a>
              <button className="btn-ghost p-1.5 text-red-500" onClick={() => setForm({ ...form, file_data: '', file_name: '' })} aria-label="Remove file"><X size={15} /></button>
            </div>
          ) : (
            <button type="button" className="btn-secondary w-full" onClick={() => fileRef.current?.click()}><Paperclip size={15} /> Choose a file…</button>
          )}
        </Field>
      </Modal>
    </div>
  );
}
