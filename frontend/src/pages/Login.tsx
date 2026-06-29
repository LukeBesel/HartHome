import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const GRADIENT = 'linear-gradient(135deg, #6366f1, #ec4899)';

export default function Login() {
  const [params] = useSearchParams();
  const { user, login, signup, join, startDemo, adoptToken } = useAuth();
  const navigate = useNavigate();
  const initialMode = params.get('mode');
  const [mode, setMode] = useState<'login' | 'signup' | 'join'>(
    initialMode === 'signup' ? 'signup' : initialMode === 'join' ? 'join' : 'login'
  );
  const [form, setForm] = useState({ householdName: '', displayName: '', email: '', password: '', inviteCode: params.get('code') || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);

  // Detect which sign-in methods the server enables.
  useEffect(() => { api.authConfig().then(c => setGoogleOn(c.google)).catch(() => {}); }, []);

  // Handle the Google OAuth redirect (?token=… or ?error=…).
  useEffect(() => {
    const token = params.get('token');
    if (token) { adoptToken(token).then(() => navigate('/dashboard', { replace: true })).catch(() => setError('Sign-in failed. Please try again.')); return; }
    if (params.get('error')) setError('Google sign-in failed. Please try again.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (user) navigate('/dashboard', { replace: true }); }, [user, navigate]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'signup') await signup(form.householdName, form.displayName, form.email, form.password);
      else if (mode === 'join') await join(form.inviteCode, form.displayName, form.email, form.password);
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

          <div className="flex bg-white/5 rounded-xl p-1 mb-7 text-xs">
            {([['login', 'Sign in'], ['signup', 'New home'], ['join', 'Join home']] as const).map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${mode === m ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
                {label}
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
            {mode === 'join' && (
              <>
                <input className="login-input tracking-widest uppercase" placeholder="Invite code" value={form.inviteCode} onChange={set('inviteCode')} required />
                <input className="login-input" placeholder="Your name" value={form.displayName} onChange={set('displayName')} required />
              </>
            )}
            <input className="login-input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required autoComplete="email" />
            <input className="login-input" type="password" placeholder="Password" value={form.password} onChange={set('password')} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 glow" style={{ background: GRADIENT }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{mode === 'signup' ? 'Create household' : mode === 'join' ? 'Join household' : 'Sign in'} <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="relative my-6 text-center"><span className="px-3 text-xs text-gray-600 bg-[#060911] relative z-10">or</span><div className="absolute inset-x-0 top-1/2 h-px bg-white/10" /></div>
          {googleOn && (
            <button onClick={() => { window.location.href = '/api/auth/google'; }} className="w-full flex items-center justify-center gap-2.5 text-sm font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl hover:bg-gray-100 transition-all mb-2.5">
              <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
              Continue with Google
            </button>
          )}
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
