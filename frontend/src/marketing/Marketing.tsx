import { useEffect, useRef, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Home, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GRADIENT = 'linear-gradient(135deg, #6366f1, #ec4899)';
const LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how' },
  { label: 'Pricing', href: '/pricing' },
];

export function MarketingNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060911]/80 backdrop-blur-xl border-b border-white/10' : 'bg-transparent border-b border-transparent'}`}>
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: GRADIENT }}><Home size={18} className="text-white" strokeWidth={2.4} /></span>
          <span className="text-white font-semibold text-lg tracking-tight">HartHome</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {LINKS.map(l => <a key={l.label} href={l.href} className="text-sm text-gray-300 hover:text-white transition-colors">{l.label}</a>)}
        </div>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link to="/dashboard" className="text-sm font-semibold text-white px-4 py-2 rounded-full transition-all hover:opacity-90 glow" style={{ background: GRADIENT }}>Open HartHome</Link>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-300 hover:text-white transition-colors">Sign in</Link>
              <Link to="/login?mode=signup" className="text-sm font-semibold text-white px-4 py-2 rounded-full transition-all hover:opacity-90 glow" style={{ background: GRADIENT }}>Get started free</Link>
            </>
          )}
        </div>
        <button className="md:hidden text-white" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      </nav>
      {menuOpen && (
        <div className="md:hidden bg-[#060911]/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 space-y-3">
          {LINKS.map(l => <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} className="block text-gray-300 hover:text-white py-1">{l.label}</a>)}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <Link to="/login" onClick={() => setMenuOpen(false)} className="text-center text-sm text-gray-200 px-4 py-2.5 rounded-full border border-white/15">Sign in</Link>
            <Link to="/login?mode=signup" onClick={() => setMenuOpen(false)} className="text-center text-sm font-semibold text-white px-4 py-2.5 rounded-full" style={{ background: GRADIENT }}>Get started free</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  const COLUMNS = [
    { title: 'Product', links: [['Features', '/#features'], ['How it works', '/#how'], ['Pricing', '/pricing'], ['Sign in', '/login']] },
    { title: 'Rooms', links: [['Calendar & Chores', '/#features'], ['Rewards & Goals', '/#features'], ['Bills & Budget', '/#features'], ['Car & Home', '/#features']] },
    { title: 'Company', links: [['Contact', 'mailto:hello@harthome.io'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Get started', '/login?mode=signup']] },
  ];
  return (
    <footer className="border-t border-white/10 bg-[#060911]">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: GRADIENT }}><Home size={18} className="text-white" strokeWidth={2.4} /></span>
              <span className="text-white font-semibold text-lg tracking-tight">HartHome</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">The calm command center for your whole home — on every screen.</p>
          </div>
          {COLUMNS.map(col => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/#') || href.startsWith('mailto')
                      ? <a href={href} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{label}</a>
                      : <Link to={href} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">{label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} HartHome. Made for families. Part of the Hart family of products.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-xs text-gray-600 hover:text-gray-400">Privacy</Link>
            <Link to="/terms" className="text-xs text-gray-600 hover:text-gray-400">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); obs.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>{children}</div>;
}
