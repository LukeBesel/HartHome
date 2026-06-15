import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, CalendarDays, CheckSquare, Megaphone, UtensilsCrossed, Image as ImageIcon } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useCollection';
import { useLiveRefresh } from '../api/live';
import { Avatar, Spinner } from '../components/shared/ui';
import { fmtTime, dueLabel, memberById, todayISO } from '../utils/format';

// ── Weather (open-meteo, no API key) ──
const WEATHER: Record<number, { t: string; e: string }> = {
  0: { t: 'Clear', e: '☀️' }, 1: { t: 'Mostly clear', e: '🌤️' }, 2: { t: 'Partly cloudy', e: '⛅' },
  3: { t: 'Overcast', e: '☁️' }, 45: { t: 'Foggy', e: '🌫️' }, 48: { t: 'Foggy', e: '🌫️' },
  51: { t: 'Drizzle', e: '🌦️' }, 53: { t: 'Drizzle', e: '🌦️' }, 55: { t: 'Drizzle', e: '🌦️' },
  61: { t: 'Rain', e: '🌧️' }, 63: { t: 'Rain', e: '🌧️' }, 65: { t: 'Heavy rain', e: '🌧️' },
  71: { t: 'Snow', e: '🌨️' }, 73: { t: 'Snow', e: '🌨️' }, 75: { t: 'Heavy snow', e: '❄️' },
  80: { t: 'Showers', e: '🌦️' }, 81: { t: 'Showers', e: '🌧️' }, 82: { t: 'Showers', e: '⛈️' },
  95: { t: 'Thunderstorm', e: '⛈️' }, 96: { t: 'Thunderstorm', e: '⛈️' }, 99: { t: 'Thunderstorm', e: '⛈️' },
};

function useWeather() {
  const [w, setW] = useState<{ temp: number; code: number } | null>(null);
  useEffect(() => {
    const fetchAt = (lat: number, lon: number) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
        .then(r => r.json())
        .then(d => { if (d?.current) setW({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }); })
        .catch(() => {});
    };
    // Try the screen's location; fall back to a default city so it always shows.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchAt(pos.coords.latitude, pos.coords.longitude),
        () => fetchAt(40.7128, -74.006), // NYC fallback
        { timeout: 5000 }
      );
    } else fetchAt(40.7128, -74.006);
  }, []);
  return w;
}

// A calm, glanceable full-screen board for a kitchen wall tablet or TV.
export default function Display() {
  const { user } = useAuth();
  const { data, refresh } = useAsync(() => api.dashboard(), []);
  const { data: meals } = useAsync(() => api.meals({ date: todayISO() }), []);
  const { data: photos } = useAsync(() => api.photos(), []);
  const [now, setNow] = useState(new Date());
  const weather = useWeather();
  useLiveRefresh(refresh);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000 * 30);
    const poll = setInterval(() => refresh().catch(() => {}), 1000 * 120); // safety net alongside live SSE
    return () => { clearInterval(clock); clearInterval(poll); };
  }, [refresh]);

  if (!data) return <div className="min-h-screen bg-slate-950"><Spinner /></div>;
  const m = data.members;
  const dinner = (meals || []).find(x => x.meal_type === 'dinner');

  return (
    <div className="min-h-screen text-white p-6 sm:p-10" style={{ background: 'radial-gradient(1200px 600px at 20% -10%, #1e1b4b 0%, #0a0e27 55%, #060911 100%)' }}>
      <Link to="/dashboard" className="fixed top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10" title="Exit display mode"><X size={20} /></Link>

      {/* Header: clock + weather + family */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <div className="text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
          <div className="text-xl text-indigo-200/80 mt-1">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="flex items-center gap-6">
          {weather && (
            <div className="flex items-center gap-3 text-right">
              <span className="text-5xl">{WEATHER[weather.code]?.e ?? '🌡️'}</span>
              <div><div className="text-4xl font-bold">{weather.temp}°</div><div className="text-sm text-indigo-200/70">{WEATHER[weather.code]?.t ?? ''}</div></div>
            </div>
          )}
          <div className="flex -space-x-3">{m.map(mem => <Avatar key={mem.id} user={mem} size={48} ring />)}</div>
        </div>
      </div>

      <div className="text-2xl font-semibold mb-6 text-indigo-100">{user?.household_name}</div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Photo slideshow */}
        <div className="lg:col-span-1 lg:row-span-2">
          <Slideshow photos={(photos || []).map(p => ({ url: p.url, caption: p.caption }))} />
        </div>

        {/* Today */}
        <Panel title="Today" icon={CalendarDays}>
          {data.todayEvents.length === 0 ? <Empty>Nothing scheduled</Empty> : data.todayEvents.map(e => (
            <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <span className="w-1.5 h-10 rounded-full" style={{ background: e.color }} />
              <div className="flex-1 min-w-0"><div className="text-lg font-medium truncate">{e.title}</div><div className="text-sm text-indigo-200/60">{e.all_day ? 'All day' : fmtTime(e.start_at)}</div></div>
              {e.member_id && <Avatar user={memberById(m, e.member_id)} size={34} />}
            </div>
          ))}
          {dinner && <div className="mt-4 flex items-center gap-2 text-indigo-200/80"><UtensilsCrossed size={18} /><span className="text-base">Dinner: <span className="font-semibold text-white">{dinner.title}</span></span></div>}
        </Panel>

        {/* Chores */}
        <Panel title="Chores" icon={CheckSquare}>
          {data.choresDue.length === 0 ? <Empty>All done! ✨</Empty> : data.choresDue.slice(0, 7).map(c => (
            <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <span className="w-5 h-5 rounded-md border-2 border-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0"><div className="text-lg truncate">{c.title}</div>{c.due_date && <div className="text-sm text-indigo-200/60">{dueLabel(c.due_date)}</div>}</div>
              {c.assignee_id && <Avatar user={memberById(m, c.assignee_id)} size={30} />}
              <span className="text-emerald-300 font-semibold">+{c.points}</span>
            </div>
          ))}
        </Panel>

        {/* Bulletin */}
        <Panel title="Bulletin" icon={Megaphone}>
          {data.announcements.length === 0 ? <Empty>No messages</Empty> : data.announcements.slice(0, 4).map(a => (
            <div key={a.id} className="py-2 border-b border-white/5 last:border-0">
              <div className="text-base">{a.body}</div><div className="text-xs text-indigo-200/50">— {a.author_name}</div>
            </div>
          ))}
        </Panel>

        {/* Points race */}
        <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(236,72,153,.25))', border: '1px solid rgba(255,255,255,.1)' }}>
          <div className="text-sm uppercase tracking-widest text-indigo-200/70 mb-3">Points race</div>
          {[...m].sort((a, b) => b.points - a.points).map((mem, i) => (
            <div key={mem.id} className="flex items-center gap-3 py-1.5">
              <span className="text-sm font-bold text-white/50 w-4">{i + 1}</span>
              <Avatar user={mem} size={30} /><span className="flex-1 text-base truncate">{mem.display_name}</span>
              <span className="text-xl font-bold">{mem.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slideshow({ photos }: { photos: { url: string; caption: string }[] }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef(photos.length);
  ref.current = photos.length;
  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % ref.current), 8000);
    return () => clearInterval(t);
  }, [photos.length]);

  if (photos.length === 0) {
    return (
      <div className="rounded-3xl bg-white/[0.04] border border-white/10 h-full min-h-[260px] flex flex-col items-center justify-center text-indigo-200/50 p-6 text-center">
        <ImageIcon size={32} className="mb-3" />
        <div className="text-lg">Add family photos</div>
        <div className="text-sm">They'll slideshow here on every screen.</div>
      </div>
    );
  }
  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 h-full min-h-[260px] bg-black">
      {photos.map((p, i) => (
        <img key={i} src={p.url} alt={p.caption} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" style={{ opacity: i === idx ? 1 : 0 }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <div className="text-white text-lg font-medium">{photos[idx]?.caption}</div>
      </div>
    </div>
  );
}

function Panel({ title, icon: IconCmp, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 text-indigo-200/80"><IconCmp size={20} /><h2 className="text-sm uppercase tracking-widest font-semibold">{title}</h2></div>
      {children}
    </div>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) => <div className="text-indigo-200/50 py-4 text-lg">{children}</div>;
