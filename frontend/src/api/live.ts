import { useEffect } from 'react';

// A single shared Server-Sent Events connection. The backend pushes a small
// "changed" ping (scoped to the household) whenever data mutates, which we
// rebroadcast as a window event so any page can live-refresh. Keeps wall
// displays and dashboards in sync without polling.
let es: EventSource | null = null;

export function connectLive() {
  if (es) return;
  const token = localStorage.getItem('hh_token');
  if (!token) return;
  try {
    es = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = () => window.dispatchEvent(new Event('harthome:changed'));
    es.onerror = () => { /* EventSource auto-reconnects */ };
  } catch { /* SSE unsupported — pages still poll on navigation */ }
}

export function disconnectLive() {
  es?.close();
  es = null;
}

// Call `refresh` (debounced) whenever live data changes elsewhere.
export function useLiveRefresh(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    connectLive();
    let t: ReturnType<typeof setTimeout> | undefined;
    const handler = () => { clearTimeout(t); t = setTimeout(refresh, 400); };
    window.addEventListener('harthome:changed', handler);
    return () => { window.removeEventListener('harthome:changed', handler); clearTimeout(t); };
  }, [refresh, enabled]);
}
