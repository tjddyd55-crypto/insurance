import type { ReactNode } from 'react'

export function AdvisorHeroTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return (
    <div className="pap-tags pap-tags--hero">
      {tags.map((tag) => (
        <span key={tag} className="pap-tag">#{tag}</span>
      ))}
    </div>
  )
}

/**
 * 히어로 하단 액션(전화/상담/명함/공유) 블록. 해시태그와 분리된 독립 블록이라
 * 태그 개수·줄바꿈이 아이콘 위치에 영향을 주지 않는다. 1/2/3형 공통 (미리보기=공개 동일 컴포넌트).
 */
export function AdvisorHeroActionSection({ children }: { children: ReactNode }) {
  return <div className="pap-action-section">{children}</div>
}

/** 해시태그 전용 블록 — 자체 padding 으로 액션 블록 아래 별도 행에 배치. 태그가 없으면 렌더하지 않는다. */
export function AdvisorHeroHashtagSection({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return (
    <div className="pap-hashtag-section">
      <AdvisorHeroTags tags={tags} />
    </div>
  )
}

export function AdvisorHeroNameLine({ title }: { title: string }) {
  return <h1 className="pap-name pap-name--billboard">{title}</h1>
}
