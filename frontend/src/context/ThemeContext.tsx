import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export const ACCENTS = [
  { id: 'midnight', label: 'Midnight', color: '#6366f1' },
  { id: 'rose', label: 'Rose', color: '#ec4899' },
  { id: 'teal', label: 'Teal', color: '#14b8a6' },
  { id: 'green', label: 'Garden', color: '#10b981' },
  { id: 'amber', label: 'Sunset', color: '#f59e0b' },
  { id: 'blue', label: 'Sky', color: '#3b82f6' },
  { id: 'purple', label: 'Plum', color: '#8b5cf6' },
];

interface ThemeContextValue {
  dark: boolean;
  toggleDark: () => void;
  accent: string;
  setAccent: (a: string) => void;
}
const ThemeContext = createContext<ThemeContextValue>(null!);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [accent, setAccentState] = useState(() => localStorage.getItem('hh_accent') || 'midnight');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('hh_dark_mode', String(dark));
  }, [dark]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('hh_accent', accent);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ dark, toggleDark: () => setDark(d => !d), accent, setAccent: setAccentState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
