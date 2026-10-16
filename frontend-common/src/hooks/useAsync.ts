import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload(): void;
  setData(value: T | null): void;
}

/** Carga datos asíncronos y expone `reload` (descarta respuestas obsoletas). */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const callId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (id === callId.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === callId.current) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
  }, [load, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}
