import StorageUsageManager from '../../components/StorageUsageManager'
import StorageWorkspace from '../../components/StorageWorkspace'
import type { MyStorageViewProps } from './myStorageViewProps'

/**
 * PC 전용 "내 저장공간" 뷰.
 *
 * 고객 파일 PC 화면과 동일한 explorer 레이아웃을 사용한다.
 */
export default function MyStoragePagePCView(props: MyStorageViewProps) {
  return (
    <StorageWorkspace
      {...props}
      variant="pc"
      layout="explorer"
      headerActionsSlot={<StorageUsageManager token={props.token} compact />}
    />
  )
}
