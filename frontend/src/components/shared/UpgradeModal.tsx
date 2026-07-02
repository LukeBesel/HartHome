import { useState } from 'react';
import { Sparkles, Check, HeartPulse, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { toast } from './Toast';
import { Modal } from './ui';

// The Hart+ upgrade prompt. Billing runs in demo mode until Stripe keys are
// configured server-side — upgrades apply instantly and say so.
const FEATURES = [
  'Open HartCare signed-in with one tap (family SSO)',
  'Live HartCare wellness on your HartHome dashboard',
  'Two-way family & calendar bridge with HartCare',
  'Priority support',
];

export default function UpgradeModal({ onClose, onUpgraded }: { onClose: () => void; onUpgraded?: () => void }) {
  const { isParent, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  const upgrade = async () => {
    setBusy(true);
    try {
      await api.upgradePlan();
      await refresh();
      toast('Welcome to Hart+ 🎉');
      onUpgraded?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Could not upgrade.');
    } finally { setBusy(false); }
  };

  return (
    <Modal open title="Upgrade to Hart+" onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Not now</button>
        {isParent
          ? <button className="btn-primary" onClick={upgrade} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Upgrade — $4.99/mo</button>
          : <span className="text-sm text-gray-500 py-2">Ask a parent to upgrade</span>}
      </>}>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f43f5e, #f59e0b)' }}>
          <HeartPulse size={22} />
        </span>
        <p className="text-sm text-gray-600">Hart+ connects your household to <strong>HartCare</strong>, the family health &amp; wellness app — one family, one sign-in, everything in sync.</p>
      </div>
      <ul className="space-y-2.5">
        {FEATURES.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {f}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-400">Billing is in demo mode on this server — the upgrade applies instantly, no card required. Connect Stripe to charge for real.</p>
    </Modal>
  );
}
