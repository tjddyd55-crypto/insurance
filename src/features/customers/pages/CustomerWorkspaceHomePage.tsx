import { useOutletContext } from 'react-router-dom'

type CustomerWorkspaceOutletContext = {
  selectedCustomerId: number | null
}

export default function CustomerWorkspaceHomePage() {
  const { selectedCustomerId } = useOutletContext<CustomerWorkspaceOutletContext>()

  return (
    <section className="customer-workspace-home">
      <h3 className="customer-workspace-home__title">우측 작업영역</h3>
      <p className="customer-workspace-home__desc">
        좌측 고객 목록에서 고객을 선택한 뒤, 상단 버튼으로 파일/상담/신청서 작업을 진행하세요.
      </p>
      <p className="customer-workspace-home__selected">
        현재 선택 고객: {selectedCustomerId ? `#${selectedCustomerId}` : '없음'}
      </p>
    </section>
  )
}
