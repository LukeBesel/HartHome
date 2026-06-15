import { useCallback, useEffect, useState } from 'react';

// Tiny data-fetching hook with manual refresh. Pages pass a loader function and
// get back { data, loading, error, refresh, setData } — enough for the simple,
// optimistic CRUD screens throughout HartHome.
export function useAsync<T>(loader: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    return loader()
      .then((d) => { setData(d); setError(null); return d; })
      .catch((e) => { setError(e.message || 'Failed to load'); throw e; })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  return { data, setData, loading, error, refresh };
}
