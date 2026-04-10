import { create } from 'zustand';
import { addDays, subDays } from 'date-fns';

// Sensible default bounds: 2 years back, 5 years forward from today
const today = new Date();
const DEFAULT_VIEW_START = subDays(today, 365 * 2);
const DEFAULT_VIEW_END   = addDays(today, 365 * 5);

interface ViewStore {
  scrollLeft: number;
  scrollTop: number;
  viewStart: Date;
  viewEnd: Date;
  setScrollLeft: (v: number) => void;
  setScrollTop: (v: number) => void;
  syncScroll: (left: number, top: number) => void;
  /** Extend the left bound by `days` days, adjusting scrollLeft to avoid visual jump. */
  extendLeft: (days: number, colW: number) => void;
  /** Extend the right bound by `days` days. */
  extendRight: (days: number) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  scrollLeft: 0,
  scrollTop: 0,
  viewStart: DEFAULT_VIEW_START,
  viewEnd: DEFAULT_VIEW_END,
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
  setScrollTop:  (scrollTop)  => set({ scrollTop }),
  syncScroll: (scrollLeft, scrollTop) => set({ scrollLeft, scrollTop }),
  extendLeft: (days, colW) => set(s => ({
    viewStart: subDays(s.viewStart, days),
    scrollLeft: s.scrollLeft + days * colW,
  })),
  extendRight: (days) => set(s => ({
    viewEnd: addDays(s.viewEnd, days),
  })),
}));
