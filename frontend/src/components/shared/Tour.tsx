import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, CalendarDays, CheckSquare, Gift, ShoppingCart, UtensilsCrossed,
  Receipt, Wallet, Car, MonitorPlay, Sparkles, ArrowRight, ArrowLeft, X, PartyPopper,
} from 'lucide-react';

// A friendly, route-driven product tour. Rather than depend on exact DOM
// coordinates (fragile across screen sizes), each step navigates to a real page
// and explains what the family is looking at — so it doubles as a live demo.

type Step = {
  route: string;
  icon: React.ElementType;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  { route: '/dashboard', icon: Home, title: 'Welcome to HartHome 👋', body: "This is your home base — a calm, glanceable overview of everything happening across the family today: schedule, chores, bills, goals, the points race, and the family bulletin. Let's take a quick two-minute tour." },
  { route: '/calendar', icon: CalendarDays, title: 'The family calendar', body: "Every practice, appointment, and date night — color-coded by family member. Tap any day to add an event, or a pill to edit one. This is the calendar the whole house actually checks." },
  { route: '/chores', icon: CheckSquare, title: 'Chores that run themselves', body: "Assign chores to anyone, set them to repeat daily or weekly, and they roll forward automatically. Checking one off awards points to that family member — instantly." },
  { route: '/rewards', icon: Gift, title: 'Rewards & allowance', body: "Kids spend the points they earn on real rewards — screen time, treats, privileges — and a parent approves each one. It turns chores into a game everybody wins." },
  { route: '/lists', icon: ShoppingCart, title: 'Lists & groceries', body: "Shared grocery and to-do lists everyone can add to from anywhere. Groceries group themselves by aisle, and you can clear the checked items after a shop run." },
  { route: '/meals', icon: UtensilsCrossed, title: 'Meal planning', body: "Plan the week, save recipes, and turn the whole plan into a grocery list with one tap. No more 5pm 'what's for dinner?' panic." },
  { route: '/bills', icon: Receipt, title: 'Never miss a bill', body: "Track every bill with due dates and autopay flags. Mark one paid and recurring bills roll to next month — and the payment flows straight into your budget." },
  { route: '/budget', icon: Wallet, title: 'The whole money picture', body: "Accounts, net worth, monthly cashflow, budget-vs-actual, and a six-month trend chart. Finally see where the household money actually goes." },
  { route: '/assets', icon: Car, title: 'Cars, home & maintenance', body: "Track vehicles, appliances, and home systems — with service schedules by date AND mileage. Oil changes, registration, warranties: nothing slips through the cracks." },
  { route: '/display', icon: MonitorPlay, title: 'Put it on any screen', body: "Open Display mode on a kitchen wall tablet or TV for a beautiful, auto-refreshing family board. (We'll skip opening it now so the tour can finish!)" },
  { route: '/dashboard', icon: PartyPopper, title: "You're all set! 🎉", body: "That's the tour. Everything here is real, editable demo data — click around, complete a chore, pay a bill, add an event. When you're ready, create your own household from Settings or the sign-up page." },
];

export default function Tour() {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-start when flagged (e.g. right after entering the demo).
  useEffect(() => {
    if (localStorage.getItem('hh_tour') === 'pending') {
      localStorage.setItem('hh_tour', 'done');
      const t = setTimeout(() => { setI(0); setActive(true); }, 700); // let the dashboard render first
      return () => clearTimeout(t);
    }
  }, []);

  // Allow (re)starting from anywhere — Settings dispatches this event.
  useEffect(() => {
    const onStart = () => { setI(0); setActive(true); navigate('/dashboard'); };
    window.addEventListener('harthome:start-tour', onStart);
    return () => window.removeEventListener('harthome:start-tour', onStart);
  }, [navigate]);

  const go = useCallback((next: number) => {
    const step = STEPS[next];
    if (!step) return;
    setI(next);
    // The Display step describes the kiosk without leaving the tour shell.
    if (step.route !== '/display' && location.pathname !== step.route) navigate(step.route);
  }, [navigate, location.pathname]);

  const finish = () => { setActive(false); };

  if (!active) return null;
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  return (
    <>
      {/* Dim the app slightly to focus attention, but keep it interactive-looking. */}
      <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-[1px] pointer-events-none animate-fadeIn" />

      {/* Tour card — bottom center, out of the way of content. */}
      <div className="fixed z-[61] inset-x-0 bottom-4 sm:bottom-6 flex justify-center px-4 animate-fadeIn">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
          <div className="h-1.5 w-full bg-gray-100">
            <div className="h-full transition-all duration-300" style={{ width: `${((i + 1) / STEPS.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--secondary))' }} />
          </div>
          <div className="p-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}>
                <step.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-gray-900">{step.title}</h3>
                  <button onClick={finish} className="text-gray-400 hover:text-gray-600 -mr-1" title="Skip tour"><X size={18} /></button>
                </div>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{step.body}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, idx) => (
                  <span key={idx} className="h-1.5 rounded-full transition-all" style={{ width: idx === i ? 18 : 6, backgroundColor: idx === i ? 'var(--accent)' : '#e5e7eb' }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {i > 0 && !isLast && (
                  <button onClick={() => go(i - 1)} className="btn-ghost px-3"><ArrowLeft size={15} /> Back</button>
                )}
                {!isLast ? (
                  <button onClick={() => go(i + 1)} className="btn-primary"><Sparkles size={15} /> {i === 0 ? 'Start tour' : 'Next'} <ArrowRight size={15} /></button>
                ) : (
                  <button onClick={finish} className="btn-primary"><PartyPopper size={15} /> Explore on my own</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper other components can call to (re)launch the tour.
export function startTour() {
  window.dispatchEvent(new Event('harthome:start-tour'));
}
