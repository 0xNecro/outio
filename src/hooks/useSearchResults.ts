import { useEffect, useState } from 'react';
import { searchDestinations } from '../lib/api';
import { enrichForView } from '../lib/view';
import type { Destination } from '../lib/types';

interface State {
  data: Destination[];
  loading: boolean;
  error: string | null;
}

export function useSearchResults(query: string, limit = 10): State {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: [], loading: true, error: null });

    searchDestinations(query, limit)
      .then((rows) => {
        if (cancelled) return;
        setState({
          data: rows.map(enrichForView),
          loading: false,
          error: null,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          data: [],
          loading: false,
          error: err.message ?? String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [query, limit]);

  return state;
}
