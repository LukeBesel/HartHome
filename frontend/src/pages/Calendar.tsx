import { useMemo, useRef, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Upload, Clock, MapPin,
} from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import { useLiveRefresh } from '../api/live';
import { PageHeader, Spinner, Modal, Field, Input, Select, Segmented, Avatar } from '../components/shared/ui';
import { fmtTime, toLocalInput, memberById } from '../utils/format';
import type { EventItem, User } from '../types';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];
const CATEGORIES = ['general', 'family', 'school', 'sports', 'medical', 'work', 'errand', 'birthday'];
const RECURRENCE = [
  { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' },
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type View = 'month' | 'week' | 'agenda';
type Occurrence = EventItem & { _start: Date; _key: string };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => addDays(d, -d.getDay());

// Expand a stored event into the concrete occurrences that fall within a window.
// Recurrence lives on the event row; we materialize instances client-side so the
// calendar shows repeating events without storing every copy.
function expand(events: EventItem[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const e of events) {
    const base = new Date(e.start_at);
    if (isNaN(+base)) continue;
    const rec = e.recurrence || 'none';
    const push = (d: Date) => out.push({ ...e, _start: d, _key: `${e.id}-${ymd(d)}` });
    if (rec === 'none') {
      if (base >= from && base <= to) push(base);
      continue;
    }
    let cur = new Date(base);
    let guard = 0;
    while (cur <= to && guard++ < 800) {
      if (cur >= from) push(new Date(cur));
      if (rec === 'daily') cur = addDays(cur, 1);
      else if (rec === 'weekly') cur = addDays(cur, 7);
      else if (rec === 'biweekly') cur = addDays(cur, 14);
      else if (rec === 'monthly') cur = new Date(cur.getFullYear(), cur.getMonth() + 1, base.getDate(), base.getHours(), base.getMinutes());
      else if (rec === 'yearly') cur = new Date(cur.getFullYear() + 1, base.getMonth(), base.getDate(), base.getHours(), base.getMinutes());
      else break;
    }
  }
  return out.sort((a, b) => +a._start - +b._start);
}

// Minimal .ics (VEVENT) parser — enough for typical Google/Apple exports.
function parseICS(text: string): Partial<EventItem>[] {
  const events: Partial<EventItem>[] = [];
  const lines = text.replace(/\r\n[ \t]/g, '').split(/\r?\n/); // unfold continuation lines
  let cur: any = null;
  const toISO = (v: string) => {
    const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (!h) return new Date(+y, +mo - 1, +d, 9, 0).toISOString();
    return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))).toISOString()
             : new Date(+y, +mo - 1, +d, +h, +mi, +(s || 0)).toISOString();
  };
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur?.start_at) events.push(cur); cur = null; }
    else if (cur) {
      const idx = line.indexOf(':'); if (idx < 0) continue;
      const key = line.slice(0, idx).split(';')[0]; const val = line.slice(idx + 1);
      if (key === 'SUMMARY') cur.title = val;
      else if (key === 'LOCATION') cur.location = val;
      else if (key === 'DESCRIPTION') cur.description = val;
      else if (key === 'DTSTART') { cur.start_at = toISO(val); cur.all_day = /^\d{8}$/.test(val) ? 1 : 0; }
      else if (key === 'DTEND') cur.end_at = toISO(val);
    }
  }
  return events;
}

const emptyForm = (date?: Date) => ({
  id: '', title: '', start_at: toLocalInput(date ? new Date(new Date(date).setHours(9, 0, 0, 0)).toISOString() : null),
  end_at: '', all_day: false, location: '', member_id: '', color: COLORS[0], category: 'general', recurrence: 'none',
  _colorTouched: false,
});
type Form = ReturnType<typeof emptyForm>;

export default function Calendar() {
  const { data: events, loading, refresh } = useAsync(() => api.events(), []);
  const { data: members } = useAsync(() => api.members(), []);
  useLiveRefresh(refresh);

  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<{ id: string; day: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Drag an event onto another day to reschedule it (shifts the series anchor).
  const shiftIso = (iso: string, days: number) => { const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString(); };
  const dropOn = async (target: Date) => {
    const d = drag; setDrag(null);
    if (!d) return;
    const ev = (events || []).find(e => e.id === d.id);
    if (!ev) return;
    const delta = Math.round((Date.parse(ymd(target)) - Date.parse(d.day)) / 864e5);
    if (!delta) return;
    await api.updateEvent(ev.id, { start_at: shiftIso(ev.start_at, delta), end_at: ev.end_at ? shiftIso(ev.end_at, delta) : null });
    await refresh();
  };

  const ms = members || [];

  const [winStart, winEnd, gridDays] = useMemo<[Date, Date, Date[]]>(() => {
    if (view === 'week') {
      const s = startOfWeek(cursor);
      return [s, addDays(s, 6), Array.from({ length: 7 }, (_, i) => addDays(s, i))];
    }
    if (view === 'agenda') {
      const s = new Date(cursor); s.setHours(0, 0, 0, 0);
      return [s, addDays(s, 45), []];
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    return [gridStart, days[41], days];
  }, [view, cursor]);

  const occurrences = useMemo(
    () => expand(events || [], new Date(new Date(winStart).setHours(0, 0, 0, 0)), new Date(new Date(winEnd).setHours(23, 59, 59))),
    [events, winStart, winEnd]
  );
  const dayMap = useMemo(() => {
    const map: Record<string, Occurrence[]> = {};
    for (const o of occurrences) (map[ymd(o._start)] ||= []).push(o);
    return map;
  }, [occurrences]);

  const openCreate = (d?: Date) => { setForm(emptyForm(d)); setOpen(true); };
  const openEdit = (o: Occurrence) => {
    setForm({
      id: o.id, title: o.title, start_at: toLocalInput(o.start_at), end_at: o.end_at ? toLocalInput(o.end_at) : '',
      all_day: !!o.all_day, location: o.location || '', member_id: o.member_id || '', color: o.color,
      category: o.category || 'general', recurrence: o.recurrence || 'none', _colorTouched: true,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.start_at) return;
    setSaving(true);
    const body: Partial<EventItem> = {
      title: form.title.trim(),
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      all_day: form.all_day ? 1 : 0,
      location: form.location.trim(),
      member_id: form.member_id || null,
      color: form.color, category: form.category, recurrence: form.recurrence,
    };
    try {
      if (form.id) await api.updateEvent(form.id, body); else await api.createEvent(body);
      setOpen(false); await refresh();
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    if (!window.confirm('Delete this event? (Removes the whole series if it repeats.)')) return;
    await api.deleteEvent(form.id); setOpen(false); await refresh();
  };

  const importICS = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const parsed = parseICS(text).filter(ev => ev.title && ev.start_at);
    if (!parsed.length) { alert('No events found in that .ics file.'); return; }
    let n = 0;
    for (const ev of parsed) {
      await api.createEvent({ ...ev, color: COLORS[n % COLORS.length], category: 'general', recurrence: 'none' }).catch(() => {});
      n++;
    }
    if (fileRef.current) fileRef.current.value = '';
    await refresh();
    alert(`Imported ${n} event${n === 1 ? '' : 's'}.`);
  };

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else if (view === 'agenda') d.setDate(d.getDate() + dir * 14);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  const title = view === 'week'
    ? `${winStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${winEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading && !events) return <div className="p-6"><Spinner /></div>;
  const today = new Date();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Calendar" subtitle={title} icon={CalendarDays}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={importICS} />
            <button className="btn-secondary" onClick={() => fileRef.current?.click()} title="Import an .ics file (Google/Apple export)"><Upload size={16} /> Import</button>
            <button className="btn-primary" onClick={() => openCreate()}><Plus size={16} /> New event</button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-2" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
          <button className="btn-secondary" onClick={() => setCursor(new Date())}>Today</button>
          <button className="btn-ghost p-2" onClick={() => shift(1)} aria-label="Next"><ChevronRight size={18} /></button>
        </div>
        <Segmented options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'agenda', label: 'Agenda' }]} value={view} onChange={(v) => setView(v as View)} />
      </div>

      {view === 'agenda' ? (
        <AgendaView occurrences={occurrences} members={ms} onEdit={openEdit} />
      ) : view === 'week' ? (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {gridDays.map((d) => {
            const list = dayMap[ymd(d)] || [];
            const isToday = sameDay(d, today);
            return (
              <div key={ymd(d)} className="card p-2 min-h-[140px] flex flex-col"
                onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(d)}>
                <button onClick={() => openCreate(d)} className="text-left mb-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{DOW[d.getDay()]}</div>
                  <div className={`text-lg font-bold ${isToday ? 'text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-gray-800'}`} style={isToday ? { background: 'var(--accent)' } : {}}>{d.getDate()}</div>
                </button>
                <div className="space-y-1 flex-1">
                  {list.map(o => <EventPill key={o._key} o={o} onClick={() => openEdit(o)} onDragStart={() => setDrag({ id: o.id, day: ymd(o._start) })} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {DOW.map(d => <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((d) => {
              const list = dayMap[ymd(d)] || [];
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              return (
                <button key={ymd(d)} onClick={() => openCreate(d)}
                  onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(d)}
                  className={`text-left border-b border-r border-gray-100 min-h-[92px] p-1.5 align-top hover:bg-gray-50/60 transition-colors ${inMonth ? '' : 'bg-gray-50/40'}`}>
                  <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`} style={isToday ? { background: 'var(--accent)' } : {}}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map(o => <EventPill key={o._key} o={o} onClick={(e) => { e.stopPropagation(); openEdit(o); }} onDragStart={() => setDrag({ id: o.id, day: ymd(o._start) })} />)}
                    {list.length > 3 && <div className="text-[10px] text-gray-400 pl-1">+{list.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={open} title={form.id ? 'Edit event' : 'New event'} onClose={() => setOpen(false)}
        footer={<>
          {form.id && <button className="btn-ghost text-red-600 mr-auto" onClick={remove}><Trash2 size={15} /> Delete</button>}
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <Field label="Title"><Input value={form.title} placeholder="Soccer practice" onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} /> All day
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><Input type={form.all_day ? 'date' : 'datetime-local'} value={form.all_day ? form.start_at.slice(0, 10) : form.start_at} onChange={e => setForm({ ...form, start_at: form.all_day ? `${e.target.value}T09:00` : e.target.value })} /></Field>
          <Field label="Ends (optional)"><Input type={form.all_day ? 'date' : 'datetime-local'} value={form.end_at ? (form.all_day ? form.end_at.slice(0, 10) : form.end_at) : ''} onChange={e => setForm({ ...form, end_at: e.target.value ? (form.all_day ? `${e.target.value}T17:00` : e.target.value) : '' })} /></Field>
        </div>
        <Field label="Repeats"><Select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>{RECURRENCE.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field>
        <Field label="Who"><Select value={form.member_id} onChange={e => { const id = e.target.value; const mem = memberById(ms, id); setForm({ ...form, member_id: id, color: !form._colorTouched && mem ? mem.avatar_color : form.color }); }}>
          <option value="">Whole family</option>
          {ms.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </Select></Field>
        <Field label="Location (optional)"><Input value={form.location} placeholder="Riverside Field" onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</Select></Field>
          <Field label="Color">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {COLORS.map(c => <button key={c} type="button" onClick={() => setForm({ ...form, color: c, _colorTouched: true })} className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} style={{ backgroundColor: c }} />)}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function EventPill({ o, onClick, onDragStart }: { o: Occurrence; onClick: (e: React.MouseEvent) => void; onDragStart?: () => void }) {
  return (
    <button onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={(e) => { e.stopPropagation(); onDragStart?.(); }}
      className="w-full text-left px-1.5 py-0.5 rounded-md text-[11px] font-medium truncate flex items-center gap-1 hover:opacity-90 cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: `${o.color}22`, color: o.color }}>
      {!o.all_day && <span className="opacity-70">{fmtTime(o._start.toISOString())}</span>}
      <span className="truncate">{o.title}</span>
    </button>
  );
}

function AgendaView({ occurrences, members, onEdit }: { occurrences: Occurrence[]; members: User[]; onEdit: (o: Occurrence) => void }) {
  const groups: Record<string, Occurrence[]> = {};
  for (const o of occurrences) (groups[o._start.toDateString()] ||= []).push(o);
  const keys = Object.keys(groups);
  if (!keys.length) return <div className="card p-10 text-center text-gray-400">No upcoming events. Add one to get started.</div>;
  return (
    <div className="space-y-4">
      {keys.map(k => {
        const d = new Date(k);
        return (
          <div key={k} className="card p-4">
            <div className="text-sm font-semibold text-gray-800 mb-3">{d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="space-y-1.5">
              {groups[k].map(o => (
                <button key={o._key} onClick={() => onEdit(o)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 text-left">
                  <span className="w-1.5 h-9 rounded-full flex-shrink-0" style={{ background: o.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{o.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1"><Clock size={11} />{o.all_day ? 'All day' : fmtTime(o._start.toISOString())}</span>
                      {o.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{o.location}</span>}
                    </div>
                  </div>
                  {o.member_id && <Avatar user={memberById(members, o.member_id)} size={26} />}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
