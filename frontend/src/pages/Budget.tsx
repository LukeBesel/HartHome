import { useState } from 'react';
import { Wallet, Plus, Trash2, Pencil, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, StatCard, Modal, Field, Input, Select, Icon, Avatar, EmptyState, ProgressBar,
} from '../components/shared/ui';
import { money, fmtDate, memberById, todayISO } from '../utils/format';
import type { Account, Transaction, Budget, User } from '../types';

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'cash', 'investment', 'loan'];
const OWED_TYPES = ['credit', 'loan'];

interface FinanceSummary {
  accounts: Account[];
  netWorth: number;
  budgets: (Budget & { spent: number })[];
  spendByCategory: { category: string; spent: number }[];
  month: { income: number; expense: number; net: number };
  trend: { month: string; income: number; expense: number }[];
}

interface AccountForm { id?: string; name: string; type: string; balance: number; institution: string; }
interface BudgetForm { id?: string; category: string; monthly_limit: number; icon: string; }
interface TxnForm {
  id?: string; type: Transaction['type']; amount: number; category: string;
  description: string; account_id: string; date: string; member_id: string;
}

const emptyAccount = (): AccountForm => ({ name: '', type: 'checking', balance: 0, institution: '' });
const emptyBudget = (): BudgetForm => ({ category: '', monthly_limit: 0, icon: 'Wallet' });
const emptyTxn = (): TxnForm => ({ type: 'expense', amount: 0, category: '', description: '', account_id: '', date: todayISO(), member_id: '' });

export default function Budget() {
  const { data: summary, loading, refresh: refreshSummary } = useAsync<FinanceSummary>(() => api.financeSummary(), []);
  const { data: transactions, refresh: refreshTxns } = useAsync(() => api.transactions({ limit: 30 }), []);
  const { data: accounts, refresh: refreshAccounts } = useAsync(() => api.accounts(), []);
  const { data: budgets, refresh: refreshBudgets } = useAsync(() => api.budgets(), []);
  const { data: members } = useAsync(() => api.members(), []);

  const [accountModal, setAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount());
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetForm>(emptyBudget());
  const [txnModal, setTxnModal] = useState(false);
  const [txnForm, setTxnForm] = useState<TxnForm>(emptyTxn());
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const memberList: User[] = members || [];
  const accountList: Account[] = accounts || [];
  const txnList: Transaction[] = (transactions || []).slice(0, 30);

  const refreshAll = async () => {
    await Promise.all([refreshSummary(), refreshTxns(), refreshAccounts(), refreshBudgets()]);
  };

  // ── Accounts ──
  const openCreateAccount = () => { setAccountForm(emptyAccount()); setAccountModal(true); };
  const openEditAccount = (a: Account) => {
    setAccountForm({ id: a.id, name: a.name, type: a.type, balance: a.balance, institution: a.institution });
    setAccountModal(true);
  };
  const saveAccount = async () => {
    if (!accountForm.name.trim()) return;
    setSaving(true);
    const body: Partial<Account> = {
      name: accountForm.name.trim(),
      type: accountForm.type,
      balance: Number(accountForm.balance) || 0,
      institution: accountForm.institution.trim(),
    };
    try {
      if (accountForm.id) await api.updateAccount(accountForm.id, body);
      else await api.createAccount(body);
      setAccountModal(false);
      await Promise.all([refreshAccounts(), refreshSummary()]);
    } finally { setSaving(false); }
  };
  const removeAccount = async () => {
    if (!accountForm.id) return;
    setSaving(true);
    try { await api.deleteAccount(accountForm.id); setAccountModal(false); await Promise.all([refreshAccounts(), refreshSummary()]); } finally { setSaving(false); }
  };

  // ── Budgets ──
  const openCreateBudget = () => { setBudgetForm(emptyBudget()); setBudgetModal(true); };
  const openEditBudget = (b: Budget) => {
    setBudgetForm({ id: b.id, category: b.category, monthly_limit: b.monthly_limit, icon: b.icon || 'Wallet' });
    setBudgetModal(true);
  };
  const saveBudget = async () => {
    if (!budgetForm.category.trim()) return;
    setSaving(true);
    const body: Partial<Budget> = {
      category: budgetForm.category.trim(),
      monthly_limit: Number(budgetForm.monthly_limit) || 0,
      icon: budgetForm.icon.trim() || 'Wallet',
    };
    try {
      if (budgetForm.id) await api.updateBudget(budgetForm.id, body);
      else await api.createBudget(body);
      setBudgetModal(false);
      await Promise.all([refreshBudgets(), refreshSummary()]);
    } finally { setSaving(false); }
  };
  const removeBudget = async () => {
    if (!budgetForm.id) return;
    setSaving(true);
    try { await api.deleteBudget(budgetForm.id); setBudgetModal(false); await Promise.all([refreshBudgets(), refreshSummary()]); } finally { setSaving(false); }
  };

  // ── Transactions ──
  const openCreateTxn = () => { setTxnForm(emptyTxn()); setTxnModal(true); };
  const saveTxn = async () => {
    if (!txnForm.amount) return;
    setSaving(true);
    const body: Partial<Transaction> = {
      type: txnForm.type,
      amount: Number(txnForm.amount) || 0,
      category: txnForm.category.trim(),
      description: txnForm.description.trim(),
      account_id: txnForm.account_id || null,
      date: txnForm.date || todayISO(),
      member_id: txnForm.member_id || null,
    };
    try {
      await api.createTransaction(body);
      setTxnModal(false);
      await Promise.all([refreshTxns(), refreshSummary()]);
    } finally { setSaving(false); }
  };

  if (loading && !summary) return <div className="p-6"><Spinner /></div>;
  if (!summary) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Budget"
        subtitle="Accounts, budgets, and cashflow at a glance"
        icon={Wallet}
        actions={<button className="btn-primary" onClick={openCreateTxn}><Plus size={16} /> Add transaction</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={PiggyBank} label="Net worth" value={money(summary.netWorth, { cents: false })} tone="indigo" />
        <StatCard icon={TrendingUp} label="Income (month)" value={money(summary.month.income)} tone="emerald" />
        <StatCard icon={TrendingDown} label="Expenses (month)" value={money(summary.month.expense)} tone="rose" />
        <StatCard icon={Wallet} label="Net (month)" value={money(summary.month.net)} tone={summary.month.net < 0 ? 'red' : 'emerald'} />
      </div>

      {/* Accounts */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Accounts</h2>
          <button className="btn-secondary text-sm" onClick={openCreateAccount}><Plus size={15} /> Add account</button>
        </div>
        {accountList.length === 0 ? (
          <EmptyState icon={Wallet} title="No accounts yet" message="Add a checking, savings, or credit account to track your net worth." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accountList.map((a) => {
              const owed = OWED_TYPES.includes(a.type);
              return (
                <div key={a.id} className="card card-hover p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                      {a.institution && <p className="text-xs text-gray-500 truncate">{a.institution}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button className="btn-ghost p-1.5" aria-label="Edit account" onClick={() => openEditAccount(a)}><Pencil size={15} /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="badge badge-gray capitalize">{a.type}</span>
                    <span className={`font-bold ${owed ? 'text-red-600' : 'text-gray-900'}`}>
                      {owed ? `-${money(Math.abs(a.balance))}` : money(a.balance)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Budgets */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Budgets</h2>
          <button className="btn-secondary text-sm" onClick={openCreateBudget}><Plus size={15} /> Add budget</button>
        </div>
        {summary.budgets.length === 0 ? (
          <EmptyState icon={Wallet} title="No budgets yet" message="Set monthly limits per category to keep spending in check." />
        ) : (
          <div className="card divide-y divide-gray-100">
            {summary.budgets.map((b) => {
              const over = b.spent > b.monthly_limit;
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <span className="w-9 h-9 rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0">
                    <Icon name={b.icon || 'Wallet'} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-medium text-gray-900 capitalize truncate">{b.category}</span>
                      <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-gray-500'}`}>
                        {money(b.spent)} / {money(b.monthly_limit)}
                      </span>
                    </div>
                    <ProgressBar value={b.spent} max={b.monthly_limit} color={over ? '#f43f5e' : undefined} />
                  </div>
                  <button className="btn-ghost p-1.5 flex-shrink-0" aria-label="Edit budget" onClick={() => openEditBudget(b)}><Pencil size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cashflow */}
      <section className="space-y-3">
        <h2 className="section-label">Cashflow</h2>
        <div className="card p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={summary.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent transactions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Recent transactions</h2>
          <button className="btn-secondary text-sm" onClick={openCreateTxn}><Plus size={15} /> Add transaction</button>
        </div>
        {txnList.length === 0 ? (
          <EmptyState icon={Wallet} title="No transactions yet" message="Log income and expenses to track your cashflow." />
        ) : (
          <div className="card divide-y divide-gray-100">
            {txnList.map((t) => {
              const mem = memberById(memberList, t.member_id);
              const income = t.type === 'income';
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 truncate">{t.description || t.category || t.type}</span>
                      {t.category && <span className="badge badge-gray capitalize">{t.category}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(t.date)}</p>
                  </div>
                  {mem && <Avatar user={mem} size={28} />}
                  <span className={`font-bold ${income ? 'text-emerald-600' : 'text-red-600'}`}>
                    {income ? '+' : '-'}{money(t.amount)}
                  </span>
                  <button
                    className="btn-ghost p-1.5 text-red-500 flex-shrink-0"
                    aria-label="Delete transaction"
                    disabled={busy === t.id}
                    onClick={async () => { setBusy(t.id); try { await api.deleteTransaction(t.id); await Promise.all([refreshTxns(), refreshSummary()]); } finally { setBusy(null); } }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Account modal */}
      <Modal
        open={accountModal}
        title={accountForm.id ? 'Edit account' : 'Add account'}
        onClose={() => setAccountModal(false)}
        footer={
          <>
            {accountForm.id && <button className="btn-danger mr-auto" onClick={removeAccount} disabled={saving}><Trash2 size={16} /> Delete</button>}
            <button className="btn-secondary" onClick={() => setAccountModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveAccount} disabled={saving || !accountForm.name.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Name">
          <Input value={accountForm.name} placeholder="Main checking" onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Balance">
            <Input type="number" value={accountForm.balance}
              onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Institution">
          <Input value={accountForm.institution} placeholder="Bank name" onChange={(e) => setAccountForm({ ...accountForm, institution: e.target.value })} />
        </Field>
      </Modal>

      {/* Budget modal */}
      <Modal
        open={budgetModal}
        title={budgetForm.id ? 'Edit budget' : 'Add budget'}
        onClose={() => setBudgetModal(false)}
        footer={
          <>
            {budgetForm.id && <button className="btn-danger mr-auto" onClick={removeBudget} disabled={saving}><Trash2 size={16} /> Delete</button>}
            <button className="btn-secondary" onClick={() => setBudgetModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveBudget} disabled={saving || !budgetForm.category.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Category">
          <Input value={budgetForm.category} placeholder="Groceries" onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })} />
        </Field>
        <Field label="Monthly limit">
          <Input type="number" value={budgetForm.monthly_limit}
            onChange={(e) => setBudgetForm({ ...budgetForm, monthly_limit: e.target.value === '' ? 0 : Number(e.target.value) })} />
        </Field>
        <Field label="Icon" hint="lucide icon name, e.g. Wallet">
          <Input value={budgetForm.icon} placeholder="Wallet" onChange={(e) => setBudgetForm({ ...budgetForm, icon: e.target.value })} />
        </Field>
      </Modal>

      {/* Transaction modal */}
      <Modal
        open={txnModal}
        title="Add transaction"
        onClose={() => setTxnModal(false)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTxnModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveTxn} disabled={saving || !txnForm.amount}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={txnForm.type} onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value as Transaction['type'] })}>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </Field>
          <Field label="Amount">
            <Input type="number" value={txnForm.amount}
              onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Category">
          <Input value={txnForm.category} placeholder="Groceries" onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })} />
        </Field>
        <Field label="Description">
          <Input value={txnForm.description} placeholder="Weekly shop" onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account" hint="Optional">
            <Select value={txnForm.account_id} onChange={(e) => setTxnForm({ ...txnForm, account_id: e.target.value })}>
              <option value="">None</option>
              {accountList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={txnForm.date} onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })} />
          </Field>
        </div>
        <Field label="Member" hint="Optional">
          <Select value={txnForm.member_id} onChange={(e) => setTxnForm({ ...txnForm, member_id: e.target.value })}>
            <option value="">Whole family</option>
            {memberList.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </Select>
        </Field>
      </Modal>
    </div>
  );
}
