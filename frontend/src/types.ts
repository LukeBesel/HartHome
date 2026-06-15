export type Role = 'owner' | 'parent' | 'member' | 'child';

export interface User {
  id: string;
  email?: string | null;
  display_name: string;
  role: Role;
  avatar_color: string;
  points: number;
  birthday?: string | null;
  household_id?: string;
  household_name?: string;
  household?: Household;
  is_active?: number;
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
  accent: string;
  address: string;
  invite_code: string;
}

export interface EventItem {
  id: string; title: string; description: string; location: string;
  start_at: string; end_at?: string | null; all_day: number;
  member_id?: string | null; color: string; category: string; recurrence: string;
}

export interface Chore {
  id: string; title: string; description: string; assignee_id?: string | null;
  points: number; recurrence: string; day_of_week?: number | null;
  due_date?: string | null; status: 'todo' | 'done'; last_completed_at?: string | null; icon: string;
}

export interface Goal {
  id: string; title: string; description: string; category: string;
  target: number; current: number; unit: string; member_id?: string | null;
  due_date?: string | null; status: 'active' | 'done' | 'archived';
}

export interface Reward {
  id: string; title: string; description: string; cost: number; icon: string; stock: number; active: number;
}
export interface Redemption {
  id: string; reward_id: string; reward_title: string; member_id: string; cost: number;
  status: 'pending' | 'approved' | 'fulfilled' | 'denied'; created_at: string;
}

export interface ListBoard { id: string; name: string; type: string; icon: string; color: string; }
export interface ListItem {
  id: string; list_id: string; name: string; qty: string; category: string;
  note: string; assignee_id?: string | null; done: number; sort: number;
}

export interface Recipe {
  id: string; name: string; description: string; ingredients: string;
  instructions: string; prep_minutes: number; servings: number; tags: string;
}
export interface Meal {
  id: string; date: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  title: string; notes: string; recipe_id?: string | null;
}

export interface Bill {
  id: string; name: string; amount: number; category: string;
  frequency: string; next_due?: string | null; autopay: number; account: string;
  member_id?: string | null; status: 'upcoming' | 'paid' | 'overdue'; notes: string;
}

export interface Account { id: string; name: string; type: string; balance: number; institution: string; }
export interface Transaction {
  id: string; type: 'income' | 'expense' | 'transfer'; amount: number; category: string;
  description: string; account_id?: string | null; member_id?: string | null; date: string;
}
export interface Budget { id: string; category: string; monthly_limit: number; icon: string; spent?: number; }

export interface Utility {
  id: string; name: string; provider: string; type: string; account_number: string;
  monthly_estimate: number; unit: string; contact: string;
}
export interface UtilityReading { id: string; utility_id: string; reading: number; cost: number; period: string; recorded_at: string; }

export interface Asset {
  id: string; name: string; type: string; make: string; model: string; year?: number | null;
  identifier: string; purchase_date?: string | null; purchase_price: number; current_value: number;
  mileage?: number | null; warranty_expires?: string | null; location: string; notes: string; icon: string;
}
export interface Maintenance {
  id: string; asset_id: string; title: string; type: string; due_date?: string | null;
  due_mileage?: number | null; completed_at?: string | null; cost: number; provider: string;
  recurrence_months: number; recurrence_miles: number; status: 'upcoming' | 'overdue' | 'done'; notes: string;
  asset_name?: string;
}

export interface Contact {
  id: string; name: string; relationship: string; category: string;
  phone: string; email: string; address: string; notes: string;
}
export interface Note { id: string; title: string; body: string; color: string; pinned: number; author_id?: string | null; updated_at: string; }
export interface DocItem { id: string; name: string; category: string; reference: string; expires_at?: string | null; notes: string; }
export interface Device { id: string; name: string; type: string; pairing_code: string; widgets: string; rotate_seconds: number; }
export interface Announcement { id: string; body: string; author_id?: string | null; author_name?: string; avatar_color?: string; created_at: string; }
export interface ActivityItem { id: string; member_id?: string | null; member_name: string; type: string; message: string; created_at: string; }
export interface Photo { id: string; url: string; caption: string; sort: number; created_at: string; }
export interface Reminder { id: string; type: string; icon: string; title: string; subtitle: string; severity: 'overdue' | 'today' | 'soon'; link: string; date: string; }
export interface RemindersResponse { count: number; overdue: number; items: Reminder[]; }

export interface ThemePrefs {
  mode: 'system' | 'light' | 'dark';
  accent: string;
  secondary: string;
  sidebar: 'midnight' | 'ink' | 'tinted' | 'black' | 'plum' | 'forest';
  density: 'comfortable' | 'compact';
  fontScale: 'sm' | 'md' | 'lg';
  radius: 'sharp' | 'rounded' | 'xl';
  wallpaper: 'plain' | 'aurora' | 'mesh';
}
export interface DashboardWidgetPref { id: string; enabled: boolean; }
export interface DisplayPrefs {
  widgets: string[];
  background: 'aurora' | 'photo' | 'solid' | 'gradient';
  clock24: boolean;
  showWeather: boolean;
  photoInterval: number;
}
export interface Prefs {
  theme?: Partial<ThemePrefs>;
  dashboard?: { widgets?: DashboardWidgetPref[]; config?: Record<string, Record<string, string>> };
  display?: Partial<DisplayPrefs>;
  nav?: { hidden?: string[] };
}

export interface DashboardData {
  today: string;
  members: User[];
  todayEvents: EventItem[];
  upcomingEvents: EventItem[];
  choresDue: Chore[];
  billsDue: Bill[];
  goals: Goal[];
  maintenanceDue: Maintenance[];
  groceryLists: (ListBoard & { open_items: number })[];
  activity: ActivityItem[];
  announcements: Announcement[];
  notes: Note[];
  birthdays: User[];
  finance: { netWorth: number; monthSpend: number; monthIncome: number; billsTotal: number };
  counts: { chores: number; bills: number; events: number; grocery: number };
}
