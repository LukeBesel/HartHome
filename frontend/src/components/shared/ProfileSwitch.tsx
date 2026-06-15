import { useEffect, useState } from 'react';
import { Lock, Delete, ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Spinner } from './ui';
import type { User } from '../../types';

type Profile = User & { has_pin: boolean };

// A shared-screen profile switcher: tap an avatar to become that family member.
// PIN-protected profiles (typically parents) prompt for a numeric PIN — so a
// kid can't jump into a parent's account on the kitchen tablet.
export default function ProfileSwitch({ onClose }: { onClose: () => void }) {
  const { user, switchProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.profiles().then(setProfiles).catch(() => setProfiles([])); }, []);

  const choose = async (p: Profile) => {
    if (p.id === user?.id) { onClose(); return; }
    if (p.has_pin) { setSelected(p); setPin(''); setError(''); return; }
    await doSwitch(p);
  };

  const doSwitch = async (p: Profile, code?: string) => {
    setBusy(true); setError('');
    try {
      await switchProfile(p.id, code);
      window.location.assign('/dashboard'); // full reset so every view reflects the new profile
    } catch (e: any) {
      setError(e?.data?.code === 'BAD_PIN' ? 'Incorrect PIN' : (e.message || 'Could not switch'));
      setPin(''); setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 8);
    setPin(next);
    if (selected && selected.has_pin && next.length >= 4 && d !== '') { /* wait for explicit submit */ }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'radial-gradient(1000px 500px at 50% -10%, #1e1b4b 0%, #0a0e27 60%, #060911 100%)' }}>
      <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white flex items-center gap-1.5 text-sm"><ArrowLeft size={18} /> Back</button>

      {!selected ? (
        <div className="w-full max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Who's using HartHome?</h2>
          <p className="text-indigo-200/70 mb-10">Tap your profile to continue.</p>
          {!profiles ? <Spinner /> : (
            <div className="flex flex-wrap items-start justify-center gap-6">
              {profiles.map(p => (
                <button key={p.id} onClick={() => choose(p)} className="group flex flex-col items-center gap-3 w-28">
                  <div className="relative transition-transform group-hover:scale-105">
                    <Avatar user={p} size={88} ring />
                    {p.has_pin && <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center"><Lock size={13} className="text-indigo-300" /></span>}
                  </div>
                  <span className="text-white font-medium truncate max-w-full">{p.display_name}{p.id === user?.id ? ' (you)' : ''}</span>
                  <span className="text-[11px] text-indigo-200/50 capitalize -mt-2">{p.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-xs text-center">
          <Avatar user={selected} size={80} ring />
          <h2 className="text-xl font-bold text-white mt-4">Hi {selected.display_name.split(' ')[0]}</h2>
          <p className="text-indigo-200/70 text-sm mb-5">Enter your PIN</p>
          <div className="flex justify-center gap-2.5 mb-6">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? 'bg-white' : 'bg-white/20'}`} />
            ))}
          </div>
          {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <button key={d} onClick={() => press(d)} className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-2xl font-semibold transition-colors">{d}</button>
            ))}
            <button onClick={() => setPin('')} className="h-16 rounded-2xl text-indigo-200/70 hover:text-white text-sm">Clear</button>
            <button onClick={() => press('0')} className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-2xl font-semibold transition-colors">0</button>
            <button onClick={() => setPin(p => p.slice(0, -1))} className="h-16 rounded-2xl text-indigo-200/70 hover:text-white flex items-center justify-center"><Delete size={22} /></button>
          </div>
          <button disabled={busy || pin.length < 4} onClick={() => doSwitch(selected, pin)} className="btn-primary w-full mt-6 justify-center disabled:opacity-40">Continue</button>
        </div>
      )}
    </div>
  );
}
