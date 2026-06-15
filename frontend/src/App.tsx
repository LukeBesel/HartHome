import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/shared/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const Landing   = lazy(() => import('./pages/Landing'));
const Login     = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar  = lazy(() => import('./pages/Calendar'));
const Chores    = lazy(() => import('./pages/Chores'));
const Lists     = lazy(() => import('./pages/Lists'));
const Meals     = lazy(() => import('./pages/Meals'));
const Goals     = lazy(() => import('./pages/Goals'));
const Rewards   = lazy(() => import('./pages/Rewards'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Notes     = lazy(() => import('./pages/Notes'));
const Photos    = lazy(() => import('./pages/Photos'));
const Members   = lazy(() => import('./pages/Members'));
const Bills     = lazy(() => import('./pages/Bills'));
const Budget    = lazy(() => import('./pages/Budget'));
const Utilities = lazy(() => import('./pages/Utilities'));
const Assets    = lazy(() => import('./pages/Assets'));
const Contacts  = lazy(() => import('./pages/Contacts'));
const Documents = lazy(() => import('./pages/Documents'));
const Settings  = lazy(() => import('./pages/Settings'));
const Appearance = lazy(() => import('./pages/Appearance'));
const Display    = lazy(() => import('./pages/Display'));
const Pricing   = lazy(() => import('./pages/Pricing'));
const Legal     = lazy(() => import('./pages/Legal'));

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/terms" element={<Legal kind="terms" />} />
              <Route path="/privacy" element={<Legal kind="privacy" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/display" element={<Protected><Display /></Protected>} />

              <Route element={<Protected><Layout /></Protected>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/chores" element={<Chores />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/meals" element={<Meals />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/photos" element={<Photos />} />
                <Route path="/members" element={<Members />} />
                <Route path="/bills" element={<Bills />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/utilities" element={<Utilities />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/appearance" element={<Appearance />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
