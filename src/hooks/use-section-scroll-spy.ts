"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options<T extends string> = {
  sections: readonly T[];
  idPrefix: string;
  initialSection?: T;
  /** Called when the active section changes (click or scroll). */
  onSectionChange?: (section: T) => void;
};

export function sectionDomId(prefix: string, section: string): string {
  return `${prefix}${section}`;
}

/**
 * Stack sections on the page, highlight the one in view, scroll on nav click.
 * Shared by job card, customer, team, etc.
 */
export function useSectionScrollSpy<T extends string>({
  sections,
  idPrefix,
  initialSection,
  onSectionChange,
}: Options<T>) {
  const first = initialSection ?? sections[0]!;
  const [activeSection, setActiveSection] = useState<T>(first);
  const [prevFirst, setPrevFirst] = useState(first);
  const [mountedCount, setMountedCount] = useState(0);
  const nodesRef = useRef<Map<T, HTMLElement>>(new Map());
  const scrollingToRef = useRef<T | null>(null);
  const scrollClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(activeSection);
  const onChangeRef = useRef(onSectionChange);

  if (first !== prevFirst) {
    setPrevFirst(first);
    setActiveSection(first);
  }

  useEffect(() => {
    activeRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    onChangeRef.current = onSectionChange;
  }, [onSectionChange]);

  const setSectionRef = useCallback(
    (section: T) => (node: HTMLElement | null) => {
      if (node) {
        nodesRef.current.set(section, node);
      } else {
        nodesRef.current.delete(section);
      }
      setMountedCount(nodesRef.current.size);
    },
    [],
  );

  const scrollToSection = useCallback(
    (section: T) => {
      const node = nodesRef.current.get(section);
      setActiveSection(section);
      onChangeRef.current?.(section);
      if (!node) {
        return;
      }
      scrollingToRef.current = section;
      if (scrollClearTimer.current) {
        clearTimeout(scrollClearTimer.current);
      }
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      scrollClearTimer.current = setTimeout(() => {
        scrollingToRef.current = null;
      }, 700);
    },
    [],
  );

  useEffect(() => {
    if (!initialSection || initialSection === sections[0]) {
      return;
    }
    if (mountedCount < sections.length) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const node = nodesRef.current.get(initialSection);
      if (!node) {
        return;
      }
      scrollingToRef.current = initialSection;
      node.scrollIntoView({ behavior: "auto", block: "start" });
      scrollClearTimer.current = setTimeout(() => {
        scrollingToRef.current = null;
      }, 100);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSection, mountedCount, sections]);

  useEffect(() => {
    if (mountedCount < sections.length) {
      return;
    }

    const ratios = new Map<T, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const rawId = entry.target.id;
          if (!rawId.startsWith(idPrefix)) {
            continue;
          }
          const id = rawId.slice(idPrefix.length) as T;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        if (scrollingToRef.current) {
          return;
        }

        let best: T | null = null;
        let bestRatio = 0;
        for (const section of sections) {
          const ratio = ratios.get(section) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = section;
          }
        }
        if (!best || bestRatio <= 0 || best === activeRef.current) {
          return;
        }
        setActiveSection(best);
        onChangeRef.current?.(best);
      },
      {
        root: null,
        rootMargin: "-15% 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const section of sections) {
      const node = nodesRef.current.get(section);
      if (node) {
        observer.observe(node);
      }
    }

    return () => {
      observer.disconnect();
      if (scrollClearTimer.current) {
        clearTimeout(scrollClearTimer.current);
      }
    };
  }, [idPrefix, mountedCount, sections]);

  return {
    activeSection,
    scrollToSection,
    setSectionRef,
  };
}
