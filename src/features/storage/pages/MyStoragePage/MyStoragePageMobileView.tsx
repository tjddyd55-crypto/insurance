import StorageUsageManager from '../../components/StorageUsageManager'
import StorageWorkspace from '../../components/StorageWorkspace'
import type { MyStorageViewProps } from './myStorageViewProps'

export default function MyStoragePageMobileView(props: MyStorageViewProps) {
  return (
    <StorageWorkspace
      {...props}
      variant="mobile"
      layout="legacy"
      headerActionsSlot={<StorageUsageManager token={props.token} compact />}
    />
  )
}
