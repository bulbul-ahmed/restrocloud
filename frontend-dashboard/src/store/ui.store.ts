import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  openMobileSidebar: () => set({ sidebarMobileOpen: true }),

  closeMobileSidebar: () => set({ sidebarMobileOpen: false }),
}))
