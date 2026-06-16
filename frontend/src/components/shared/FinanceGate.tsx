import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Gates the money sections (Bills, Budget) behind the household's financial
// passcode. Parents who know the code can get in; kids can't. A successful
// unlock is remembered for the browser session only.
const SESSION_KEY = 'hh_finance_ok';

export default function FinanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const locked = !!user?.household?.finance_locked;
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!locked || unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.unlockFinance(pin);
      sessionStorage.setItem(SESSION_KEY, '1');
      setUnlocked(true);
    } catch (err: any) {
      setError(err?.data?.code === 'BAD_FINANCE_PIN' ? 'Incorrect passcode' : (err.message || 'Could not unlock'));
      setPin('');
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto">
      <div className="card p-7 mt-10 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mx-auto mb-4" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}>
          <Lock size={24} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Family finances are locked</h1>
        <p className="text-sm text-gray-500 mt-1.5">Enter the household passcode to view bills &amp; budget.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input autoFocus inputMode="numeric" type="password" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder="••••" className="input-field text-center tracking-[0.4em] text-lg" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy || pin.length < 4} className="btn-primary w-full justify-center disabled:opacity-40">
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Unlock'}
          </button>
        </form>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mt-5"><ArrowLeft size={14} /> Back home</Link>
      </div>
    </div>
  );
}
