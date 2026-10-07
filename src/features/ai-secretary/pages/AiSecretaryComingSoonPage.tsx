import './ai-secretary-coming-soon.css'

export function AiSecretaryComingSoonPage() {
  return (
    <main className="page ai-secretary-coming-soon" aria-labelledby="ai-secretary-coming-soon-title">
      <div className="ai-secretary-coming-soon__card">
        <div className="ai-secretary-coming-soon__icon" aria-hidden="true">
          AI
        </div>
        <h1 id="ai-secretary-coming-soon-title" className="ai-secretary-coming-soon__title">
          AI 비서
        </h1>
        <p className="ai-secretary-coming-soon__status">준비 중입니다.</p>
        <p className="ai-secretary-coming-soon__hint">더 편리하게 사용할 수 있도록 준비하고 있습니다.</p>
      </div>
    </main>
  )
}
