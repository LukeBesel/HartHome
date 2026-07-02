import { useEffect, useState } from 'react';
import { toast } from '../components/shared/Toast';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon, Moon, Sun, Copy, Check, Trash2, Plus, Monitor, ExternalLink, Palette, Eye, EyeOff, Lock, HeartPulse,
} from 'lucide-react';
import { openHartCare } from '../api/hartcare';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  Spinner, PageHeader, Modal, Field, Input, Select, EmptyState,
} from '../components/shared/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SECTIONS } from '../config/navigation';
import { enableNotifications, notificationsEnabled, disableNotifications } from '../components/shared/AlertsBell';
import type { Household, Device } from '../types';

const DEVICE_TYPES = ['wall', 'tablet', 'tv', 'phone', 'hub'];

interface HouseholdForm { name: string; address: string; timezone: string; }
interface DeviceForm { name: string; type: string; }

export default function Settings() {
  const { user, isParent, refresh: refreshAuth } = useAuth();
  const { dark, toggleDark, prefs, setPrefs } = useTheme();
  const hiddenNav = new Set(prefs.nav?.hidden || []);
  const setHiddenNav = (next: Set<string>) => setPrefs({ nav: { ...prefs.nav, hidden: [...next] } });
  const toggleNav = (key: string) => { const n = new Set(hiddenNav); n.has(key) ? n.delete(key) : n.add(key); setHiddenNav(n); };

  const { data: household, loading, refresh: refreshHousehold } = useAsync(() => api.household(), []);
  const { data: devices, refresh: refreshDevices } = useAsync(() => api.devices(), []);

  // HartCare connection (sister wellness app).
  const [hcUrl, setHcUrl] = useState('');
  const [hcSaved, setHcSaved] = useState(false);
  useEffect(() => { if (household) setHcUrl(household.hartcare_url || ''); }, [household]);
  const saveHartCare = async () => {
    await api.updateHousehold({ hartcare_url: hcUrl.trim() });
    await refreshHousehold();
    setHcSaved(true); setTimeout(() => setHcSaved(false), 1500);
  };

  // Financial passcode (locks Bills & Budget for kids).
  const [finPin, setFinPin] = useState('');
  const [finBusy, setFinBusy] = useState(false);
  const setFinancePin = async (clear: boolean) => {
    setFinBusy(true);
    try {
      await api.setFinancePin(clear ? null : finPin);
      setFinPin('');
      sessionStorage.setItem('hh_finance_ok', '1'); // the parent who set it is unlocked now
      await Promise.all([refreshHousehold(), refreshAuth()]);
    } catch (e: any) { toast.error(e.message || 'Could not update passcode'); }
    finally { setFinBusy(false); }
  };

  const [hhForm, setHhForm] = useState<HouseholdForm>({ name: '', address: '', timezone: '' });
  const [hhSaving, setHhSaving] = useState(false);
  const [hhSaved, setHhSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [deviceModal, setDeviceModal] = useState(false);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>({ name: '', type: 'tablet' });
  const [deviceSaving, setDeviceSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (household) {
      setHhForm({
        name: household.name || '',
        address: household.address || '',
        timezone: household.timezone || '',
      });
    }
  }, [household]);

  const deviceList: Device[] = devices || [];

  const saveHousehold = async () => {
    setHhSaving(true);
    setHhSaved(false);
    try {
      await api.updateHousehold({
        name: hhForm.name.trim(),
        address: hhForm.address.trim(),
        timezone: hhForm.timezone.trim(),
      });
      await refreshHousehold();
      setHhSaved(true);
      setTimeout(() => setHhSaved(false), 2000);
    } finally { setHhSaving(false); }
  };

  const copyInvite = async () => {
    if (!household?.invite_code) return;
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore clipboard errors */ }
  };

  const [notifyOn, setNotifyOn] = useState(notificationsEnabled());
  const [regenning, setRegenning] = useState(false);
  const regenInvite = async () => {
    setRegenning(true);
    try { await api.regenerateInvite(); await refreshHousehold(); }
    catch { /* ignore */ }
    finally { setRegenning(false); }
  };

  const changePassword = async () => {
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ kind: 'err', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwMessage({ kind: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    setPwSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPwMessage({ kind: 'ok', text: 'Password updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPwMessage({ kind: 'err', text: (e as Error).message || 'Could not update password.' });
    } finally { setPwSaving(false); }
  };

  const createDevice = async () => {
    if (!deviceForm.name.trim()) return;
    setDeviceSaving(true);
    try {
      await api.createDevice({ name: deviceForm.name.trim(), type: deviceForm.type });
      setDeviceModal(false);
      setDeviceForm({ name: '', type: 'tablet' });
      await refreshDevices();
    } finally { setDeviceSaving(false); }
  };

  const removeDevice = async (id: string) => {
    setBusy(id);
    try { await api.deleteDevice(id); await refreshDevices(); } finally { setBusy(null); }
  };

  if (loading && !household) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Household, appearance, account & screens" icon={SettingsIcon} />

      {/* Guided tour */}
      <section className="card p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">Guided tour</h2>
          <p className="text-sm text-gray-500">Take a quick walkthrough of everything HartHome can do.</p>
        </div>
        <button onClick={() => window.dispatchEvent(new Event('harthome:start-tour'))} className="btn-primary">Start the tour</button>
      </section>

      {/* Notifications */}
      <section className="card p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">Get a daily browser reminder of what needs attention — bills, chores, maintenance, and birthdays.</p>
        </div>
        {notifyOn ? (
          <button onClick={() => { disableNotifications(); setNotifyOn(false); }} className="btn-secondary">Turn off</button>
        ) : (
          <button onClick={async () => setNotifyOn(await enableNotifications())} className="btn-primary">Enable reminders</button>
        )}
      </section>

      {/* Household */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">Household</h2>
          <p className="text-sm text-gray-500">{isParent ? 'Manage your household details.' : 'Your household details.'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={hhForm.name} disabled={!isParent} onChange={(e) => setHhForm({ ...hhForm, name: e.target.value })} />
          </Field>
          <Field label="Timezone" hint="e.g. America/New_York">
            <Input value={hhForm.timezone} disabled={!isParent} onChange={(e) => setHhForm({ ...hhForm, timezone: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <Input value={hhForm.address} disabled={!isParent} onChange={(e) => setHhForm({ ...hhForm, address: e.target.value })} />
        </Field>
        <Field label="Invite code" hint="Share this so a partner or family member can join your home from the “Join home” tab on the sign-in screen.">
          <div className="flex items-center gap-2">
            <Input value={household?.invite_code || ''} readOnly className="font-mono tracking-widest uppercase" />
            <button className="btn-secondary flex-shrink-0" onClick={copyInvite} aria-label="Copy invite code">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            {isParent && (
              <button className="btn-ghost flex-shrink-0" onClick={regenInvite} disabled={regenning} title="Generate a new code (invalidates the old one)">New code</button>
            )}
          </div>
        </Field>
        {isParent && (
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={saveHousehold} disabled={hhSaving}>{hhSaving ? 'Saving…' : 'Save changes'}</button>
            {hhSaved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        )}
      </section>

      {/* Appearance */}
      <section className="card p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}><Palette size={18} /></span>
          <div>
            <h2 className="font-bold text-gray-900">Appearance & theme</h2>
            <p className="text-sm text-gray-500">Colors, light/dark, density, corners, text size, and backgrounds.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={toggleDark} aria-label="Toggle dark mode">{dark ? <Sun size={16} /> : <Moon size={16} />}{dark ? 'Light' : 'Dark'}</button>
          <Link to="/appearance" className="btn-primary">Open studio</Link>
        </div>
      </section>

      {/* Modules & navigation */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">Modules & navigation</h2>
          <p className="text-sm text-gray-500">Show or hide whole sections or individual features in your sidebar. Hidden items just disappear from your menu — your data stays.</p>
        </div>
        <div className="space-y-3">
          {SECTIONS.map((section) => {
            const sectionHidden = hiddenNav.has(`section:${section.id}`);
            const SectionIcon = section.items[0].icon;
            return (
              <div key={section.id} className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <SectionIcon size={15} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-800">{section.label}</span>
                  </div>
                  <button onClick={() => toggleNav(`section:${section.id}`)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${sectionHidden ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {sectionHidden ? 'Hidden' : 'Shown'}
                  </button>
                </div>
                {!sectionHidden && (
                  <div className="divide-y divide-gray-50">
                    {section.items.map((item) => {
                      const itemHidden = hiddenNav.has(item.to);
                      return (
                        <div key={item.to} className="flex items-center justify-between gap-2 px-3 py-2 pl-9">
                          <div className="flex items-center gap-2"><item.icon size={14} className="text-gray-400" /><span className={`text-sm ${itemHidden ? 'text-gray-400' : 'text-gray-700'}`}>{item.label}</span></div>
                          <button onClick={() => toggleNav(item.to)} className="btn-ghost p-1" aria-label={itemHidden ? 'Show' : 'Hide'}>
                            {itemHidden ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-emerald-600" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Connected apps — HartCare */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #f43f5e, #f59e0b)' }}><HeartPulse size={18} /></span>
          <div>
            <h2 className="font-bold text-gray-900">HartCare</h2>
            <p className="text-sm text-gray-500">Connect your family's health &amp; wellness app. Open it already signed-in with this household.</p>
          </div>
        </div>
        {isParent ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="HartCare URL" hint="e.g. https://hartcare.up.railway.app">
              <Input value={hcUrl} placeholder="https://…" onChange={(e) => setHcUrl(e.target.value)} className="w-64" />
            </Field>
            <button className="btn-primary" onClick={saveHartCare}>Save</button>
            {hcSaved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{household?.hartcare_url ? 'HartCare is connected.' : 'Not connected yet — ask a parent.'}</p>
        )}
        {household?.hartcare_url && (
          <button className="btn-secondary" onClick={() => openHartCare(household.hartcare_url)}><ExternalLink size={15} /> Open HartCare</button>
        )}
      </section>

      {/* Family finances lock */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, var(--accent), var(--secondary))' }}><Lock size={18} /></span>
          <div>
            <h2 className="font-bold text-gray-900">Family finances lock</h2>
            <p className="text-sm text-gray-500">Set a passcode so parents can open Bills &amp; Budget but kids can't.</p>
          </div>
        </div>
        {!isParent ? (
          <p className="text-sm text-gray-500">{household?.finance_locked ? 'Finances are passcode-protected.' : 'No passcode set.'} Ask a parent to manage this.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className={`badge ${household?.finance_locked ? 'badge-green' : 'badge-gray'}`}>{household?.finance_locked ? 'Locked' : 'Off'}</span>
              <span className="text-gray-500">{household?.finance_locked ? 'Bills & Budget require the passcode.' : 'Anyone in the household can open finances.'}</span>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={household?.finance_locked ? 'New passcode' : 'Set a passcode'} hint="At least 4 digits.">
                <Input inputMode="numeric" type="password" value={finPin} placeholder="••••"
                  onChange={(e) => setFinPin(e.target.value.replace(/\D/g, '').slice(0, 12))} className="w-40" />
              </Field>
              <button className="btn-primary" disabled={finBusy || finPin.length < 4} onClick={() => setFinancePin(false)}>
                {household?.finance_locked ? 'Update' : 'Enable lock'}
              </button>
              {household?.finance_locked && (
                <button className="btn-ghost text-red-600" disabled={finBusy} onClick={() => setFinancePin(true)}>Turn off</button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Your account */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">Your account</h2>
          <p className="text-sm text-gray-500">
            {user?.display_name}
            {user?.email ? ` · ${user.email}` : ''}
            {user?.role ? ` · ${user.role}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Current password">
            <Input type="password" value={currentPassword} autoComplete="current-password" onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <Input type="password" value={newPassword} autoComplete="new-password" onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirmPassword} autoComplete="new-password" onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
        </div>
        {pwMessage && (
          <p className={`text-sm ${pwMessage.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{pwMessage.text}</p>
        )}
        <button
          className="btn-primary"
          onClick={changePassword}
          disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
        >
          {pwSaving ? 'Updating…' : 'Change password'}
        </button>
      </section>

      {/* Connected screens */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-gray-900">Connected screens</h2>
            <p className="text-sm text-gray-500">Open Display mode on any device to show a rotating family dashboard.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/display" className="btn-secondary"><ExternalLink size={16} /> Open display mode</Link>
            <button className="btn-primary" onClick={() => setDeviceModal(true)}><Plus size={16} /> Add display</button>
          </div>
        </div>
        {deviceList.length === 0 ? (
          <EmptyState icon={Monitor} title="No screens paired" message="Add a display to generate a pairing code." />
        ) : (
          <div className="divide-y divide-gray-100">
            {deviceList.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0">
                  <Monitor size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{d.name}</div>
                  <span className="badge badge-gray capitalize">{d.type}</span>
                </div>
                {d.pairing_code && (
                  <code className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-mono">{d.pairing_code}</code>
                )}
                <button
                  className="btn-ghost p-1.5 text-red-500 flex-shrink-0"
                  aria-label="Remove display"
                  disabled={busy === d.id}
                  onClick={() => removeDevice(d.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add display modal */}
      <Modal
        open={deviceModal}
        title="Add display"
        onClose={() => setDeviceModal(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeviceModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={createDevice} disabled={deviceSaving || !deviceForm.name.trim()}>
              {deviceSaving ? 'Adding…' : 'Add display'}
            </button>
          </>
        }
      >
        <Field label="Name">
          <Input value={deviceForm.name} placeholder="Kitchen tablet" onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={deviceForm.type} onChange={(e) => setDeviceForm({ ...deviceForm, type: e.target.value })}>
            {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-gray-400">A pairing code is generated automatically once the display is added.</p>
      </Modal>
    </div>
  );
}
