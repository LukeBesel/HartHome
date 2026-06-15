import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon, Moon, Sun, Copy, Check, Trash2, Plus, Monitor, ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  Spinner, PageHeader, Modal, Field, Input, Select, EmptyState,
} from '../components/shared/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme, ACCENTS } from '../context/ThemeContext';
import { enableNotifications, notificationsEnabled, disableNotifications } from '../components/shared/AlertsBell';
import type { Household, Device } from '../types';

const DEVICE_TYPES = ['wall', 'tablet', 'tv', 'phone', 'hub'];

interface HouseholdForm { name: string; address: string; timezone: string; }
interface DeviceForm { name: string; type: string; }

export default function Settings() {
  const { user, isParent } = useAuth();
  const { dark, toggleDark, accent, setAccent } = useTheme();
  const { data: household, loading, refresh: refreshHousehold } = useAsync(() => api.household(), []);
  const { data: devices, refresh: refreshDevices } = useAsync(() => api.devices(), []);

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

  const pickAccent = (id: string) => {
    setAccent(id);
    if (isParent) api.updateHousehold({ accent: id }).catch(() => { /* best-effort */ });
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
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">Appearance</h2>
          <p className="text-sm text-gray-500">Choose your theme and accent color.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">Dark mode</div>
            <div className="text-sm text-gray-500">{dark ? 'Currently on' : 'Currently off'}</div>
          </div>
          <button className="btn-secondary" onClick={toggleDark} aria-label="Toggle dark mode">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
        <div>
          <div className="font-medium text-gray-900 mb-2">Accent</div>
          <div className="flex items-center gap-3 flex-wrap">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pickAccent(a.id)}
                aria-label={a.label}
                title={a.label}
                className={`w-9 h-9 rounded-full transition-transform hover:scale-105 ${accent === a.id ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: a.color }}
              />
            ))}
          </div>
        </div>
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
