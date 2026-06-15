import type {
  User, Household, EventItem, Chore, Goal, Reward, Redemption, ListBoard, ListItem,
  Recipe, Meal, Bill, Account, Transaction, Budget, Utility, UtilityReading,
  Asset, Maintenance, Contact, Note, DocItem, Device, Announcement, ActivityItem, DashboardData, Photo,
  RemindersResponse,
} from '../types';

const BASE = '/api';
const TOKEN_KEY = 'hh_token';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options?.headers) Object.assign(headers, options.headers);

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const err = await res.json().catch(() => ({ code: 'INVALID_TOKEN' }));
    if (err.code === 'INVALID_TOKEN' || err.code === 'NO_TOKEN') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('hh_user');
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    throw Object.assign(new Error(err.message || err.error || 'Not authenticated'), { status: 401, data: err });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.message || err.error || 'Request failed'), { status: res.status, data: err });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const qs = (params?: Record<string, any>) => {
  if (!params) return '';
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
};

// Generic CRUD helpers so the client mirrors the server's resource pattern.
const get = <T>(p: string, params?: Record<string, any>) => request<T>(`${p}${qs(params)}`);
const post = <T>(p: string, body?: any) => request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });
const put = <T>(p: string, body: any) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) });
const del = <T = { ok: boolean }>(p: string) => request<T>(p, { method: 'DELETE' });

export const api = {
  // ── Auth ──
  signup: (b: { householdName: string; displayName: string; email: string; password: string }) =>
    post<{ token: string; user: User }>('/auth/signup', b),
  joinHousehold: (b: { inviteCode: string; displayName: string; email: string; password: string }) =>
    post<{ token: string; user: User }>('/auth/join', b),
  lookupInvite: (code: string) => get<{ household_name: string }>(`/auth/invite/${encodeURIComponent(code)}`),
  login: (email: string, password: string) => post<{ token: string; user: User }>('/auth/login', { email, password }),
  demo: () => post<{ token: string; user: User; demo: boolean }>('/auth/demo'),
  profiles: () => get<(User & { has_pin: boolean })[]>('/auth/profiles'),
  setPin: (member_id: string | null, pin: string | null) => post<{ ok: boolean; has_pin: boolean }>('/auth/set-pin', { member_id, pin }),
  logout: () => post('/auth/logout'),
  me: () => get<User>('/auth/me'),
  switchProfile: (member_id: string, pin?: string) => post<{ token: string; user: User }>('/auth/switch-profile', { member_id, pin }),
  changePassword: (currentPassword: string, newPassword: string) => post('/auth/change-password', { currentPassword, newPassword }),

  // ── Dashboard ──
  dashboard: () => get<DashboardData>('/dashboard'),
  leaderboard: (period?: string) => get<any[]>('/dashboard/leaderboard', { period }),

  // ── Members / household ──
  members: () => get<User[]>('/members'),
  createMember: (b: Partial<User> & { password?: string }) => post<User>('/members', b),
  updateMember: (id: string, b: Partial<User>) => put<User>(`/members/${id}`, b),
  deleteMember: (id: string) => del(`/members/${id}`),
  household: () => get<Household>('/members/household/info'),
  updateHousehold: (b: Partial<Household>) => put<Household>('/members/household/info', b),
  regenerateInvite: () => post<{ invite_code: string }>('/members/household/regenerate-invite'),

  // ── Events ──
  events: (params?: Record<string, any>) => get<EventItem[]>('/events', params),
  createEvent: (b: Partial<EventItem>) => post<EventItem>('/events', b),
  updateEvent: (id: string, b: Partial<EventItem>) => put<EventItem>(`/events/${id}`, b),
  deleteEvent: (id: string) => del(`/events/${id}`),

  // ── Chores ──
  chores: (params?: Record<string, any>) => get<Chore[]>('/chores', params),
  createChore: (b: Partial<Chore>) => post<Chore>('/chores', b),
  updateChore: (id: string, b: Partial<Chore>) => put<Chore>(`/chores/${id}`, b),
  deleteChore: (id: string) => del(`/chores/${id}`),
  completeChore: (id: string, member_id?: string) => post<any>(`/chores/${id}/complete`, { member_id }),
  reopenChore: (id: string) => post(`/chores/${id}/reopen`),

  // ── Goals ──
  goals: (params?: Record<string, any>) => get<Goal[]>('/goals', params),
  createGoal: (b: Partial<Goal>) => post<Goal>('/goals', b),
  updateGoal: (id: string, b: Partial<Goal>) => put<Goal>(`/goals/${id}`, b),
  deleteGoal: (id: string) => del(`/goals/${id}`),
  goalProgress: (id: string, b: { current?: number; delta?: number }) => post<Goal>(`/goals/${id}/progress`, b),

  // ── Rewards ──
  rewards: (params?: Record<string, any>) => get<Reward[]>('/rewards', params),
  createReward: (b: Partial<Reward>) => post<Reward>('/rewards', b),
  updateReward: (id: string, b: Partial<Reward>) => put<Reward>(`/rewards/${id}`, b),
  deleteReward: (id: string) => del(`/rewards/${id}`),
  redeemReward: (id: string, member_id?: string) => post<any>(`/rewards/${id}/redeem`, { member_id }),
  redemptions: () => get<Redemption[]>('/rewards/redemptions/all'),
  updateRedemption: (id: string, status: string) => put<Redemption>(`/rewards/redemptions/${id}`, { status }),

  // ── Lists ──
  lists: () => get<ListBoard[]>('/lists'),
  createList: (b: Partial<ListBoard>) => post<ListBoard>('/lists', b),
  updateList: (id: string, b: Partial<ListBoard>) => put<ListBoard>(`/lists/${id}`, b),
  deleteList: (id: string) => del(`/lists/${id}`),
  listItems: (list_id: string) => get<ListItem[]>('/lists/items', { list_id }),
  createListItem: (b: Partial<ListItem>) => post<ListItem>('/lists/items', b),
  updateListItem: (id: string, b: Partial<ListItem>) => put<ListItem>(`/lists/items/${id}`, b),
  deleteListItem: (id: string) => del(`/lists/items/${id}`),
  clearDone: (list_id: string) => del(`/lists/${list_id}/clear-done`),

  // ── Meals & recipes ──
  meals: (params?: Record<string, any>) => get<Meal[]>('/meals', params),
  createMeal: (b: Partial<Meal>) => post<Meal>('/meals', b),
  updateMeal: (id: string, b: Partial<Meal>) => put<Meal>(`/meals/${id}`, b),
  deleteMeal: (id: string) => del(`/meals/${id}`),
  recipes: () => get<Recipe[]>('/meals/recipes'),
  createRecipe: (b: Partial<Recipe>) => post<Recipe>('/meals/recipes', b),
  updateRecipe: (id: string, b: Partial<Recipe>) => put<Recipe>(`/meals/recipes/${id}`, b),
  deleteRecipe: (id: string) => del(`/meals/recipes/${id}`),
  mealsToGrocery: (start: string, end: string) => post<{ added: number; list_id: string }>('/meals/grocery', { start, end }),

  // ── Bills ──
  bills: (params?: Record<string, any>) => get<Bill[]>('/bills', params),
  createBill: (b: Partial<Bill>) => post<Bill>('/bills', b),
  updateBill: (id: string, b: Partial<Bill>) => put<Bill>(`/bills/${id}`, b),
  deleteBill: (id: string) => del(`/bills/${id}`),
  payBill: (id: string, b?: { amount?: number; note?: string }) => post<Bill>(`/bills/${id}/pay`, b),

  // ── Finance ──
  financeSummary: () => get<any>('/finance/summary'),
  accounts: () => get<Account[]>('/finance/accounts'),
  createAccount: (b: Partial<Account>) => post<Account>('/finance/accounts', b),
  updateAccount: (id: string, b: Partial<Account>) => put<Account>(`/finance/accounts/${id}`, b),
  deleteAccount: (id: string) => del(`/finance/accounts/${id}`),
  transactions: (params?: Record<string, any>) => get<Transaction[]>('/finance/transactions', params),
  createTransaction: (b: Partial<Transaction>) => post<Transaction>('/finance/transactions', b),
  updateTransaction: (id: string, b: Partial<Transaction>) => put<Transaction>(`/finance/transactions/${id}`, b),
  deleteTransaction: (id: string) => del(`/finance/transactions/${id}`),
  budgets: () => get<Budget[]>('/finance/budgets'),
  createBudget: (b: Partial<Budget>) => post<Budget>('/finance/budgets', b),
  updateBudget: (id: string, b: Partial<Budget>) => put<Budget>(`/finance/budgets/${id}`, b),
  deleteBudget: (id: string) => del(`/finance/budgets/${id}`),

  // ── Utilities ──
  utilities: () => get<Utility[]>('/utilities'),
  createUtility: (b: Partial<Utility>) => post<Utility>('/utilities', b),
  updateUtility: (id: string, b: Partial<Utility>) => put<Utility>(`/utilities/${id}`, b),
  deleteUtility: (id: string) => del(`/utilities/${id}`),
  readings: (utility_id: string) => get<UtilityReading[]>('/utilities/readings', { utility_id }),
  createReading: (b: Partial<UtilityReading>) => post<UtilityReading>('/utilities/readings', b),
  deleteReading: (id: string) => del(`/utilities/readings/${id}`),

  // ── Assets & maintenance ──
  assets: (params?: Record<string, any>) => get<Asset[]>('/assets', params),
  createAsset: (b: Partial<Asset>) => post<Asset>('/assets', b),
  updateAsset: (id: string, b: Partial<Asset>) => put<Asset>(`/assets/${id}`, b),
  deleteAsset: (id: string) => del(`/assets/${id}`),
  maintenance: (params?: Record<string, any>) => get<Maintenance[]>('/assets/maintenance', params),
  createMaintenance: (b: Partial<Maintenance>) => post<Maintenance>('/assets/maintenance', b),
  updateMaintenance: (id: string, b: Partial<Maintenance>) => put<Maintenance>(`/assets/maintenance/${id}`, b),
  deleteMaintenance: (id: string) => del(`/assets/maintenance/${id}`),
  completeMaintenance: (id: string, b?: { cost?: number; mileage?: number }) => post(`/assets/maintenance/${id}/complete`, b),

  // ── Contacts / notes / documents ──
  contacts: (params?: Record<string, any>) => get<Contact[]>('/contacts', params),
  createContact: (b: Partial<Contact>) => post<Contact>('/contacts', b),
  updateContact: (id: string, b: Partial<Contact>) => put<Contact>(`/contacts/${id}`, b),
  deleteContact: (id: string) => del(`/contacts/${id}`),
  notes: () => get<Note[]>('/notes'),
  createNote: (b: Partial<Note>) => post<Note>('/notes', b),
  updateNote: (id: string, b: Partial<Note>) => put<Note>(`/notes/${id}`, b),
  deleteNote: (id: string) => del(`/notes/${id}`),
  documents: () => get<DocItem[]>('/documents'),
  createDocument: (b: Partial<DocItem>) => post<DocItem>('/documents', b),
  updateDocument: (id: string, b: Partial<DocItem>) => put<DocItem>(`/documents/${id}`, b),
  deleteDocument: (id: string) => del(`/documents/${id}`),

  // ── Devices & announcements ──
  devices: () => get<Device[]>('/devices'),
  createDevice: (b: Partial<Device>) => post<Device>('/devices', b),
  updateDevice: (id: string, b: Partial<Device>) => put<Device>(`/devices/${id}`, b),
  deleteDevice: (id: string) => del(`/devices/${id}`),
  announcements: () => get<Announcement[]>('/announcements'),
  createAnnouncement: (body: string) => post<Announcement>('/announcements', { body }),
  deleteAnnouncement: (id: string) => del(`/announcements/${id}`),
  activity: () => get<ActivityItem[]>('/announcements/activity/feed'),

  // ── Reminders ──
  reminders: () => get<RemindersResponse>('/reminders'),

  // ── Photos ──
  photos: () => get<Photo[]>('/photos'),
  createPhoto: (b: Partial<Photo>) => post<Photo>('/photos', b),
  updatePhoto: (id: string, b: Partial<Photo>) => put<Photo>(`/photos/${id}`, b),
  deletePhoto: (id: string) => del(`/photos/${id}`),
};

export type Api = typeof api;
