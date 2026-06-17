import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, ExternalLink, Footprints, Moon, Activity, Settings as SettingsIcon, ArrowLeftRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Spinner, EmptyState } from '../components/shared/ui';
import { openHartCare, fetchHartCareSummary, HartCareSummary } from '../api/hartcare';

export default function HartCareHub() {
  const { user, isParent } = useAuth();
  const url = user?.household?.hartcare_url;
  const [summary, setSummary] = useState<HartCareSummary | null>(null);
  const [loading, setLoading] = useState(!!url);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    fetchHartCareSummary(url).then(setSummary).catch(() => {}).finally(() => setLoading(false));
  }, [url]);

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
