import { Palette, Sun, Moon, Monitor, RotateCcw, Check, Home, CalendarDays, Gift } from 'lucide-react';
import { useTheme, ACCENTS, SIDEBARS, DENSITIES, FONT_SCALES, RADII, WALLPAPERS } from '../context/ThemeContext';
import { PageHeader, Segmented } from '../components/shared/ui';

const sidebarSwatch = (id: string, accent: string) => {
  if (id === 'tinted') return accent;
  return (SIDEBARS.find(s => s.id === id)?.bg) || '#0a0e27';
};

export default function Appearance() {
  const { theme, setTheme, resetTheme } = useTheme();

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
            <div className="grid grid-cols-3 gap-3">
              {WALLPAPERS.map(w => (
                <button key={w.id} onClick={() => setTheme({ wallpaper: w.id })}
                  className={`h-20 rounded-xl border-2 relative overflow-hidden transition-all ${theme.wallpaper === w.id ? 'border-gray-400' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="absolute inset-0" style={{
                    background: w.id === 'plain' ? 'var(--accent-light)' :
                      w.id === 'aurora' ? `radial-gradient(circle at 20% 0%, ${theme.accent}40, transparent 60%), radial-gradient(circle at 90% 30%, ${theme.secondary}40, transparent 55%)` :
                      `radial-gradient(circle at 20% 10%, ${theme.accent}40, transparent 50%), radial-gradient(circle at 80% 30%, ${theme.secondary}40, transparent 50%), radial-gradient(circle at 50% 100%, ${theme.accent}33, transparent 50%)`,
                  }} />
                  <span className="absolute bottom-1.5 left-2 text-xs font-medium text-gray-700">{w.label}</span>
                </button>
              ))}
            </div>
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
