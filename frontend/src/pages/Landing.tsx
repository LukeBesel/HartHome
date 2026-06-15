import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, CheckSquare, Gift, Target, ShoppingCart, Receipt,
  Wallet, Zap, Car, Phone, UtensilsCrossed, MonitorPlay, Sparkles, Check,
  Smartphone, ShieldCheck, Bell, Home,
} from 'lucide-react';
import { MarketingNav, MarketingFooter, Reveal } from '../marketing/Marketing';

const GRADIENT = 'linear-gradient(135deg, #6366f1, #ec4899)';

const FEATURES = [
  { icon: CalendarDays, title: 'Shared Family Calendar', body: 'Every practice, appointment, and date night in one color-coded view the whole family actually checks.' },
  { icon: CheckSquare, title: 'Chores & Allowance', body: 'Assign recurring chores, auto-award points, and watch the kids race up the leaderboard.' },
  { icon: Gift, title: 'Rewards Store', body: 'Kids spend earned points on screen time, treats, and privileges — you approve from your phone.' },
  { icon: Target, title: 'Goals & Habits', body: 'Track family savings, reading challenges, step counts, and home projects with real progress bars.' },
  { icon: ShoppingCart, title: 'Lists & Groceries', body: 'Smart grocery and to-do lists that everyone can add to from anywhere, organized by aisle.' },
  { icon: UtensilsCrossed, title: 'Meal Planning', body: 'Plan the week, save recipes, and turn the whole plan into a grocery list with one tap.' },
  { icon: Receipt, title: 'Bills & Reminders', body: 'Never miss a due date. Recurring bills roll forward automatically and feed your budget.' },
  { icon: Wallet, title: 'Budget & Accounts', body: 'See net worth, monthly cashflow, and budget-vs-actual across every account at a glance.' },
  { icon: Zap, title: 'Utilities Tracker', body: 'Keep providers, account numbers, and meter readings for electric, water, gas, and internet.' },
  { icon: Car, title: 'Car & Home Assets', body: 'Log every vehicle, appliance, and home system with maintenance schedules and service history.' },
  { icon: Phone, title: 'Contacts & Documents', body: 'Emergency numbers, doctors, schools, and the WiFi password — always exactly where you need them.' },
  { icon: MonitorPlay, title: 'Any Screen', body: 'Cast a calm, glanceable dashboard to a kitchen wall display, tablet, or TV — at home or on the go.' },
];

const STEPS = [
  { n: '1', title: 'Create your household', body: 'Sign up in seconds and add everyone in the family — parents, kids, even the dog walker.' },
  { n: '2', title: 'Fill your home screen', body: 'Add chores, events, bills, lists, goals, and assets. Sensible defaults get you running fast.' },
  { n: '3', title: 'Put it on any screen', body: 'Open Display mode on a wall tablet or TV and the whole family stays in sync, all day.' },
];

function MiniDashboard() {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0c1018] shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 px-4 h-10 bg-white/5 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" /><span className="w-3 h-3 rounded-full bg-[#febc2e]" /><span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="ml-4 flex-1 max-w-xs"><div className="h-6 rounded-md bg-black/30 border border-white/5 flex items-center px-3"><span className="text-[11px] text-gray-500">app.harthome.io</span></div></div>
      </div>
      <div className="p-4 bg-slate-900 grid grid-cols-3 gap-3 text-left">
        <div className="col-span-3 flex items-center justify-between">
          <div><div className="text-white font-bold">Good morning, Hart Family 👋</div><div className="text-slate-400 text-xs">Sunday · 3 events today</div></div>
          <div className="flex -space-x-2">{['#6366f1', '#ec4899', '#14b8a6', '#f59e0b'].map(c => <span key={c} className="w-7 h-7 rounded-full border-2 border-slate-900" style={{ background: c }} />)}</div>
        </div>
        {[['Today', '3', CalendarDays, '#6366f1'], ['Chores due', '5', CheckSquare, '#14b8a6'], ['Bills', '2', Receipt, '#ec4899']].map(([l, v, I, c]: any) => (
          <div key={l} className="rounded-xl bg-slate-800/70 border border-white/5 p-3">
            <I size={16} style={{ color: c }} /><div className="text-white text-xl font-bold mt-1">{v}</div><div className="text-slate-400 text-[10px]">{l}</div>
          </div>
        ))}
        <div className="col-span-2 rounded-xl bg-slate-800/70 border border-white/5 p-3 space-y-2">
          <div className="text-slate-300 text-[11px] font-semibold uppercase tracking-wide">Chores</div>
          {[['Walk the dog', 'Ava', '+8'], ['Dishwasher', 'Leo', '+5'], ['Make bed', 'Leo', '+3']].map(([t, w, p]) => (
            <div key={t} className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-slate-600" /><span className="text-slate-200 text-xs flex-1">{t}</span><span className="text-slate-500 text-[10px]">{w}</span><span className="text-emerald-400 text-[10px] font-semibold">{p}</span></div>
          ))}
        </div>
        <div className="rounded-xl border border-white/5 p-3 flex flex-col justify-center" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(236,72,153,.25))' }}>
          <Target size={16} className="text-indigo-300" /><div className="text-white text-sm font-bold mt-1">Vacation</div><div className="text-slate-300 text-[10px]">$2,350 / $4,000</div>
          <div className="h-1.5 rounded-full bg-black/30 mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: '59%', background: GRADIENT }} /></div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-[#060911] text-white min-h-screen overflow-hidden">
      <MarketingNav />

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="absolute top-0 left-1/4 w-[36rem] h-[36rem] aurora-orb animate-aurora" style={{ background: '#6366f1' }} />
        <div className="absolute top-20 right-1/4 w-[32rem] h-[32rem] aurora-orb animate-aurora" style={{ background: '#ec4899', animationDelay: '3s' }} />
        <div className="relative max-w-5xl mx-auto text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-indigo-200 bg-white/5 border border-white/10 mb-6">
              <Sparkles size={13} /> One home screen for the whole family
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
              The command center<br />for your <span className="text-gradient">entire home</span>.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Calendar, chores, rewards, groceries, meals, bills, budget, utilities, and car &amp; home maintenance —
              beautifully together, on every screen in the house.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login?mode=signup" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-6 py-3.5 rounded-full transition-all hover:opacity-90 glow-lg" style={{ background: GRADIENT }}>
                Start free <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-200 px-6 py-3.5 rounded-full border border-white/15 hover:bg-white/5 transition-all">
                See the demo home
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-600">No credit card · Demo login: owner@harthome.demo / Demo123!</p>
          </Reveal>
          <Reveal delay={320}><div className="mt-16 max-w-3xl mx-auto"><MiniDashboard /></div></Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything your household runs on</h2>
            <p className="mt-4 text-gray-400 max-w-2xl mx-auto">Replace the fridge whiteboard, the shared notes app, the budgeting spreadsheet, and the glovebox folder — with one calm place.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div className="h-full rounded-2xl bg-white/[0.03] border border-white/10 p-6 hover:bg-white/[0.06] hover:border-white/20 transition-all">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: GRADIENT }}><f.icon size={20} className="text-white" /></div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-14"><h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Up and running in minutes</h2></Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-7 h-full">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mb-4" style={{ background: GRADIENT }}>{s.n}</div>
                  <h3 className="font-semibold text-white text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-10">
            {[[Smartphone, 'Works on every device', 'Phone, tablet, laptop, and wall display.'], [Bell, 'Gentle reminders', 'Due dates, birthdays, and overdue maintenance surface automatically.'], [ShieldCheck, 'Private by default', 'Your household data is isolated and yours alone.']].map(([I, t, b]: any) => (
              <div key={t} className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-white/10 p-4">
                <I size={20} className="text-indigo-300 mt-0.5 flex-shrink-0" /><div><div className="text-sm font-semibold text-white">{t}</div><div className="text-xs text-gray-400 mt-0.5">{b}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <Reveal className="max-w-4xl mx-auto text-center rounded-3xl border border-white/10 p-12 relative overflow-hidden" >
          <div className="absolute inset-0 opacity-30" style={{ background: GRADIENT }} />
          <div className="relative">
            <Home size={32} className="mx-auto text-white mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Bring your home together</h2>
            <p className="mt-4 text-gray-200 max-w-xl mx-auto">Join families running calmer, more organized homes with HartHome.</p>
            <Link to="/login?mode=signup" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-indigo-900 bg-white px-7 py-3.5 rounded-full hover:opacity-90 transition-all">
              Get started free <ArrowRight size={16} />
            </Link>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-300">
              {['Free to start', 'All your data in one place', 'Cancel anytime'].map(t => <span key={t} className="inline-flex items-center gap-1.5"><Check size={13} />{t}</span>)}
            </div>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
