import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type OverflowMenuContextValue = {
  activeMenuKey: string | null
  openMenu: (menuKey: string) => void
  closeMenu: () => void
  toggleMenu: (menuKey: string) => void
  isMenuOpen: (menuKey: string) => boolean
}

const PersonalBinderOverflowMenuContext = createContext<OverflowMenuContextValue | null>(null)

export function PersonalBinderOverflowMenuProvider({ children }: { children: ReactNode }) {
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null)

  const closeMenu = useCallback(() => {
    setActiveMenuKey(null)
  }, [])

  const openMenu = useCallback((menuKey: string) => {
    setActiveMenuKey(menuKey)
  }, [])

  const toggleMenu = useCallback((menuKey: string) => {
    setActiveMenuKey((current) => (current === menuKey ? null : menuKey))
  }, [])

  const isMenuOpen = useCallback(
    (menuKey: string) => activeMenuKey === menuKey,
    [activeMenuKey],
  )

  const value = useMemo(
    () => ({
      activeMenuKey,
      openMenu,
      closeMenu,
      toggleMenu,
      isMenuOpen,
    }),
    [activeMenuKey, closeMenu, isMenuOpen, openMenu, toggleMenu],
  )

  return (
    <PersonalBinderOverflowMenuContext.Provider value={value}>
      {children}
    </PersonalBinderOverflowMenuContext.Provider>
  )
}

export function usePersonalBinderOverflowMenu() {
  return useContext(PersonalBinderOverflowMenuContext)
}
