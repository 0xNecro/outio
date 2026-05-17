import { useEffect, useState } from 'react';
import { searchByDistance, HOME_COORDS, DEFAULT_MAX_DISTANCE_METERS } from '../lib/api';
import { enrichForView } from '../lib/view';
import type { Destination } from '../lib/types';

interface State {
  data: Destination[];
  loading: boolean;
  error: string | null;
}

// Home 页用：以家坐标为中心按距离从近到远拉默认推荐
// filters / search 留作未来扩展（目前 Home 的 QuickTag 是 navigate 到 /search，不会带参数进来）
export function useDestinations(opts: {
  lat?: number;
  lng?: number;
  maxDistanceMeters?: number;
  limit?: number;
}): State {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    error: null,
  });

  const lat = opts.lat ?? HOME_COORDS.lat;
  const lng = opts.lng ?? HOME_COORDS.lng;
  const maxDist = opts.maxDistanceMeters ?? DEFAULT_MAX_DISTANCE_METERS;
  const limit = opts.limit ?? 20;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    searchByDistance({ lat, lng, maxDistanceMeters: maxDist, limit })
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
  }, [lat, lng, maxDist, limit]);

  return state;
}
