import { api } from './client';

// Open HartCare (or any sister Hart app) already signed-in with this household,
// by minting a one-time SSO hand-off token and handing it to HartCare's /sso
// entry point. HartCare exchanges it via HartHome's /api/sso/verify.
export async function openHartCare(baseUrl?: string): Promise<boolean> {
  try {
    const { token, hartcare_url } = await api.ssoHandoff();
    const url = (baseUrl || hartcare_url || '').trim().replace(/\/$/, '');
    if (!url) return false;
    window.open(`${url}/sso?token=${encodeURIComponent(token)}`, '_blank', 'noopener');
    return true;
  } catch {
    return false;
  }
}

// Fetch a HartCare daily summary for the live dashboard tile. HartCare validates
// the one-time token against HartHome's /api/sso/verify. Returns null if HartCare
// isn't connected or hasn't implemented the endpoint yet (the tile degrades to a
// launch card).
export interface HartCareSummary { steps?: number; activeMinutes?: number; sleepHours?: number; reminders?: string[]; headline?: string; }
export async function fetchHartCareSummary(baseUrl?: string): Promise<HartCareSummary | null> {
  try {
    const { token, hartcare_url } = await api.ssoHandoff();
    const url = (baseUrl || hartcare_url || '').trim().replace(/\/$/, '');
    if (!url) return null;
    const res = await fetch(`${url}/api/summary?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
