import { create } from 'zustand';

interface SelectionStore {
  selectedIds: Set<string>;
  activeTaskId: string | null;
  isPanelOpen: boolean;

  select: (id: string) => void;
  deselect: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectOnly: (id: string) => void;
  clearSelection: () => void;
  openPanel: (id: string) => void;
  closePanel: () => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedIds: new Set(),
  activeTaskId: null,
  isPanelOpen: false,

  select: (id) => set(s => ({ selectedIds: new Set([...s.selectedIds, id]) })),
  deselect: (id) => set(s => {
    const next = new Set(s.selectedIds);
    next.delete(id);
    return { selectedIds: next };
  }),
  toggleSelect: (id) => set(s => {
    const next = new Set(s.selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedIds: next };
  }),
  selectOnly: (id) => set({ selectedIds: new Set([id]) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  openPanel: (id) => set({ activeTaskId: id, isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false, activeTaskId: null }),
}));
