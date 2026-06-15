import { useEffect, useState } from 'react';
import { ListChecks, Plus, Trash2, Eraser } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, Modal, Field, Input, Select, EmptyState, Icon,
} from '../components/shared/ui';
import type { ListBoard, ListItem } from '../types';

const LIST_TYPES = ['grocery', 'todo', 'custom', 'packing', 'wishlist'];
const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

interface ListForm {
  name: string;
  type: string;
  icon: string;
  color: string;
}

const blankListForm = (): ListForm => ({ name: '', type: 'grocery', icon: 'ListChecks', color: COLORS[0] });

export default function Lists() {
  const { data: lists, loading, refresh } = useAsync(() => api.lists(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listModal, setListModal] = useState(false);
  const [listForm, setListForm] = useState<ListForm>(blankListForm());
  const [savingList, setSavingList] = useState(false);

  const boards = lists || [];
  const selected = boards.find((b) => b.id === selectedId) || boards[0] || null;

  // Keep a valid selection as boards load/change.
  useEffect(() => {
    if (boards.length === 0) { setSelectedId(null); return; }
    if (!boards.some((b) => b.id === selectedId)) setSelectedId(boards[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards]);

  const { data: items, refresh: refreshItems } = useAsync<ListItem[]>(
    () => (selected ? api.listItems(selected.id) : Promise.resolve([])),
    [selected?.id],
  );
  const itemList = items || [];

  const [newItem, setNewItem] = useState('');
  const [newQty, setNewQty] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const addItem = async () => {
    if (!selected || !newItem.trim()) return;
    await api.createListItem({ list_id: selected.id, name: newItem.trim(), qty: newQty.trim() });
    setNewItem('');
    setNewQty('');
    await refreshItems();
  };

  const toggle = async (item: ListItem) => {
    setBusyId(item.id);
    try { await api.updateListItem(item.id, { done: item.done ? 0 : 1 }); await refreshItems(); }
    finally { setBusyId(null); }
  };

  const deleteItem = async (id: string) => {
    setBusyId(id);
    try { await api.deleteListItem(id); await refreshItems(); } finally { setBusyId(null); }
  };

  const clearDone = async () => {
    if (!selected) return;
    await api.clearDone(selected.id);
    await refreshItems();
  };

  const deleteList = async () => {
    if (!selected) return;
    await api.deleteList(selected.id);
    setSelectedId(null);
    await refresh();
  };

  const saveList = async () => {
    if (!listForm.name.trim()) return;
    setSavingList(true);
    try {
      const created = await api.createList({
        name: listForm.name.trim(), type: listForm.type, icon: listForm.icon || 'ListChecks', color: listForm.color,
      });
      setListModal(false);
      setListForm(blankListForm());
      await refresh();
      if (created?.id) setSelectedId(created.id);
    } finally {
      setSavingList(false);
    }
  };

  // Group items by category for grocery lists; otherwise a single bucket.
  const grouped: { heading: string; items: ListItem[] }[] = (() => {
    if (!selected || selected.type !== 'grocery') return [{ heading: '', items: itemList }];
    const map = new Map<string, ListItem[]>();
    for (const it of itemList) {
      const key = it.category?.trim() || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()].map(([heading, items]) => ({ heading, items }));
  })();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Lists"
        subtitle="Shared lists for the whole family"
        icon={ListChecks}
        actions={<button className="btn-primary" onClick={() => { setListForm(blankListForm()); setListModal(true); }}><Plus size={16} /> New list</button>}
      />

      {loading && !lists ? (
        <Spinner />
      ) : boards.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No lists yet"
          message="Create your first list to start collecting items."
          action={<button className="btn-primary" onClick={() => { setListForm(blankListForm()); setListModal(true); }}><Plus size={16} /> New list</button>}
        />
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-64 md:flex-shrink-0">
            <div className="card p-2 space-y-1">
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${selected?.id === b.id ? 'bg-gray-100 font-semibold text-gray-900' : 'hover:bg-gray-50 text-gray-600'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                  <Icon name={b.icon || 'ListChecks'} size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate flex-1">{b.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex-1 min-w-0 space-y-4">
            {selected && (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Icon name={selected.icon || 'ListChecks'} size={18} style={{ color: selected.color }} />
                    {selected.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button className="btn-secondary inline-flex items-center gap-1.5 text-sm" onClick={clearDone}><Eraser size={15} /> Clear checked</button>
                    <button className="btn-ghost p-2 text-red-500" onClick={deleteList} aria-label="Delete list"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="card p-2 flex items-center gap-2">
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                    placeholder="Add an item…"
                    className="flex-1"
                  />
                  <Input
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }}
                    placeholder="Qty"
                    className="w-20"
                  />
                  <button className="btn-primary" onClick={addItem} disabled={!newItem.trim()}><Plus size={16} /> Add</button>
                </div>

                {itemList.length === 0 ? (
                  <EmptyState icon={ListChecks} title="Empty list" message="Add items above to get started." />
                ) : (
                  <div className="space-y-5">
                    {grouped.map((group) => (
                      <div key={group.heading || '__'}>
                        {group.heading && <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.heading}</h3>}
                        <div className="card divide-y divide-gray-100">
                          {group.items.map((it) => (
                            <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={!!it.done}
                                disabled={busyId === it.id}
                                onChange={() => toggle(it)}
                                className="w-5 h-5 rounded flex-shrink-0"
                              />
                              <span className={`flex-1 min-w-0 truncate ${it.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{it.name}</span>
                              {it.qty && <span className="text-sm text-gray-400 flex-shrink-0">{it.qty}</span>}
                              <button className="btn-ghost p-1.5 text-red-400 flex-shrink-0" onClick={() => deleteItem(it.id)} disabled={busyId === it.id} aria-label="Delete item"><Trash2 size={15} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <Modal
        open={listModal}
        title="New list"
        onClose={() => setListModal(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setListModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveList} disabled={savingList || !listForm.name.trim()}>{savingList ? 'Saving…' : 'Create'}</button>
          </>
        }
      >
        <Field label="Name">
          <Input value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} placeholder="e.g. Groceries" />
        </Field>
        <Field label="Type">
          <Select value={listForm.type} onChange={(e) => setListForm({ ...listForm, type: e.target.value })}>
            {LIST_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </Field>
        <Field label="Icon" hint="Lucide icon name e.g. ShoppingCart">
          <Input value={listForm.icon} onChange={(e) => setListForm({ ...listForm, icon: e.target.value })} placeholder="ListChecks" />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setListForm({ ...listForm, color: c })}
                className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: listForm.color === c ? '0 0 0 2px white, 0 0 0 4px var(--accent)' : 'none' }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
      </Modal>
    </div>
  );
}
