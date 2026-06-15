import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GRADIENT = 'linear-gradient(135deg, #6366f1, #ec4899)';

export default function Login() {
  const [params] = useSearchParams();
  const { user, login, signup, startDemo } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [form, setForm] = useState({ householdName: '', displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate('/dashboard', { replace: true }); }, [user, navigate]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'signup') await signup(form.householdName, form.displayName, form.email, form.password);
      else await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally { setBusy(false); }
  };

  const demoLogin = async () => {
    setBusy(true); setError('');
    try { await startDemo(); navigate('/dashboard'); }
    catch (err: any) { setError(err.message || 'Demo unavailable. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#060911] text-white">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-[30rem] h-[30rem] aurora-orb animate-aurora" style={{ background: '#6366f1' }} />
        <div className="absolute bottom-0 right-0 w-[26rem] h-[26rem] aurora-orb animate-aurora" style={{ background: '#ec4899', animationDelay: '4s' }} />
        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: GRADIENT }}><Home size={20} className="text-white" /></span>
          <span className="font-semibold text-xl tracking-tight">HartHome</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">Welcome <span className="text-gradient">home</span>.</h2>
          <p className="mt-4 text-gray-400 leading-relaxed">Your family's calendar, chores, rewards, groceries, bills, budget, and home maintenance — together on every screen.</p>
        </div>
        <p className="relative text-xs text-gray-600">© {new Date().getFullYear()} HartHome · Part of the Hart family of products</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: GRADIENT }}><Home size={20} className="text-white" /></span>
            <span className="font-semibold text-xl tracking-tight">HartHome</span>
          </Link>

          <div className="flex bg-white/5 rounded-xl p-1 mb-7 text-sm">
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${mode === m ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
                {m === 'login' ? 'Sign in' : 'Create household'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <input className="login-input" placeholder="Household name (e.g. The Hart Family)" value={form.householdName} onChange={set('householdName')} required />
                <input className="login-input" placeholder="Your name" value={form.displayName} onChange={set('displayName')} required />
              </>
            )}
            <input className="login-input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required autoComplete="email" />
            <input className="login-input" type="password" placeholder="Password" value={form.password} onChange={set('password')} required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />

            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 glow" style={{ background: GRADIENT }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{mode === 'signup' ? 'Create household' : 'Sign in'} <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="relative my-6 text-center"><span className="px-3 text-xs text-gray-600 bg-[#060911] relative z-10">or</span><div className="absolute inset-x-0 top-1/2 h-px bg-white/10" /></div>
          <button onClick={demoLogin} disabled={busy} className="w-full text-sm font-medium text-gray-200 px-4 py-3 rounded-xl border border-white/15 hover:bg-white/5 transition-all disabled:opacity-50">
            Explore the demo home
          </button>
          <p className="mt-6 text-center text-xs text-gray-600">By continuing you agree to our <Link to="/terms" className="underline hover:text-gray-400">Terms</Link> &amp; <Link to="/privacy" className="underline hover:text-gray-400">Privacy</Link>.</p>
        </div>
      </div>

      <style>{`.login-input{width:100%;padding:.7rem .9rem;border-radius:.75rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.9rem;outline:none;transition:all .15s}.login-input::placeholder{color:#64748b}.login-input:focus{border-color:#6366f1;background:rgba(255,255,255,.08)}`}</style>
    </div>
  );
}
