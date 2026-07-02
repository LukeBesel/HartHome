import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

// Catches render crashes so one broken page never white-screens the whole app.
// Offers a reload and a way back home; resets automatically on navigation.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  componentDidMount() {
    // Clear the error state when the user navigates (back/forward or links).
    window.addEventListener('popstate', this.reset);
  }
  componentWillUnmount() {
    window.removeEventListener('popstate', this.reset);
  }
  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Something went wrong on this page</h1>
          <p className="text-sm text-gray-500 mt-1.5">The rest of HartHome is fine — try reloading, or head back home.</p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <button className="btn-secondary" onClick={() => window.location.reload()}><RotateCcw size={15} /> Reload</button>
            <button className="btn-primary" onClick={() => { this.reset(); window.location.assign('/dashboard'); }}><Home size={15} /> Go home</button>
          </div>
        </div>
      </div>
    );
  }
}
