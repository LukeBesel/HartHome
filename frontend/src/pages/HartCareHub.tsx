import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, ExternalLink, Footprints, Moon, Activity, Settings as SettingsIcon, ArrowLeftRight, Check, Sparkles, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, EmptyState } from '../components/shared/ui';
import { openHartCare, fetchHartCareSummary, HartCareSummary } from '../api/hartcare';
import UpgradeModal from '../components/shared/UpgradeModal';

export default function HartCareHub() {
  const { user, isParent } = useAuth();
  const url = user?.household?.hartcare_url;
  const isPlus = user?.household?.plan === 'plus';
  const [summary, setSummary] = useState<HartCareSummary | null>(null);
  const [loading, setLoading] = useState(!!url && isPlus);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!url || !isPlus) return; // live wellness is a Hart+ feature
    setLoading(true);
    fetchHartCareSummary(url).then(setSummary).catch(() => {}).finally(() => setLoading(false));
  }, [url, isPlus]);

  // ── Free plan: a teaser hub — see what Hart+ unlocks, try HartCare as a guest.
  if (!isPlus) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader title="HartCare" subtitle="Your family's health & wellness app" icon={HeartPulse}
          actions={<button className="btn-primary" onClick={() => setUpgradeOpen(true)}><Sparkles size={16} /> Upgrade to Hart+</button>} />

        <section className="card p-6 sm:p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(245,158,11,0.06))' }}>
          <span className="w-14 h-14 rounded-2xl inline-flex items-center justify-center text-white mb-4" style={{ background: 'linear-gradient(135deg, #f43f5e, #f59e0b)' }}><HeartPulse size={26} /></span>
          <h2 className="text-xl font-bold text-gray-900">One family. One sign-in. Health & home together.</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">HartCare tracks your family's fitness, nutrition, sleep, and health records. With <strong>Hart+</strong>, it connects to this household — same members, same calendar, wellness right on your dashboard.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <button className="btn-primary" onClick={() => setUpgradeOpen(true)}><Sparkles size={15} /> Upgrade — $4.99/mo</button>
            {url && <button className="btn-secondary" onClick={() => openHartCare(url)}><ExternalLink size={15} /> Try HartCare free (guest)</button>}
            {!url && isParent && <Link to="/settings" className="btn-secondary"><SettingsIcon size={15} /> Connect HartCare first</Link>}
          </div>
        </section>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { free: true, title: 'Browse HartCare as a guest', body: 'Open HartCare any time and explore it in demo mode — free forever.' },
            { free: true, title: 'HartHome Health module', body: 'Weight, water, steps, sleep, mood & meds tracking here stays free.' },
            { free: false, title: 'One-tap signed-in launch', body: 'Open HartCare already logged into this household — no second account.' },
            { free: false, title: 'Live wellness on your dashboard', body: "Today's steps, sleep and health reminders, right on the home screen." },
            { free: false, title: 'Two-way family bridge', body: 'HartCare sees your family members and shared calendar automatically.' },
            { free: false, title: 'Priority support', body: 'Front of the line when you need a hand.' },
          ].map(f => (
            <div key={f.title} className={`card p-4 flex items-start gap-3 ${f.free ? '' : 'opacity-90'}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.free ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {f.free ? <Check size={15} /> : <Lock size={14} />}
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-800">{f.title} {f.free ? <span className="badge badge-green ml-1">Free</span> : <span className="badge badge-amber ml-1">Hart+</span>}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">HartCare provides wellness information, not medical advice.</p>
        {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
      </div>
    );
  }

  if (!url) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader title="HartCare" subtitle="Your family's health & wellness app" icon={HeartPulse} />
        <EmptyState icon={HeartPulse} title="HartCare isn't connected yet"
          message={isParent ? 'Add your HartCare URL to open it signed-in with this household and see wellness highlights here.' : 'Ask a parent to connect HartCare in Settings.'}
          action={isParent ? <Link to="/settings" className="btn-primary"><SettingsIcon size={16} /> Connect in Settings</Link> : undefined} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="HartCare" subtitle="Your family's health & wellness app" icon={HeartPulse}
        actions={<button className="btn-primary" onClick={() => openHartCare(url)}><ExternalLink size={16} /> Open HartCare</button>} />

      {/* Live wellness summary */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Today's wellness</h2>
        {loading ? <Spinner /> : summary ? (
          <>
            {summary.headline && <p className="text-gray-700 mb-4">{summary.headline}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {summary.steps != null && <Metric icon={Footprints} label="Steps" value={summary.steps.toLocaleString()} />}
              {summary.activeMinutes != null && <Metric icon={Activity} label="Active minutes" value={String(summary.activeMinutes)} />}
              {summary.sleepHours != null && <Metric icon={Moon} label="Sleep" value={`${summary.sleepHours}h`} />}
            </div>
            {summary.reminders?.length ? (
              <div className="mt-4"><div className="section-label">Health reminders</div>
                <ul className="space-y-1.5">{summary.reminders.map((r, i) => <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-rose-400" />{r}</li>)}</ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-sm text-gray-500">
            <p>HartCare is connected. Open it to see your dashboard — live highlights will appear here once HartCare's summary endpoint is live.</p>
            <button className="btn-secondary mt-3" onClick={() => openHartCare(url)}><ExternalLink size={15} /> Open HartCare</button>
          </div>
        )}
      </section>

      {/* What's shared */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3"><ArrowLeftRight size={16} className="text-gray-400" /><h2 className="font-semibold text-gray-800">Shared between HartHome &amp; HartCare</h2></div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {[
            'One sign-in — open HartCare already logged into this household',
            'The same family members and profiles',
            'Your shared calendar & events appear in HartCare',
            'Wellness highlights surface here on your HartHome dashboard',
          ].map(t => <div key={t} className="flex items-start gap-2 text-gray-600"><Check size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />{t}</div>)}
        </div>
        <p className="text-xs text-gray-400 mt-4">HartCare provides wellness information, not medical advice.</p>
      </section>
    </div>
  );
}

function Metric({ icon: I, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.05), rgba(245,158,11,0.05))' }}>
      <I size={18} className="mx-auto text-rose-500" />
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
