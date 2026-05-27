import { useCallback, useEffect, useState } from "react";

export default function useApiData(fetcher, deps = [], options = {}) {
  const { immediate = true, defaultData = null } = options;
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetcher();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || "Failed to load data");
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (immediate) {
      refresh().catch(() => {
        // Error is already reflected in state.
      });
    }
  }, [immediate, refresh]);

  return {
    data,
    loading,
    error,
    setData,
    refresh,
  };
}
