import type { ReactNode } from 'react'
import { FormButton } from '../../components/form'
import { useLegalPageNavigation } from './useLegalPageNavigation'
import './legal-page-shell.css'

type LegalPageShellProps = {
  title: string
  /** 본문 스크롤 영역 id (맨 위로 앵커) */
  pageId?: string
  children: ReactNode
}

/**
 * 정책·안내 standalone 페이지 공통 셸.
 * PC 프로그램/WebView에서 브라우저 chrome 없이도 복귀 가능하도록
 * 상단 뒤로가기·닫기를 고정 제공한다.
 */
export default function LegalPageShell({ title, pageId, children }: LegalPageShellProps) {
  const { goBack, close } = useLegalPageNavigation()

  return (
    <div className="legal-page-shell">
      <header className="legal-page-shell__header" role="banner">
        <FormButton
          htmlType="button"
          variant="secondary"
          className="legal-page-shell__nav-btn legal-page-shell__nav-btn--back"
          aria-label="뒤로가기"
          onClick={goBack}
        >
          <span className="legal-page-shell__nav-icon" aria-hidden="true">
            ←
          </span>
          <span className="legal-page-shell__nav-label">뒤로가기</span>
        </FormButton>
        <h1 className="legal-page-shell__title">{title}</h1>
        <FormButton
          htmlType="button"
          variant="secondary"
          className="legal-page-shell__nav-btn legal-page-shell__nav-btn--close"
          aria-label="닫기"
          title="CRM으로 돌아가기"
          onClick={close}
        >
          닫기
        </FormButton>
      </header>
      <div className="legal-page-shell__body" id={pageId}>
        {children}
      </div>
    </div>
  )
}
