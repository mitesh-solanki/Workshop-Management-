"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options<T extends string> = {
  sections: readonly T[];
  idPrefix: string;
  initialSection?: T;
  /**
   * Fired only when the user clicks the nav (or we deep-link once on load).
   * Never fired while the user is scrolling by hand — that only updates highlight.
   */
  onNavigate?: (section: T) => void;
};

export function sectionDomId(prefix: string, section: string): string {
  return `${prefix}${section}`;
}

function getNearestScrollRoot(el: Element | null): HTMLElement | null {
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      if (
        (overflowY === "auto" ||
          overflowY === "scroll" ||
          overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

/** Section whose top is at / just above the reading line (near top of scroll pane). */
function sectionAtReadingLine<T extends string>(
  sections: readonly T[],
  nodes: Map<T, HTMLElement>,
  root: HTMLElement | null,
): T | null {
  const rootTop = root ? root.getBoundingClientRect().top : 0;
  // Match sticky aside offset: mobile ~ top-0 + nav, desktop ~ top-4.
  const readingLine = rootTop + 96;

  let current: T | null = null;
  for (const section of sections) {
    const node = nodes.get(section);
    if (!node) continue;
    if (node.getBoundingClientRect().top <= readingLine) {
      current = section;
    }
  }
  return current ?? sections[0] ?? null;
}

/**
 * Click nav → scroll that section to the top + highlight.
 * Manual scroll → highlight only (never jumps, never updates URL).
 */
export function useSectionScrollSpy<T extends string>({
  sections,
  idPrefix,
  initialSection,
  onNavigate,
}: Options<T>) {
  const start = initialSection ?? sections[0]!;
  const [activeSection, setActiveSection] = useState<T>(start);
  const [mountedCount, setMountedCount] = useState(0);
  const nodesRef = useRef<Map<T, HTMLElement>>(new Map());
  const activeRef = useRef(activeSection);
  const onNavigateRef = useRef(onNavigate);
  const programmaticRef = useRef(false);
  const programClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkedRef = useRef(false);

  useEffect(() => {
    activeRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

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

  const scrollToSection = useCallback((section: T) => {
    const node = nodesRef.current.get(section);
    setActiveSection(section);
    onNavigateRef.current?.(section);
    if (!node) {
      return;
    }

    programmaticRef.current = true;
    if (programClearTimer.current) {
      clearTimeout(programClearTimer.current);
    }
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    programClearTimer.current = setTimeout(() => {
      programmaticRef.current = false;
    }, 1000);
  }, []);

  // Deep link `?section=` once after sections mount — never again on URL churn.
  useEffect(() => {
    if (deepLinkedRef.current) {
      return;
    }
    if (!initialSection || initialSection === sections[0]) {
      deepLinkedRef.current = true;
      return;
    }
    if (mountedCount < sections.length) {
      return;
    }

    const node = nodesRef.current.get(initialSection);
    if (!node) {
      return;
    }

    deepLinkedRef.current = true;
    setActiveSection(initialSection);
    programmaticRef.current = true;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "auto", block: "start" });
      programClearTimer.current = setTimeout(() => {
        programmaticRef.current = false;
      }, 200);
    });
  }, [initialSection, mountedCount, sections]);

  // Manual scroll: highlight only.
  useEffect(() => {
    if (mountedCount < sections.length) {
      return;
    }

    const firstNode = nodesRef.current.get(sections[0]!);
    const root = getNearestScrollRoot(firstNode ?? null);
    const target: HTMLElement | Window = root ?? window;

    const updateHighlight = () => {
      if (programmaticRef.current) {
        return;
      }
      const next = sectionAtReadingLine(sections, nodesRef.current, root);
      if (!next || next === activeRef.current) {
        return;
      }
      setActiveSection(next);
    };

    updateHighlight();
    target.addEventListener("scroll", updateHighlight, { passive: true });
    window.addEventListener("resize", updateHighlight, { passive: true });

    return () => {
      target.removeEventListener("scroll", updateHighlight);
      window.removeEventListener("resize", updateHighlight);
      if (programClearTimer.current) {
        clearTimeout(programClearTimer.current);
      }
    };
  }, [mountedCount, sections]);

  return {
    activeSection,
    scrollToSection,
    setSectionRef,
  };
}
