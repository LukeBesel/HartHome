import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Tiny, dependency-free toast system. Fire from anywhere with toast('Saved!')
// or toast.error('...') — the host listens on a window event, so no context
// plumbing is needed and it works from plain functions too.

type Kind = 'success' | 'error' | 'info';
interface ToastMsg { id: number; kind: Kind; text: string; }

let seq = 0;
function fire(kind: Kind, text: string) {
  window.dispatchEvent(new CustomEvent('harthome:toast', { detail: { id: ++seq, kind, text } }));
}

export function toast(text: string) { fire('success', text); }
toast.success = (text: string) => fire('success', text);
toast.error = (text: string) => fire('error', text);
toast.info = (text: string) => fire('info', text);

const ICONS: Record<Kind, React.ElementType> = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES: Record<Kind, string> = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  info: 'text-indigo-600',
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent).detail as ToastMsg;
      setToasts((list) => [...list.slice(-3), t]); // cap the stack
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 4000);
    };
    window.addEventListener('harthome:toast', onToast);
    return () => window.removeEventListener('harthome:toast', onToast);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2.5 w-full bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 animate-popIn">
            <Icon size={17} className={`flex-shrink-0 ${TONES[t.kind]}`} />
            <span className="text-sm text-gray-800 flex-1">{t.text}</span>
            <button onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))} className="text-gray-300 hover:text-gray-500" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
