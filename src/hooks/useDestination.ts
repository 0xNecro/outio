import { useEffect, useState } from 'react';
import { getDestination } from '../lib/api';
import { enrichForView } from '../lib/view';
import type { Destination } from '../lib/types';

interface State {
  data: Destination | null;
  loading: boolean;
  error: string | null;
}

export function useDestination(id?: string): State {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: '缺少 id' });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    getDestination(id)
      .then((d) => {
        if (cancelled) return;
        setState({
          data: d ? enrichForView(d) : null,
          loading: false,
          error: null,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: err.message ?? String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
