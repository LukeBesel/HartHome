import {
  LayoutDashboard, CalendarDays, CheckSquare, ListChecks, UtensilsCrossed,
  Target, Gift, Users, StickyNote,
  Receipt, Wallet, Zap,
  Car, Phone, FileText, Trophy, Image,
} from 'lucide-react';

export type NavItem = { to: string; icon: React.ElementType; label: string; exact?: boolean; parentOnly?: boolean };
export type NavSection = { id: string; label: string; items: NavItem[] };

export const SECTIONS: NavSection[] = [
  {
    id: 'daily', label: 'Daily',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Home', exact: true },
      { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
      { to: '/chores', icon: CheckSquare, label: 'Chores' },
      { to: '/lists', icon: ListChecks, label: 'Lists & Groceries' },
      { to: '/meals', icon: UtensilsCrossed, label: 'Meal Plan' },
    ],
  },
  {
    id: 'family', label: 'Family',
    items: [
      { to: '/goals', icon: Target, label: 'Goals' },
      { to: '/rewards', icon: Gift, label: 'Rewards' },
      { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
      { to: '/notes', icon: StickyNote, label: 'Notes & Bulletin' },
      { to: '/photos', icon: Image, label: 'Photos' },
      { to: '/members', icon: Users, label: 'Family' },
    ],
  },
  {
    id: 'money', label: 'Money',
    items: [
      { to: '/bills', icon: Receipt, label: 'Bills' },
      { to: '/budget', icon: Wallet, label: 'Budget' },
      { to: '/utilities', icon: Zap, label: 'Utilities' },
    ],
  },
  {
    id: 'home', label: 'Home & Property',
    items: [
      { to: '/assets', icon: Car, label: 'Assets & Maintenance' },
      { to: '/contacts', icon: Phone, label: 'Contacts' },
      { to: '/documents', icon: FileText, label: 'Documents' },
    ],
  },
];

export const ALL_ITEMS = SECTIONS.flatMap(s => s.items);
