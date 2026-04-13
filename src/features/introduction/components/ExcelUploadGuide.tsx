type Props = {
  onDownloadSample: () => void
}

const EXCEL_STEPS = [
  '아래 샘플 파일 다운로드 버튼을 눌러 템플릿을 저장한다.',
  '엑셀 파일에 고객 정보를 입력한다.',
  '앱 또는 웹에서 연락처 업로드 메뉴로 이동한다.',
  '작성한 파일을 선택해 업로드한다.',
]

export function ExcelUploadGuide({ onDownloadSample }: Props) {
  return (
    <section className="intro-card">
      <h2 className="intro-section-title">연락처 엑셀 업로드 방법</h2>
      <p className="intro-muted">
        연락처 일괄 업로드는 제공되는 샘플 형식과 동일하게 작성해야 정상 처리됩니다.
      </p>

      <ol className="intro-steps">
        {EXCEL_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="intro-alert-box">
        <strong>중요:</strong> 컬럼명, 순서, 빈칸 규칙이 다르면 업로드에 실패할 수 있습니다.
      </div>

      <button type="button" className="intro-btn intro-btn--secondary" onClick={onDownloadSample}>
        샘플 파일 다운로드
      </button>
    </section>
  )
}
