import { useMemo, useState } from 'react';
import { Phone, Mail, Plus, Pencil, Trash2, MapPin, ShieldAlert, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Textarea, Select, EmptyState,
} from '../components/shared/ui';
import type { Contact } from '../types';

const CATEGORIES = ['emergency', 'medical', 'school', 'service', 'family', 'work', 'other'];
// Render order — emergency always first.
const CATEGORY_ORDER = ['emergency', 'medical', 'school', 'service', 'family', 'work', 'other'];

const CATEGORY_LABELS: Record<string, string> = {
  emergency: 'Emergency', medical: 'Medical', school: 'School', service: 'Services',
  family: 'Family', work: 'Work', other: 'Other',
};

interface ContactForm {
  id?: string;
  name: string;
  relationship: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const emptyContact = (): ContactForm => ({
  name: '', relationship: '', category: 'family', phone: '', email: '', address: '', notes: '',
});

export default function Contacts() {
  const { data: contacts, loading, refresh } = useAsync(() => api.contacts(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ContactForm>(emptyContact());
  const [saving, setSaving] = useState(false);

  const contactList: Contact[] = contacts || [];

  const grouped = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const c of contactList) {
      const cat = CATEGORIES.includes(c.category) ? c.category : 'other';
      (map[cat] ||= []).push(c);
    }
    return CATEGORY_ORDER
      .filter((cat) => map[cat]?.length)
      .map((cat) => ({ cat, items: map[cat].sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [contactList]);

  const emergencyCount = contactList.filter((c) => c.category === 'emergency').length;

  const openCreate = () => { setForm(emptyContact()); setModalOpen(true); };
  const openEdit = (c: Contact) => {
    setForm({
      id: c.id, name: c.name, relationship: c.relationship || '', category: c.category || 'other',
      phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const body: Partial<Contact> = {
      name: form.name.trim(),
      relationship: form.relationship.trim(),
      category: form.category,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (form.id) await api.updateContact(form.id, body);
      else await api.createContact(body);
      setModalOpen(false);
      await refresh();
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try { await api.deleteContact(form.id); setModalOpen(false); await refresh(); }
    finally { setSaving(false); }
  };

  const renderCard = (c: Contact, emergency: boolean) => (
    <div
      key={c.id}
      className={`card p-4 flex flex-col gap-3 ${emergency ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {emergency && <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />}
            <h3 className="font-bold text-gray-900 truncate">{c.name}</h3>
          </div>
          {c.relationship && <p className="text-xs text-gray-500 truncate">{c.relationship}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button className="btn-ghost p-1.5" aria-label="Edit contact" onClick={() => openEdit(c)}><Pencil size={14} /></button>
          <button className="btn-ghost p-1.5 text-red-500" aria-label="Delete contact" onClick={() => openEdit(c)}><Trash2 size={14} /></button>
        </div>
      </div>

      <span className={`badge w-fit capitalize ${emergency ? 'badge-red' : 'badge-gray'}`}>
        {CATEGORY_LABELS[c.category] || c.category}
      </span>

      <div className="flex flex-wrap gap-2">
        {c.phone && (
          <a href={`tel:${c.phone}`} className="btn-secondary text-sm">
            <Phone size={14} /> {c.phone}
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} className="btn-secondary text-sm">
            <Mail size={14} /> {c.email}
          </a>
        )}
      </div>

      {c.address && (
        <p className="flex items-start gap-1.5 text-xs text-gray-500">
          <MapPin size={13} className="mt-0.5 flex-shrink-0" /> {c.address}
        </p>
      )}
      {c.notes && <p className="text-xs text-gray-400">{c.notes}</p>}
    </div>
  );

  if (loading && !contacts) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Emergency, medical, school, and family contacts in one place"
        icon={Phone}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add contact</button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Contacts" value={contactList.length} tone="indigo" />
        <StatCard icon={ShieldAlert} label="Emergency" value={emergencyCount} sub="quick-access" tone="red" />
      </div>

      {contactList.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="No contacts yet"
          message="Add emergency, medical, school, and family contacts so everyone can reach them fast."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add contact</button>}
        />
      ) : (
        <div className="space-y-7">
          {grouped.map(({ cat, items }) => {
            const emergency = cat === 'emergency';
            return (
              <section key={cat} className="space-y-3">
                <div className="flex items-center gap-2">
                  {emergency && <ShieldAlert size={16} className="text-red-500" />}
                  <h2 className={`section-label ${emergency ? 'text-red-600' : ''}`}>
                    {CATEGORY_LABELS[cat] || cat}
                  </h2>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((c) => renderCard(c, emergency))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit contact' : 'Add contact'}
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
          <Input value={form.name} placeholder="Dr. Smith" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Relationship">
            <Input value={form.relationship} placeholder="Pediatrician" onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input type="tel" value={form.phone} placeholder="555-0100" onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} placeholder="name@example.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Notes">
          <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </Modal>
    </div>
  );
}
