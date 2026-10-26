"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PageChromeState = {
  /** Extra breadcrumb / header label for detail pages (e.g. vehicle registration). */
  detailLabel: string | null;
};

type PageChromeContextValue = {
  detailLabel: string | null;
  setDetailLabel: (label: string | null) => void;
};

const PageChromeContext = createContext<PageChromeContextValue | null>(null);

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageChromeState>({ detailLabel: null });

  const setDetailLabel = useCallback((label: string | null) => {
    setState((prev) =>
      prev.detailLabel === label ? prev : { detailLabel: label },
    );
  }, []);

  const value = useMemo(
    () => ({ detailLabel: state.detailLabel, setDetailLabel }),
    [state.detailLabel, setDetailLabel],
  );

  return (
    <PageChromeContext.Provider value={value}>
      {children}
    </PageChromeContext.Provider>
  );
}

export function usePageChrome() {
  return useContext(PageChromeContext);
}

/** Sets the app-header detail crumb for the lifetime of the calling screen. */
export function usePageDetailLabel(label: string | null) {
  const chrome = usePageChrome();
  const setDetailLabel = chrome?.setDetailLabel;

  useEffect(() => {
    if (!setDetailLabel) return;
    setDetailLabel(label);
    return () => setDetailLabel(null);
  }, [label, setDetailLabel]);
}
