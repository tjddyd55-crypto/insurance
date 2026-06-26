import ResponsiveLayout from '../../../components/ResponsiveLayout'
import {
  useUserInsurerAccountsState,
  type UserInsurerAccountsViewProps,
} from '../hooks/useUserInsurerAccountsState'
import UserInsurerAccountsPCView from './user-insurer-accounts/UserInsurerAccountsPCView'
import UserInsurerAccountsMobileView from './user-insurer-accounts/UserInsurerAccountsMobileView'

export default function UserInsurerAccountsPage() {
  const viewProps = useUserInsurerAccountsState()

  return (
    <ResponsiveLayout<UserInsurerAccountsViewProps>
      PC={UserInsurerAccountsPCView}
      Mobile={UserInsurerAccountsMobileView}
      viewProps={viewProps}
    />
  )
}
