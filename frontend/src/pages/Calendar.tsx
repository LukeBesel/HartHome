import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, MapPin } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, Modal, Field, Input, Select, EmptyState, Avatar, Segmented,
} from '../components/shared/ui';
import { fmtDate, fmtTime, toLocalInput, memberById } from '../utils/format';
import type { EventItem } from '../types';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];
const CATEGORIES = ['general', 'family', 'school', 'sports', 'medical', 'work', 'errand', 'birthday'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface EventForm {
  id?: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string;
  member_id: string;
  color: string;
  category: string;
  colorTouched: boolean;
}

const blankForm = (start?: Date): EventForm => ({
  title: '',
  start_at: toLocalInput(start ? start.toISOString() : undefined),
  end_at: '',
  all_day: false,
  location: '',
  member_id: '',
  color: COLORS[0],
  category: 'general',
  colorTouched: false,
});

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function Calendar() {
  const { data: events, loading, refresh } = useAsync(() => api.events(), []);
  const { data: members } = useAsync(() => api.members(), []);

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(blankForm());
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const memberList = members || [];
  const allEvents = events || [];

  // Build the month grid (6 weeks of cells starting on the Sunday before/at the 1st).
  const cells = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const eventsForDay = (day: Date) =>
    allEvents
      .filter((e) => { const d = new Date(e.start_at); return !isNaN(+d) && sameDay(d, day); })
      .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));

  const agendaGroups = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const upcoming = allEvents
      .filter((e) => { const d = new Date(e.start_at); return !isNaN(+d) && +d >= +start; })
      .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
    const groups: { key: string; date: string; items: EventItem[] }[] = [];
    for (const e of upcoming) {
      const key = new Date(e.start_at).toDateString();
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, date: e.start_at, items: [] }; groups.push(g); }
      g.items.push(e);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents]);

  const openCreate = (day?: Date) => {
    setForm(blankForm(day));
    setModalOpen(true);
  };

  const openEdit = (e: EventItem) => {
    setForm({
      id: e.id,
      title: e.title,
      start_at: toLocalInput(e.start_at),
      end_at: e.end_at ? toLocalInput(e.end_at) : '',
      all_day: !!e.all_day,
      location: e.location || '',
      member_id: e.member_id || '',
      color: e.color || COLORS[0],
      category: e.category || 'general',
      colorTouched: true,
    });
    setModalOpen(true);
  };

  const pickMember = (id: string) => {
    setForm((f) => {
      const m = memberById(memberList, id);
      return { ...f, member_id: id, color: !f.colorTouched && m ? m.avatar_color : f.color };
    });
  };

  const save = async () => {
    if (!form.title.trim() || !form.start_at) return;
    setSaving(true);
    try {
      const body: Partial<EventItem> = {
        title: form.title.trim(),
        start_at: new Date(form.start_at).toISOString(),
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        all_day: form.all_day ? 1 : 0,
        location: form.location,
        member_id: form.member_id || null,
        color: form.color,
        category: form.category,
      };
      if (form.id) await api.updateEvent(form.id, body);
      else await api.createEvent(body);
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      await api.deleteEvent(form.id);
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Calendar"
        subtitle={monthLabel}
        icon={CalendarDays}
        actions={
          <>
            <Segmented
              options={[{ value: 'month', label: 'Month' }, { value: 'agenda', label: 'Agenda' }]}
              value={view}
              onChange={setView}
            />
            <div className="inline-flex items-center gap-1">
              <button className="btn-ghost p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <button className="btn-secondary" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</button>
              <button className="btn-ghost p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
            <button className="btn-primary" onClick={() => openCreate()}><Plus size={16} /> New event</button>
          </>
        }
      />

      {loading && !events ? (
        <Spinner />
      ) : view === 'month' ? (
        <div className="card p-2 sm:p-3">
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = sameDay(day, today);
              const dayEvents = eventsForDay(day);
              return (
                <button
                  key={i}
                  onClick={() => openCreate(day)}
                  className={`text-left min-h-[84px] sm:min-h-[110px] rounded-xl border p-1.5 transition-colors hover:bg-gray-50 ${inMonth ? 'border-gray-100' : 'border-transparent bg-gray-50/40'}`}
                >
                  <div className="flex justify-end">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full ${inMonth ? 'text-gray-700' : 'text-gray-300'}`}
                      style={isToday ? { boxShadow: 'inset 0 0 0 2px var(--accent)', color: 'var(--accent)' } : undefined}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                        className="truncate text-[11px] leading-tight rounded-md px-1.5 py-0.5 font-medium cursor-pointer"
                        style={{ backgroundColor: `${e.color}22`, color: e.color }}
                        title={e.title}
                      >
                        {!e.all_day && <span className="opacity-70">{fmtTime(e.start_at)} </span>}{e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : agendaGroups.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming events" message="Add an event to see it on your agenda." action={<button className="btn-primary" onClick={() => openCreate()}><Plus size={16} /> New event</button>} />
      ) : (
        <div className="space-y-5">
          {agendaGroups.map((g) => (
            <div key={g.key}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">{fmtDate(g.date, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
              <div className="space-y-2">
                {g.items.map((e) => {
                  const m = memberById(memberList, e.member_id);
                  return (
                    <button key={e.id} onClick={() => openEdit(e)} className="card card-hover w-full text-left p-3 flex items-center gap-3">
                      <span className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 truncate">{e.title}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                          <span>{e.all_day ? 'All day' : fmtTime(e.start_at)}</span>
                          {e.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{e.location}</span>}
                          <span className="badge badge-gray">{e.category}</span>
                        </div>
                      </div>
                      {m && <Avatar user={m} size={30} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={form.id ? 'Edit event' : 'New event'}
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
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" />
        </Field>
        <Field label="Starts">
          <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={form.all_day} onChange={(e) => setForm({ ...form, all_day: e.target.checked })} />
          All-day event
        </label>
        <Field label="Ends" hint="Optional">
          <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
        </Field>
        <Field label="Location" hint="Optional">
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Where?" />
        </Field>
        <Field label="Assignee" hint="Optional">
          <Select value={form.member_id} onChange={(e) => pickMember(e.target.value)}>
            <option value="">No one</option>
            {memberList.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </Select>
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c, colorTouched: true })}
                className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: form.color === c ? '0 0 0 2px white, 0 0 0 4px var(--accent)' : 'none' }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
          </Select>
        </Field>
      </Modal>
    </div>
  );
}
