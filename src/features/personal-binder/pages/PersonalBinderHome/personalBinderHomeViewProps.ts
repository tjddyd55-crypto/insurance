import type { ReactNode } from 'react'
export type PersonalBinderHomeViewProps = {
  loading: boolean
  error: string
  pcContent: ReactNode
  mobileContent: ReactNode
  dialogs: ReactNode
  onCreateBinder: () => void
}
