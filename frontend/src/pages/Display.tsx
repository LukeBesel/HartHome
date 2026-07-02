import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, Check, Settings2, CalendarDays, CheckSquare, Megaphone, UtensilsCrossed, Image as ImageIcon, Trophy } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAsync } from '../hooks/useCollection';
import { useLiveRefresh } from '../api/live';
import { Avatar, Spinner } from '../components/shared/ui';
import { ToastHost, toast } from '../components/shared/Toast';
import { fmtTime, dueLabel, memberById, todayISO } from '../utils/format';
import type { DisplayPrefs } from '../types';

const WEATHER: Record<number, { t: string; e: string }> = {
  0: { t: 'Clear', e: '☀️' }, 1: { t: 'Mostly clear', e: '🌤️' }, 2: { t: 'Partly cloudy', e: '⛅' },
  3: { t: 'Overcast', e: '☁️' }, 45: { t: 'Foggy', e: '🌫️' }, 48: { t: 'Foggy', e: '🌫️' },
  51: { t: 'Drizzle', e: '🌦️' }, 53: { t: 'Drizzle', e: '🌦️' }, 55: { t: 'Drizzle', e: '🌦️' },
  61: { t: 'Rain', e: '🌧️' }, 63: { t: 'Rain', e: '🌧️' }, 65: { t: 'Heavy rain', e: '🌧️' },
  71: { t: 'Snow', e: '🌨️' }, 73: { t: 'Snow', e: '🌨️' }, 75: { t: 'Heavy snow', e: '❄️' },
  80: { t: 'Showers', e: '🌦️' }, 81: { t: 'Showers', e: '🌧️' }, 82: { t: 'Showers', e: '⛈️' },
  95: { t: 'Thunderstorm', e: '⛈️' }, 96: { t: 'Thunderstorm', e: '⛈️' }, 99: { t: 'Thunderstorm', e: '⛈️' },
};

const DEFAULT_DISPLAY: DisplayPrefs = {
  widgets: ['photos', 'today', 'chores', 'bulletin', 'points'],
  background: 'aurora', clock24: false, showWeather: true, photoInterval: 8, idleMinutes: 5,
};
const ALL_WIDGETS = [
  { id: 'photos', label: 'Photo slideshow' }, { id: 'today', label: "Today's schedule" },
  { id: 'chores', label: 'Chores' }, { id: 'bulletin', label: 'Bulletin' }, { id: 'points', label: 'Points race' },
];
const BACKGROUNDS = [{ id: 'aurora', label: 'Aurora' }, { id: 'gradient', label: 'Gradient' }, { id: 'solid', label: 'Solid' }, { id: 'photo', label: 'Photo' }];

function useWeather(enabled: boolean) {
  const [w, setW] = useState<{ temp: number; code: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const at = (lat: number, lon: number) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
      .then(r => r.json()).then(d => { if (d?.current) setW({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }); }).catch(() => {});
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => at(p.coords.latitude, p.coords.longitude), () => at(40.7128, -74.006), { timeout: 5000 });
    else at(40.7128, -74.006);
  }, [enabled]);
  return w;
}

export default function Display() {
  const { user } = useAuth();
  const { prefs, setPrefs } = useTheme();
  const cfg: DisplayPrefs = { ...DEFAULT_DISPLAY, ...(prefs.display || {}) };
  const { data, refresh } = useAsync(() => api.dashboard(), []);
  const { data: meals } = useAsync(() => api.meals({ date: todayISO() }), []);
  const { data: photos } = useAsync(() => api.photos(), []);
  const [now, setNow] = useState(new Date());
  const [bgIdx, setBgIdx] = useState(0);
  // Tap-to-complete from the wall display, with a brief check-off animation.
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const completeFromDisplay = async (c: { id: string; title: string; points: number }) => {
    setJustDone(s => new Set(s).add(c.id));
    try {
      const r = await api.completeChore(c.id);
      toast(`${c.title} done${r?.member ? ` — +${c.points} pts for ${String(r.member.display_name).split(' ')[0]}` : ''}! 🎉`);
      setTimeout(() => refresh().catch(() => {}), 900); // let the animation play
    } catch {
      setJustDone(s => { const n = new Set(s); n.delete(c.id); return n; });
      toast.error('Could not complete that chore.');
    }
  };
  const [configOpen, setConfigOpen] = useState(false);
  // Idle screensaver: after N quiet minutes, fade into a photo slideshow with a
  // big clock; any touch/movement wakes the board. 0 disables it.
  const [idle, setIdle] = useState(false);
  const lastActive = useRef(Date.now());
  useEffect(() => {
    const wake = () => { lastActive.current = Date.now(); setIdle(false); };
    const evs = ['pointerdown', 'pointermove', 'keydown', 'touchstart'] as const;
    evs.forEach(e => window.addEventListener(e, wake, { passive: true }));
    const t = setInterval(() => {
      if (cfg.idleMinutes > 0 && Date.now() - lastActive.current > cfg.idleMinutes * 60_000) setIdle(true);
    }, 10_000);
    return () => { evs.forEach(e => window.removeEventListener(e, wake)); clearInterval(t); };
  }, [cfg.idleMinutes]);
  const [saverIdx, setSaverIdx] = useState(0);
  useEffect(() => {
    if (!idle) return;
    const t = setInterval(() => setSaverIdx(i => i + 1), (cfg.photoInterval || 8) * 1000);
    return () => clearInterval(t);
  }, [idle, cfg.photoInterval]);
  const weather = useWeather(cfg.showWeather);
  useLiveRefresh(refresh);

  const pics = photos || [];
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000 * 30);
    const poll = setInterval(() => refresh().catch(() => {}), 1000 * 120);
    return () => { clearInterval(clock); clearInterval(poll); };
  }, [refresh]);
  useEffect(() => {
    if (cfg.background !== 'photo' || pics.length < 2) return;
    const t = setInterval(() => setBgIdx(i => (i + 1) % pics.length), (cfg.photoInterval || 8) * 1000);
    return () => clearInterval(t);
  }, [cfg.background, cfg.photoInterval, pics.length]);

  if (!data) return <div className="min-h-screen bg-slate-950"><Spinner /></div>;
  const m = data.members;
  const dinner = (meals || []).find(x => x.meal_type === 'dinner');
  const on = (id: string) => cfg.widgets.includes(id);
  const setCfg = (patch: Partial<DisplayPrefs>) => setPrefs({ display: { ...cfg, ...patch } });
  const toggleWidget = (id: string) => setCfg({ widgets: on(id) ? cfg.widgets.filter(w => w !== id) : [...cfg.widgets, id] });

  const bgStyle: React.CSSProperties =
    cfg.background === 'gradient' ? { background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }
    : cfg.background === 'solid' ? { background: 'var(--sidebar-bg)' }
    : cfg.background === 'photo' ? { background: '#000' }
    : { background: 'radial-gradient(1200px 600px at 20% -10%, #1e1b4b 0%, #0a0e27 55%, #060911 100%)' };
  const clock = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !cfg.clock24 });

  return (
    <div className="min-h-screen text-white p-6 sm:p-10 relative overflow-hidden" style={bgStyle}>
      {/* Full-bleed photo background */}
      {cfg.background === 'photo' && pics.length > 0 && (
        <>
          {pics.map((p, i) => <img key={p.id} src={p.url} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" style={{ opacity: i === bgIdx ? 1 : 0 }} />)}
          <div className="absolute inset-0 bg-black/55" />
        </>
      )}

      <div className="relative">
        <div className="fixed top-4 right-4 z-10 flex gap-2">
          <button onClick={() => setConfigOpen(true)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Display settings"><Settings2 size={20} /></button>
          <Link to="/dashboard" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Exit display mode"><X size={20} /></Link>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums">{clock}</div>
            <div className="text-xl text-white/70 mt-1">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
          <div className="flex items-center gap-6">
            {cfg.showWeather && weather && (
              <div className="flex items-center gap-3 text-right">
                <span className="text-5xl">{WEATHER[weather.code]?.e ?? '🌡️'}</span>
                <div><div className="text-4xl font-bold">{weather.temp}°</div><div className="text-sm text-white/70">{WEATHER[weather.code]?.t ?? ''}</div></div>
              </div>
            )}
            <div className="flex -space-x-3">{m.map(mem => <Avatar key={mem.id} user={mem} size={48} ring />)}</div>
          </div>
        </div>

        <div className="text-2xl font-semibold mb-6 text-white/90">{user?.household_name}</div>

        <div className="grid lg:grid-cols-3 gap-6">
          {on('photos') && (
            <div className="lg:col-span-1 lg:row-span-2"><Slideshow photos={pics} interval={cfg.photoInterval} /></div>
          )}
          {on('today') && (
            <Panel title="Today" icon={CalendarDays}>
              {data.todayEvents.length === 0 ? <Empty>Nothing scheduled</Empty> : data.todayEvents.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <span className="w-1.5 h-10 rounded-full" style={{ background: e.color }} />
                  <div className="flex-1 min-w-0"><div className="text-lg font-medium truncate">{e.title}</div><div className="text-sm text-white/60">{e.all_day ? 'All day' : fmtTime(e.start_at)}</div></div>
                  {e.member_id && <Avatar user={memberById(m, e.member_id)} size={34} />}
                </div>
              ))}
              {dinner && <div className="mt-4 flex items-center gap-2 text-white/80"><UtensilsCrossed size={18} /><span className="text-base">Dinner: <span className="font-semibold text-white">{dinner.title}</span></span></div>}
            </Panel>
          )}
          {on('chores') && (
            <Panel title="Chores" icon={CheckSquare}>
              {data.choresDue.length === 0 ? <Empty>All done! ✨</Empty> : data.choresDue.slice(0, 7).map(c => {
                const done = justDone.has(c.id);
                return (
                  <button key={c.id} onClick={() => completeFromDisplay(c)} disabled={done}
                    className={`w-full text-left flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 transition-all duration-500 rounded-lg px-1 -mx-1 hover:bg-white/5 active:scale-[0.99] ${done ? 'opacity-40' : ''}`}>
                    <span className={`w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${done ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-white/30'}`}>
                      {done && <Check size={15} className="text-white" />}
                    </span>
                    <div className="flex-1 min-w-0"><div className={`text-lg truncate ${done ? 'line-through' : ''}`}>{c.title}</div>{c.due_date && <div className="text-sm text-white/60">{dueLabel(c.due_date)}</div>}</div>
                    {c.assignee_id && <Avatar user={memberById(m, c.assignee_id)} size={30} />}
                    <span className="text-emerald-300 font-semibold">+{c.points}</span>
                  </button>
                );
              })}
            </Panel>
          )}
          {on('bulletin') && (
            <Panel title="Bulletin" icon={Megaphone}>
              {data.announcements.length === 0 ? <Empty>No messages</Empty> : data.announcements.slice(0, 4).map(a => (
                <div key={a.id} className="py-2 border-b border-white/5 last:border-0"><div className="text-base">{a.body}</div><div className="text-xs text-white/50">— {a.author_name}</div></div>
              ))}
            </Panel>
          )}
          {on('points') && (
            <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.28), rgba(236,72,153,.28))', border: '1px solid rgba(255,255,255,.12)' }}>
              <div className="flex items-center gap-2 mb-3 text-white/80"><Trophy size={18} /><div className="text-sm uppercase tracking-widest font-semibold">Points race</div></div>
              {[...m].sort((a, b) => b.points - a.points).map((mem, i) => (
                <div key={mem.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-sm font-bold text-white/50 w-4">{i + 1}</span><Avatar user={mem} size={30} />
                  <span className="flex-1 text-base truncate">{mem.display_name}</span><span className="text-xl font-bold">{mem.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Display settings */}
      {configOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfigOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-2xl p-5 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h3 className="font-bold">Display settings</h3><button onClick={() => setConfigOpen(false)} className="btn-ghost p-1"><X size={18} /></button></div>
            <div>
              <div className="section-label">Widgets</div>
              <div className="space-y-1.5">
                {ALL_WIDGETS.map(w => (
                  <label key={w.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <span className="text-sm text-gray-700">{w.label}</span>
                    <input type="checkbox" checked={on(w.id)} onChange={() => toggleWidget(w.id)} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="section-label">Background</div>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.map(b => (
                  <button key={b.id} onClick={() => setCfg({ background: b.id as DisplayPrefs['background'] })}
                    className={`py-2 rounded-lg text-xs font-medium border-2 ${cfg.background === b.id ? 'border-indigo-500 text-indigo-600' : 'border-gray-200 text-gray-600'}`}>{b.label}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between"><span className="text-sm text-gray-700">24-hour clock</span><input type="checkbox" checked={cfg.clock24} onChange={e => setCfg({ clock24: e.target.checked })} /></label>
            <label className="flex items-center justify-between"><span className="text-sm text-gray-700">Show weather</span><input type="checkbox" checked={cfg.showWeather} onChange={e => setCfg({ showWeather: e.target.checked })} /></label>
            <label className="flex items-center justify-between gap-3"><span className="text-sm text-gray-700">Photo interval (s)</span>
              <input type="number" min={3} max={60} value={cfg.photoInterval} onChange={e => setCfg({ photoInterval: Math.max(3, Number(e.target.value) || 8) })} className="input-field w-20" /></label>
            <label className="flex items-center justify-between gap-3"><span className="text-sm text-gray-700">Screensaver after (min, 0 = off)</span>
              <input type="number" min={0} max={120} value={cfg.idleMinutes} onChange={e => setCfg({ idleMinutes: Math.max(0, Number(e.target.value) || 0) })} className="input-field w-20" /></label>
            <p className="text-xs text-gray-400">Saved to your profile and synced across screens.</p>
          </div>
        </div>
      )}
      {/* Idle screensaver — ambient photos + clock; wakes on any touch. */}
      {idle && (
        <div className="fixed inset-0 z-30 bg-black animate-fadeIn" onPointerDown={() => setIdle(false)}>
          {pics.length > 0 && pics.map((p, i) => (
            <img key={p.id} src={p.url} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]"
              style={{ opacity: i === saverIdx % pics.length ? 1 : 0 }} />
          ))}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute bottom-10 left-10">
            <div className="text-7xl font-extrabold tracking-tight tabular-nums drop-shadow-lg">{clock}</div>
            <div className="text-2xl text-white/80 mt-1 drop-shadow">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
          {pics.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xl">Touch to wake</div>}
        </div>
      )}
      <ToastHost />
    </div>
  );
}

function Slideshow({ photos, interval }: { photos: { id: string; url: string; caption: string }[]; interval: number }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef(photos.length); ref.current = photos.length;
  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % ref.current), (interval || 8) * 1000);
    return () => clearInterval(t);
  }, [photos.length, interval]);
  if (photos.length === 0) return (
    <div className="rounded-3xl bg-white/[0.06] border border-white/10 h-full min-h-[260px] flex flex-col items-center justify-center text-white/50 p-6 text-center">
      <ImageIcon size={32} className="mb-3" /><div className="text-lg">Add family photos</div><div className="text-sm">They'll slideshow here.</div>
    </div>
  );
  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 h-full min-h-[260px] bg-black">
      {photos.map((p, i) => <img key={p.id} src={p.url} alt={p.caption} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" style={{ opacity: i === idx ? 1 : 0 }} />)}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent"><div className="text-white text-lg font-medium">{photos[idx]?.caption}</div></div>
    </div>
  );
}

function Panel({ title, icon: IconCmp, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white/[0.06] border border-white/10 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 text-white/80"><IconCmp size={20} /><h2 className="text-sm uppercase tracking-widest font-semibold">{title}</h2></div>
      {children}
    </div>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => <div className="text-white/50 py-4 text-lg">{children}</div>;
