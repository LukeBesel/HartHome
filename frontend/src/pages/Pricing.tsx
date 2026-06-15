import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { MarketingNav, MarketingFooter, Reveal } from '../marketing/Marketing';

const GRADIENT = 'linear-gradient(135deg, #6366f1, #ec4899)';

const PLANS = [
  { name: 'Free', price: '$0', cadence: 'forever', highlight: false,
    features: ['Up to 4 family members', 'Calendar, chores & lists', 'Goals & rewards', 'Grocery & meal planning', '1 connected display'],
    cta: 'Get started' },
  { name: 'Home', price: '$6', cadence: 'per month', highlight: true,
    features: ['Unlimited family members', 'Everything in Free', 'Bills, budget & utilities', 'Car & home asset maintenance', 'Documents & contacts vault', 'Unlimited displays', 'Smart reminders'],
    cta: 'Start free trial' },
  { name: 'Household+', price: '$10', cadence: 'per month', highlight: false,
    features: ['Everything in Home', 'Multiple homes / properties', 'Advanced budget insights', 'Priority support', 'Data export & backups'],
    cta: 'Start free trial' },
];

export default function Pricing() {
  return (
    <div className="bg-[#060911] text-white min-h-screen">
      <MarketingNav />
      <section className="relative pt-36 pb-20 px-6">
        <div className="absolute top-10 left-1/3 w-[30rem] h-[30rem] aurora-orb animate-aurora" style={{ background: '#6366f1' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <Reveal><h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Simple pricing for every home</h1></Reveal>
          <Reveal delay={80}><p className="mt-5 text-gray-400">Start free. Upgrade when your home needs more. Cancel anytime.</p></Reveal>
        </div>
      </section>
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 100}>
              <div className={`relative h-full rounded-2xl p-7 flex flex-col ${p.highlight ? 'border-2' : 'border border-white/10 bg-white/[0.03]'}`}
                style={p.highlight ? { borderColor: '#6366f1', background: 'rgba(99,102,241,.08)' } : {}}>
                {p.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1 rounded-full text-white" style={{ background: GRADIENT }}>MOST POPULAR</span>}
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <div className="mt-3 flex items-end gap-1.5"><span className="text-4xl font-extrabold">{p.price}</span><span className="text-gray-500 text-sm mb-1.5">/{p.cadence}</span></div>
                <ul className="mt-6 space-y-3 flex-1">
                  {p.features.map(f => <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300"><Check size={16} className="text-indigo-400 mt-0.5 flex-shrink-0" />{f}</li>)}
                </ul>
                <Link to="/login?mode=signup" className={`mt-7 inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-3 rounded-full transition-all ${p.highlight ? 'text-white hover:opacity-90 glow' : 'text-gray-200 border border-white/15 hover:bg-white/5'}`}
                  style={p.highlight ? { background: GRADIENT } : {}}>{p.cta} <ArrowRight size={15} /></Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="text-center text-xs text-gray-600 mt-10">All plans include the full demo data so you can try everything instantly.</p>
      </section>
      <MarketingFooter />
    </div>
  );
}
