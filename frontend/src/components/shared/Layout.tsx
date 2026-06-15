import { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Settings, ChevronLeft, ChevronRight, LogOut, ChevronDown,
  Menu, X, Moon, Sun, MonitorPlay, Sparkles, PlayCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SECTIONS, NavItem } from '../../config/navigation';
import { Avatar } from './ui';
import Tour, { startTour } from './Tour';

function useIsDesktop() {
  const [d, setD] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = (e: MediaQueryListEvent) => setD(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return d;
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('hh_sidebar') === 'collapsed');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout, isParent } = useAuth();
  const { dark, toggleDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const eff = collapsed && isDesktop;
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('hh_is_demo') === 'true';

  useEffect(() => { localStorage.setItem('hh_sidebar', collapsed ? 'collapsed' : 'open'); }, [collapsed]);
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  const handleLogout = async () => { await logout(); navigate('/login'); };
  const canShow = (item: NavItem) => !item.parentOnly || isParent;
  const sidebarW = eff ? 'w-16' : (isDesktop ? 'w-60' : 'w-72');

  const renderItem = (item: NavItem) => {
    const { to, icon: IconCmp, label, exact } = item;
    return (
      <NavLink key={to} to={to} end={exact} title={eff ? label : undefined}
        className={({ isActive }) =>
          `flex items-center rounded-xl text-sm font-medium transition-all ${eff ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} ${
            isActive ? 'text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        style={({ isActive }) => isActive ? { backgroundColor: 'var(--nav-active)' } : {}}>
        <IconCmp size={17} className="flex-shrink-0" />
        {!eff && <span className="flex-1">{label}</span>}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {mobileNavOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} />}

      <aside
        className={`${sidebarW} fixed inset-y-0 left-0 z-40 flex-shrink-0 flex flex-col transition-all duration-200 lg:static lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu"
          className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 z-10"><X size={18} /></button>

        <Link to="/dashboard" className={`flex items-center border-b border-white/10 hover:bg-white/5 transition-colors flex-shrink-0 ${eff ? 'justify-center p-3' : 'gap-3 p-4'}`}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}>
            <Home size={18} className="text-white" />
          </div>
          {!eff && (
            <div className="min-w-0 pr-8 lg:pr-0">
              <div className="text-white font-bold text-base leading-tight tracking-tight truncate">{user?.household_name || 'HartHome'}</div>
              <div className="text-indigo-300/70 text-[11px] font-medium truncate">Powered by HartHome</div>
            </div>
          )}
        </Link>

        <nav className="flex-1 p-2.5 overflow-y-auto space-y-4 mt-1">
          {SECTIONS.map(section => {
            const items = section.items.filter(canShow);
            if (!items.length) return null;
            return (
              <div key={section.id}>
                {!eff && <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">{section.label}</div>}
                <div className="space-y-0.5">{items.map(renderItem)}</div>
              </div>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-white/10 flex-shrink-0 space-y-0.5">
          <Link to="/display" title="Display mode"
            className={`flex items-center rounded-xl text-sm font-medium text-indigo-200 hover:text-white hover:bg-white/10 transition-all ${eff ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`}>
            <MonitorPlay size={17} className="flex-shrink-0" />{!eff && <span>Display mode</span>}
          </Link>
          <button onClick={toggleDark} title="Toggle theme"
            className={`flex items-center rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all w-full ${eff ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}{!eff && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <button onClick={() => setCollapsed(c => !c)}
            className={`hidden lg:flex items-center rounded-xl text-sm font-medium text-gray-500 hover:text-white hover:bg-white/10 transition-all w-full ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`}>
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>

          {!eff ? (
            <div className="relative mt-1">
              <button onClick={() => setUserMenuOpen(o => !o)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all">
                <Avatar user={user} size={28} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-medium text-white/90 truncate">{user?.display_name}</div>
                  <div className="text-[10px] text-gray-500 capitalize">{user?.role} · {user?.points ?? 0} pts</div>
                </div>
                <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
              </button>
              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-800 truncate">{user?.display_name}</div>
                    <div className="text-[11px] text-gray-500 truncate">{user?.email || 'Profile account'}</div>
                  </div>
                  <NavLink to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"><Settings size={14} />Settings</NavLink>
                  <button onClick={handleLogout} className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"><LogOut size={14} />Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleLogout} title="Sign out" className="flex items-center justify-center p-2.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-white/10 w-full"><LogOut size={16} /></button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <button onClick={() => setMobileNavOpen(true)} aria-label="Open menu" className="p-2.5 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"><Menu size={20} /></button>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}><Home size={14} className="text-white" /></div>
          <div className="font-bold text-sm text-gray-800 truncate">{user?.household_name || 'HartHome'}</div>
        </header>
        {isDemo && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium text-white flex-shrink-0" style={{ background: 'linear-gradient(90deg, var(--accent), var(--secondary))' }}>
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> You're exploring a demo home — everything here is editable.</span>
            <button onClick={startTour} className="underline underline-offset-2 hover:opacity-80 flex items-center gap-1"><PlayCircle size={13} /> Take the tour</button>
          </div>
        )}
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
      <Tour />
    </div>
  );
}
