import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from './api';

interface ApiState<T> {
  data: T | undefined;
  error: string | null;
}

/** Loads `path` on mount (and whenever `reload` is called). Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({ data: undefined, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    api.get<T>(path).then(
      data => { if (active) setState({ data, error: null }); },
      err => { if (active) setState(prev => ({ ...prev, error: errorMessage(err) })); },
    );
    return () => { active = false; };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  const setData = useCallback((update: (prev: T | undefined) => T) => {
    setState(prev => ({ ...prev, data: update(prev.data) }));
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.data === undefined && state.error === null,
    reload,
    setData,
  };
}
