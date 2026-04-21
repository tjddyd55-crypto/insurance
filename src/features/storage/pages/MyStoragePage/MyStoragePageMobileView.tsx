import StorageWorkspace from '../../components/StorageWorkspace'
import type { MyStorageViewProps } from './myStorageViewProps'

/** 모바일 전용 "내 저장공간" 뷰. PC 뷰와 대칭으로 variant 만 다르게 고정한다. */
export default function MyStoragePageMobileView(props: MyStorageViewProps) {
  return <StorageWorkspace {...props} variant="mobile" />
}
