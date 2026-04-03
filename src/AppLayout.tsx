import { Outlet } from 'react-router-dom'
import { AppExitConfirm } from './components/AppExitConfirm'
import { ThemeToggle } from './components/ThemeToggle'

export function AppLayout() {
  return (
    <>
      <AppExitConfirm />
      <ThemeToggle />
      <Outlet />
    </>
  )
}
