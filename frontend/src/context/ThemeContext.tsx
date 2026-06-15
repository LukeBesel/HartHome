import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import type { Prefs, ThemePrefs } from '../types';

// ── Preset palettes (accent + matching gradient partner) ──
export const ACCENTS = [
  { id: 'indigo', label: 'Indigo', color: '#6366f1', secondary: '#ec4899' },
  { id: 'rose', label: 'Rose', color: '#ec4899', secondary: '#6366f1' },
  { id: 'teal', label: 'Teal', color: '#14b8a6', secondary: '#6366f1' },
  { id: 'emerald', label: 'Garden', color: '#10b981', secondary: '#14b8a6' },
  { id: 'amber', label: 'Sunset', color: '#f59e0b', secondary: '#ec4899' },
  { id: 'sky', label: 'Sky', color: '#3b82f6', secondary: '#8b5cf6' },
  { id: 'violet', label: 'Plum', color: '#8b5cf6', secondary: '#ec4899' },
  { id: 'crimson', label: 'Crimson', color: '#ef4444', secondary: '#f59e0b' },
  { id: 'slate', label: 'Slate', color: '#64748b', secondary: '#6366f1' },
  { id: 'cyan', label: 'Lagoon', color: '#06b6d4', secondary: '#3b82f6' },
];

export const SIDEBARS = [
  { id: 'midnight', label: 'Midnight', bg: '#0a0e27' },
  { id: 'ink', label: 'Ink', bg: '#0f172a' },
  { id: 'black', label: 'Carbon', bg: '#0b0b0d' },
  { id: 'plum', label: 'Plum', bg: '#1a0b2e' },
  { id: 'forest', label: 'Forest', bg: '#04200f' },
  { id: 'tinted', label: 'Accent tint', bg: '' }, // derived from accent
] as const;

export const DENSITIES = [{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }] as const;
export const FONT_SCALES = [{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Default' }, { id: 'lg', label: 'Large' }] as const;
export const RADII = [{ id: 'sharp', label: 'Sharp' }, { id: 'rounded', label: 'Rounded' }, { id: 'xl', label: 'Soft' }] as const;
export const WALLPAPERS = [{ id: 'plain', label: 'Plain' }, { id: 'aurora', label: 'Aurora' }, { id: 'mesh', label: 'Mesh' }, { id: 'image', label: 'Custom' }] as const;

// Curated one-tap looks (full ThemePrefs minus any custom image).
export const PRESETS: { id: string; label: string; theme: Partial<ThemePrefs> }[] = [
  { id: 'midnight', label: 'Midnight', theme: { accent: '#6366f1', secondary: '#ec4899', sidebar: 'midnight', mode: 'system', wallpaper: 'aurora', radius: 'xl' } },
  { id: 'sunset', label: 'Sunset', theme: { accent: '#f59e0b', secondary: '#ec4899', sidebar: 'plum', mode: 'dark', wallpaper: 'aurora', radius: 'xl' } },
  { id: 'forest', label: 'Forest', theme: { accent: '#10b981', secondary: '#14b8a6', sidebar: 'forest', mode: 'light', wallpaper: 'mesh', radius: 'rounded' } },
  { id: 'ocean', label: 'Ocean', theme: { accent: '#06b6d4', secondary: '#3b82f6', sidebar: 'ink', mode: 'dark', wallpaper: 'mesh', radius: 'xl' } },
  { id: 'berry', label: 'Berry', theme: { accent: '#ec4899', secondary: '#8b5cf6', sidebar: 'tinted', mode: 'light', wallpaper: 'aurora', radius: 'rounded' } },
  { id: 'mono', label: 'Mono', theme: { accent: '#64748b', secondary: '#6366f1', sidebar: 'black', mode: 'dark', wallpaper: 'plain', radius: 'sharp' } },
];

export const DEFAULT_THEME: ThemePrefs = {
  mode: 'system', accent: '#6366f1', secondary: '#ec4899',
  sidebar: 'midnight', density: 'comfortable', fontScale: 'md', radius: 'xl', wallpaper: 'plain',
};

// ── Color helpers ──
const hexToRgb = (h: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 99, g: 102, b: 241 };
};
const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const rgb = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;
const darken = (h: string, amt: number) => { const { r, g, b } = hexToRgb(h); return rgb(r * (1 - amt), g * (1 - amt), b * (1 - amt)); };
const mix = (h1: string, h2: string, t: number) => {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return rgb(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
};

const sidebarBg = (t: ThemePrefs) => {
  if (t.sidebar === 'tinted') return mix(t.accent, '#05070f', 0.86);
  return (SIDEBARS.find(s => s.id === t.sidebar)?.bg) || '#0a0e27';
};

function applyTheme(t: ThemePrefs) {
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-dark', darken(t.accent, 0.14));
  root.style.setProperty('--accent-light', mix(t.accent, '#ffffff', 0.9));
  root.style.setProperty('--secondary', t.secondary);
  root.style.setProperty('--nav-active', darken(t.accent, 0.08));
  root.style.setProperty('--sidebar-bg', sidebarBg(t));
  root.removeAttribute('data-accent'); // we drive vars directly now

  // Effective dark mode.
  const dark = t.mode === 'dark' || (t.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);

  // Density, radius, wallpaper via attributes (CSS in index.css reacts).
  root.setAttribute('data-density', t.density);
  root.setAttribute('data-radius', t.radius);
  root.setAttribute('data-wallpaper', t.wallpaper);
  // Custom wallpaper image is applied as a CSS variable used by index.css.
  root.style.setProperty('--wallpaper-image', t.wallpaper === 'image' && t.wallpaperImage ? `url("${t.wallpaperImage}")` : 'none');

  // Global UI scale.
  root.style.fontSize = t.fontScale === 'sm' ? '14px' : t.fontScale === 'lg' ? '18px' : '16px';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', sidebarBg(t));
}

interface ThemeContextValue {
  prefs: Prefs;
  theme: ThemePrefs;
  dark: boolean;
  setTheme: (patch: Partial<ThemePrefs>) => void;
  toggleDark: () => void;
  resetTheme: () => void;
  // back-compat helpers used elsewhere
  accent: string;
  setAccent: (idOrHex: string) => void;
  // generic prefs (dashboard layout, display config, nav)
  setPrefs: (patch: Partial<Prefs>) => void;
}

const ThemeContext = createContext<ThemeContextValue>(null!);

const readLocal = (): Prefs => {
  try { return JSON.parse(localStorage.getItem('hh_prefs') || '{}'); } catch { return {}; }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefsState] = useState<Prefs>(() => readLocal());
  const theme: ThemePrefs = { ...DEFAULT_THEME, ...(prefs.theme || {}) };
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);

  // Apply theme on every change (and on first paint).
  useEffect(() => { applyTheme(theme); /* eslint-disable-next-line */ }, [JSON.stringify(prefs.theme)]);

  // React to OS theme changes while in "system" mode.
  useEffect(() => {
    if (theme.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => applyTheme(theme);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme.mode, JSON.stringify(prefs.theme)]);

  // Pull server-synced prefs once a session exists (merging over local). Re-runs
  // when a user signs in so their saved customization follows them.
  useEffect(() => {
    if (!user) { loadedRef.current = false; return; }
    if (loadedRef.current) return;
    loadedRef.current = true;
    api.getPrefs().then((server) => {
      if (server && Object.keys(server).length) {
        const local = readLocal();
        const merged = { ...local, ...server, theme: { ...(local.theme || {}), ...(server.theme || {}) } };
        localStorage.setItem('hh_prefs', JSON.stringify(merged));
        setPrefsState(merged);
      }
    }).catch(() => {});
  }, [user]);

  const persist = (next: Prefs) => {
    setPrefsState(next);
    localStorage.setItem('hh_prefs', JSON.stringify(next));
    clearTimeout(saveTimer.current);
    if (localStorage.getItem('hh_token')) {
      saveTimer.current = setTimeout(() => { api.savePrefs(next).catch(() => {}); }, 600);
    }
  };

  const setPrefs = (patch: Partial<Prefs>) => persist({ ...prefs, ...patch });
  const setTheme = (patch: Partial<ThemePrefs>) => persist({ ...prefs, theme: { ...theme, ...patch } });
  const resetTheme = () => persist({ ...prefs, theme: { ...DEFAULT_THEME } });

  const toggleDark = () => setTheme({ mode: theme.mode === 'dark' ? 'light' : 'dark' });
  const setAccent = (idOrHex: string) => {
    const preset = ACCENTS.find(a => a.id === idOrHex);
    if (preset) setTheme({ accent: preset.color, secondary: preset.secondary });
    else setTheme({ accent: idOrHex });
  };

  const dark = theme.mode === 'dark' || (theme.mode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <ThemeContext.Provider value={{ prefs, theme, dark, setTheme, toggleDark, resetTheme, accent: theme.accent, setAccent, setPrefs }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
