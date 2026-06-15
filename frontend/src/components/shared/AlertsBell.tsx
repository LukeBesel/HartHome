import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAsync } from '../../hooks/useCollection';
import { useLiveRefresh } from '../../api/live';
import { Icon } from './ui';

const SEV: Record<string, string> = {
  overdue: 'bg-red-50 text-red-600',
  today: 'bg-amber-50 text-amber-600',
  soon: 'bg-blue-50 text-blue-600',
};

// A floating alerts bell: shows a badge of everything needing attention and,
// when the household enables it, fires a daily browser notification summary.
export default function AlertsBell() {
  const { data, refresh } = useAsync(() => api.reminders(), []);
  useLiveRefresh(refresh);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const notifiedRef = useRef(false);

  // Optional browser notification: one summary per day if the user opted in.
  useEffect(() => {
    if (!data || notifiedRef.current) return;
    if (localStorage.getItem('hh_notify') !== 'on') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('hh_notify_day') === today) return;
    if (data.count === 0) return;
    notifiedRef.current = true;
    localStorage.setItem('hh_notify_day', today);
    const od = data.overdue ? `${data.overdue} overdue · ` : '';
    new Notification('HartHome — today at home', { body: `${od}${data.count} thing${data.count === 1 ? '' : 's'} need attention`, icon: '/favicon.svg' });
  }, [data]);

  const count = data?.count ?? 0;
  const overdue = data?.overdue ?? 0;

  return (
    <div className="fixed top-3 right-3 z-30">
      <button onClick={() => setOpen(o => !o)} aria-label="Alerts"
        className="relative w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors">
        {count > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {count > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${overdue ? 'bg-red-500' : 'bg-indigo-500'}`}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[-1]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Reminders</h3>
              <button onClick={() => setOpen(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {count === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-400">You're all caught up. 🌿</div>
              ) : data!.items.map(r => (
                <button key={r.id} onClick={() => { setOpen(false); navigate(r.link); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${SEV[r.severity]}`}><Icon name={r.icon} size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.title}</div>
                    <div className="text-xs text-gray-500 truncate">{r.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Ask for browser-notification permission and remember the household's choice.
export async function enableNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  const on = perm === 'granted';
  localStorage.setItem('hh_notify', on ? 'on' : 'off');
  return on;
}

export function notificationsEnabled() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem('hh_notify') === 'on';
}

export function disableNotifications() {
  localStorage.setItem('hh_notify', 'off');
}
