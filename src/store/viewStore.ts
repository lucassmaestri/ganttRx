import { create } from 'zustand';

interface ViewStore {
  scrollLeft: number;
  scrollTop: number;
  setScrollLeft: (v: number) => void;
  setScrollTop: (v: number) => void;
  syncScroll: (left: number, top: number) => void;
}

export const useViewStore = create<ViewStore>((set) => ({
  scrollLeft: 0,
  scrollTop: 0,
  setScrollLeft: (scrollLeft) => set({ scrollLeft }),
  setScrollTop: (scrollTop) => set({ scrollTop }),
  syncScroll: (scrollLeft, scrollTop) => set({ scrollLeft, scrollTop }),
}));
