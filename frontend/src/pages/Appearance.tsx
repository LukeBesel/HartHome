import { useRef, useState } from 'react';
import { Palette, Sun, Moon, Monitor, RotateCcw, Check, Home, CalendarDays, Gift, Save, Trash2, Upload, Sparkles } from 'lucide-react';
import { useTheme, ACCENTS, SIDEBARS, DENSITIES, FONT_SCALES, RADII, WALLPAPERS, PRESETS } from '../context/ThemeContext';
import { PageHeader, Segmented } from '../components/shared/ui';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import { useAuth } from '../context/AuthContext';
import { fileToDataURL } from '../utils/image';
import type { ThemePrefs } from '../types';

const sidebarSwatch = (id: string, accent: string) => {
  if (id === 'tinted') return accent;
  return (SIDEBARS.find(s => s.id === id)?.bg) || '#0a0e27';
};

export default function Appearance() {
  const { theme, setTheme, resetTheme } = useTheme();
  const { user } = useAuth();
  const { data: saved, refresh } = useAsync(() => api.themes(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const saveCurrent = async () => {
    const name = window.prompt('Name this theme (shared with your household):');
    if (!name?.trim()) return;
    await api.saveTheme({ name: name.trim(), theme, created_by: user?.id }).catch(() => {});
    refresh();
  };
  const applySaved = (raw: string) => { try { setTheme(JSON.parse(raw) as Partial<ThemePrefs>); } catch { /* ignore */ } };
  const onWallpaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    try { const data = await fileToDataURL(f); setTheme({ wallpaper: 'image', wallpaperImage: data }); }
    catch { /* ignore */ }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Appearance" subtitle="Make HartHome yours — colors, theme, density, and more"
        icon={Palette}
        actions={<button className="btn-secondary" onClick={resetTheme}><RotateCcw size={15} /> Reset</button>}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Mode */}
          <Card title="Theme">
            <div className="grid grid-cols-3 gap-3">
              {([['system', 'Auto', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([id, label, Ic]) => (
                <button key={id} onClick={() => setTheme({ mode: id })}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${theme.mode === id ? 'border-transparent text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  style={theme.mode === id ? { background: 'linear-gradient(135deg, var(--accent), var(--secondary))' } : {}}>
                  <Ic size={20} /><span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Quick looks (built-in presets) */}
          <Card title="Quick looks" hint="One-tap starting points — tweak anything after.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => setTheme(p.theme)}
                  className="rounded-xl border-2 border-gray-200 hover:border-gray-300 p-3 text-left transition-all">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-6 h-6 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.theme.accent}, ${p.theme.secondary})` }} />
                    <span className="w-4 h-6 rounded" style={{ background: p.theme.sidebar === 'tinted' ? p.theme.accent : (SIDEBARS.find(s => s.id === p.theme.sidebar)?.bg || '#0a0e27') }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{p.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Saved household themes */}
          <Card title="Your saved themes" hint="Save the current look and share it with your household.">
            <div className="flex flex-wrap gap-2 mb-3">
              <button className="btn-secondary" onClick={saveCurrent}><Save size={15} /> Save current</button>
            </div>
            {!saved || saved.length === 0 ? (
              <p className="text-sm text-gray-400">No saved themes yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {saved.map(s => {
                  let t: Partial<ThemePrefs> = {};
                  try { t = JSON.parse(s.theme); } catch { /* ignore */ }
                  return (
                    <div key={s.id} className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl border border-gray-200">
                      <button onClick={() => applySaved(s.theme)} className="flex items-center gap-2" title="Apply theme">
                        <span className="w-6 h-6 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.accent || '#6366f1'}, ${t.secondary || '#ec4899'})` }} />
                        <span className="text-sm font-medium text-gray-700">{s.name}</span>
                      </button>
                      <button onClick={() => { api.deleteTheme(s.id).then(refresh); }} className="text-gray-300 hover:text-red-500" aria-label="Delete theme"><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Accent */}
          <Card title="Accent color" hint="Pick a preset or choose any color you like.">
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map(a => {
                const active = theme.accent.toLowerCase() === a.color.toLowerCase();
                return (
                  <button key={a.id} title={a.label} onClick={() => setTheme({ accent: a.color, secondary: a.secondary })}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${active ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                    style={{ background: `linear-gradient(135deg, ${a.color}, ${a.secondary})` }}>
                    {active && <Check size={16} className="text-white" />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-5">
              <ColorField label="Custom accent" value={theme.accent} onChange={(v) => setTheme({ accent: v })} />
              <ColorField label="Gradient partner" value={theme.secondary} onChange={(v) => setTheme({ secondary: v })} />
            </div>
          </Card>

          {/* Sidebar */}
          <Card title="Sidebar style">
            <div className="flex flex-wrap gap-2.5">
              {SIDEBARS.map(s => {
                const active = theme.sidebar === s.id;
                return (
                  <button key={s.id} onClick={() => setTheme({ sidebar: s.id })}
                    className={`flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl border-2 transition-all ${active ? 'border-gray-400' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="w-6 h-6 rounded-md border border-black/10" style={{ background: sidebarSwatch(s.id, theme.accent) }} />
                    <span className="text-sm font-medium text-gray-700">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Wallpaper */}
          <Card title="Background">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onWallpaperFile} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {WALLPAPERS.map(w => {
                const isImage = w.id === 'image';
                const bg = w.id === 'plain' ? 'var(--accent-light)'
                  : w.id === 'aurora' ? `radial-gradient(circle at 20% 0%, ${theme.accent}40, transparent 60%), radial-gradient(circle at 90% 30%, ${theme.secondary}40, transparent 55%)`
                  : w.id === 'mesh' ? `radial-gradient(circle at 20% 10%, ${theme.accent}40, transparent 50%), radial-gradient(circle at 80% 30%, ${theme.secondary}40, transparent 50%), radial-gradient(circle at 50% 100%, ${theme.accent}33, transparent 50%)`
                  : undefined;
                return (
                  <button key={w.id}
                    onClick={() => isImage ? (theme.wallpaperImage ? setTheme({ wallpaper: 'image' }) : fileRef.current?.click()) : setTheme({ wallpaper: w.id })}
                    className={`h-20 rounded-xl border-2 relative overflow-hidden transition-all ${theme.wallpaper === w.id ? 'border-gray-400' : 'border-gray-200 hover:border-gray-300'}`}>
                    {isImage && theme.wallpaperImage
                      ? <img src={theme.wallpaperImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      : <span className="absolute inset-0 flex items-center justify-center text-gray-400" style={{ background: bg }}>{isImage && <Upload size={18} />}</span>}
                    <span className="absolute bottom-1.5 left-2 text-xs font-medium text-gray-700 bg-white/70 dark:bg-black/40 px-1 rounded">{busy && isImage ? 'Uploading…' : w.label}</span>
                  </button>
                );
              })}
            </div>
            {theme.wallpaper === 'image' && <button className="btn-ghost text-xs mt-2" onClick={() => fileRef.current?.click()}><Upload size={13} /> Change image</button>}
          </Card>

          {/* Layout knobs */}
          <Card title="Layout & text">
            <Row label="Density"><Segmented options={DENSITIES.map(d => ({ value: d.id, label: d.label }))} value={theme.density} onChange={(v) => setTheme({ density: v as any })} /></Row>
            <Row label="Corners"><Segmented options={RADII.map(r => ({ value: r.id, label: r.label }))} value={theme.radius} onChange={(v) => setTheme({ radius: v as any })} /></Row>
            <Row label="Text size"><Segmented options={FONT_SCALES.map(f => ({ value: f.id, label: f.label }))} value={theme.fontScale} onChange={(v) => setTheme({ fontScale: v as any })} /></Row>
          </Card>
        </div>

        {/* Live preview */}
        <div className="space-y-4">
          <div className="sticky top-4">
            <div className="section-label">Live preview</div>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm flex h-[22rem]">
              <div className="w-20 flex flex-col items-center py-3 gap-3" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}><Home size={16} className="text-white" /></div>
                <div className="w-10 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--nav-active)' }}><CalendarDays size={15} /></div>
                <div className="w-10 h-8 rounded-lg flex items-center justify-center text-gray-400"><Gift size={15} /></div>
              </div>
              <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 overflow-hidden" data-wallpaper={theme.wallpaper}>
                <div className="text-sm font-bold text-gray-900 mb-2">Good morning 👋</div>
                <div className="card p-3 mb-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase">Today</div>
                  <div className="text-lg font-bold text-gray-900">3 events</div>
                  <div className="h-1.5 rounded-full mt-2" style={{ background: 'linear-gradient(90deg, var(--accent), var(--secondary))' }} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="btn-primary text-xs">Primary</span>
                  <span className="badge-green">Done</span>
                  <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>Accent</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Changes apply instantly and sync to your other devices.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-bold text-gray-900">{title}</h2>
      {hint && <p className="text-sm text-gray-500 mb-4 mt-0.5">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 flex-wrap">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200 bg-transparent cursor-pointer p-0.5" />
      <span>
        <span className="block text-xs font-semibold text-gray-600">{label}</span>
        <input value={value} onChange={(e) => { const v = e.target.value; if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) onChange(v.startsWith('#') ? v : `#${v}`); }}
          className="text-xs font-mono text-gray-500 bg-transparent w-20 focus:outline-none" />
      </span>
    </label>
  );
}
