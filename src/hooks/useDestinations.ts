import { useEffect, useState } from 'react';
import { listDestinations, type QuickTag } from '../lib/api';
import { enrichForView } from '../lib/view';
import type { Destination } from '../lib/types';

interface State {
  data: Destination[];
  loading: boolean;
  error: string | null;
}

export function useDestinations(opts: {
  city?: string;
  filters?: readonly QuickTag[];
  search?: string;
}): State {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
  });

  // filters 数组每次渲染是新引用，序列化作为 dep 避免无限请求
  const filtersKey = (opts.filters ?? []).slice().sort().join('|');
  const search = opts.search ?? '';
  const city = opts.city;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    listDestinations({ city, filters: opts.filters, search })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, filtersKey, search]);

  return state;
}
