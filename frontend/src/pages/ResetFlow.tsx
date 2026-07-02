import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, ArrowRight, Loader2, MailCheck, KeyRound } from 'lucide-react';
import { api } from '../api/client';

const GRADIENT = 'linear-gradient(135deg, #6366f1, #ec4899)';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060911] text-white p-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: GRADIENT }}><Home size={20} className="text-white" /></span>
          <span className="font-semibold text-xl tracking-tight">HartHome</span>
        </Link>
        {children}
        <p className="mt-6 text-center text-xs text-gray-600"><Link to="/login" className="underline hover:text-gray-400">Back to sign in</Link></p>
      </div>
      <style>{`.login-input{width:100%;padding:.7rem .9rem;border-radius:.75rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:.9rem;outline:none;transition:all .15s}.login-input::placeholder{color:#64748b}.login-input:focus{border-color:#6366f1;background:rgba(255,255,255,.08)}`}</style>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await api.forgotPassword(email.trim()); setSent(true); } finally { setBusy(false); }
  };

  return (
    <Shell>
      {sent ? (
        <div className="text-center">
          <MailCheck size={36} className="mx-auto text-emerald-400 mb-4" />
          <h1 className="text-xl font-bold">Check your email</h1>
          <p className="text-sm text-gray-400 mt-2">If an account exists for <span className="text-gray-200">{email}</span>, a reset link is on its way (valid for 1 hour). On self-hosted setups without email, the link appears in the server logs.</p>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold text-center">Forgot your password?</h1>
          <p className="text-sm text-gray-400 text-center mt-2 mb-6">Enter your email and we'll send a reset link.</p>
          <form onSubmit={submit} className="space-y-3.5">
            <input className="login-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <button type="submit" disabled={busy || !email.trim()} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 glow" style={{ background: GRADIENT }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>Send reset link <ArrowRight size={16} /></>}
            </button>
          </form>
        </>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      navigate('/login?reset=1');
    } catch (err: any) {
      setError(err.message || 'That link is invalid or expired.');
    } finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="text-xl font-bold text-center flex items-center justify-center gap-2"><KeyRound size={20} /> Choose a new password</h1>
      <form onSubmit={submit} className="space-y-3.5 mt-6">
        <input className="login-input" type="password" placeholder="New password (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} required autoFocus autoComplete="new-password" />
        <input className="login-input" type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
        {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 glow" style={{ background: GRADIENT }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <>Set new password <ArrowRight size={16} /></>}
        </button>
      </form>
    </Shell>
  );
}

export default ForgotPassword;
