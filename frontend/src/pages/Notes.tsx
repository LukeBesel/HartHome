import { useMemo, useState } from 'react';
import { StickyNote, Plus, Trash2, Pencil, Pin } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, Spinner, Modal, Field, Input, Textarea, EmptyState,
} from '../components/shared/ui';
import { relativeTime, memberById } from '../utils/format';
import type { Note, User } from '../types';

const SWATCHES = ['#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#ede9fe', '#fee2e2', '#f1f5f9'];

interface NoteForm {
  id?: string;
  title: string;
  body: string;
  color: string;
}

const emptyForm = (): NoteForm => ({ title: '', body: '', color: SWATCHES[0] });

export default function Notes() {
  const { user } = useAuth();
  const { data: notes, loading, refresh } = useAsync(() => api.notes(), []);
  const { data: members } = useAsync(() => api.members(), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NoteForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const memberList: User[] = members || [];

  // Server already sorts pinned first; keep a stable secondary sort just in case.
  const noteList = useMemo(() => {
    return [...(notes || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [notes]);

  const openCreate = () => { setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (n: Note) => {
    setForm({ id: n.id, title: n.title || '', body: n.body || '', color: n.color || SWATCHES[0] });
    setModalOpen(true);
  };

  const togglePin = async (n: Note) => {
    setBusy(n.id);
    try { await api.updateNote(n.id, { pinned: n.pinned ? 0 : 1 }); await refresh(); } finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try { await api.deleteNote(id); await refresh(); } finally { setBusy(null); }
  };

  const save = async () => {
    if (!form.body.trim()) return;
    setSaving(true);
    try {
      const body: Partial<Note> = {
        title: form.title.trim(),
        body: form.body,
        color: form.color,
      };
      if (form.id) {
        await api.updateNote(form.id, body);
      } else {
        await api.createNote({ ...body, author_id: user?.id ?? null });
      }
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Notes"
        subtitle="The family bulletin board"
        icon={StickyNote}
        actions={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> New note</button>}
      />

      {loading && !notes ? (
        <Spinner />
      ) : noteList.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          message="Pin a reminder, a recipe, or a sweet message for the family."
          action={<button className="btn-primary" onClick={openCreate}><Plus size={16} /> New note</button>}
        />
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {noteList.map((n) => {
            const author = memberById(memberList, n.author_id);
            return (
              <div
                key={n.id}
                className="mb-4 break-inside-avoid rounded-2xl p-4 shadow-sm border border-black/5 text-gray-800"
                style={{ backgroundColor: n.color || SWATCHES[0] }}
              >
                <div className="flex items-start justify-between gap-2">
                  {n.title ? (
                    <h3 className="font-bold text-gray-800 min-w-0 break-words">{n.title}</h3>
                  ) : (
                    <span />
                  )}
                  <button
                    className={`p-1 rounded-lg transition-colors flex-shrink-0 ${n.pinned ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                    onClick={() => togglePin(n)}
                    disabled={busy === n.id}
                    aria-label={n.pinned ? 'Unpin note' : 'Pin note'}
                  >
                    <Pin size={16} fill={n.pinned ? 'currentColor' : 'none'} />
                  </button>
                </div>

                {n.body && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-1">{n.body}</p>}

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-black/5">
                  <div className="text-[11px] text-gray-600 min-w-0 truncate">
                    {author ? `${author.display_name} · ` : ''}{relativeTime(n.updated_at)}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button className="p-1 rounded-lg text-gray-500 hover:text-gray-800" onClick={() => openEdit(n)} aria-label="Edit note"><Pencil size={14} /></button>
                    <button className="p-1 rounded-lg text-gray-500 hover:text-red-500" onClick={() => remove(n.id)} disabled={busy === n.id} aria-label="Delete note"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit note' : 'New note'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.body.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Title" hint="Optional">
          <Input value={form.title} placeholder="e.g. Grocery reminder" onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Note">
          <Textarea value={form.body} rows={4} placeholder="What do you want to remember?" onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </Field>
        <Field label="Color">
          <div className="flex items-center gap-2 flex-wrap">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={`w-8 h-8 rounded-full border border-black/10 transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Field>
      </Modal>
    </div>
  );
}
