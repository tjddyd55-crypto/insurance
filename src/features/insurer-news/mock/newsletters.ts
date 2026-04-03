import type { NewsletterDetail, NewsletterItem } from '../types'

const hero = (seed: number, w = 800, h = 1200) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`

/** 전체 mock 소식지 — gaCode · insurerCode 로 필터 */
export const MOCK_NEWSLETTERS: NewsletterDetail[] = [
  {
    id: 'nl-yj-db-001',
    gaCode: 'YJASSET',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    insurerSlug: 'db',
    title: '2025년 2분기 재물 특약 안내',
    summary: '소상공인 패키지 특약 요율 조정 및 청약 시 유의사항을 정리했습니다.',
    heroImageUrl: hero(101),
    publishedAt: '2025-03-28T09:30:00+09:00',
    status: 'PUBLISHED',
    hasImages: true,
    hasPdf: true,
    hasTextBody: true,
    bodyText:
      '안녕하세요.\n\n이번 분기 재물 특약은 기존 대비 일부 특별약관의 보장 범위가 조정되었습니다. 청약 전 반드시 약관 개정 요지를 확인해 주세요.\n\n첨부 이미지는 요약 팜플렛이며, PDF에는 전체 약관 변경 대조표가 포함되어 있습니다.',
    attachments: [
      {
        id: 'att-yj-1',
        kind: 'image',
        url: hero(101, 900, 1400),
        fileName: 'pamphlet-1.webp',
        sortOrder: 0,
      },
      {
        id: 'att-yj-2',
        kind: 'image',
        url: hero(102, 900, 1400),
        fileName: 'pamphlet-2.webp',
        sortOrder: 1,
      },
      {
        id: 'att-yj-3',
        kind: 'pdf',
        url: '#',
        fileName: '2025Q2-재물특약.pdf',
        sortOrder: 2,
      },
    ],
  },
  {
    id: 'nl-yj-db-002',
    gaCode: 'YJASSET',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    insurerSlug: 'db',
    title: '자동차 보험 만기 안내 리플렛',
    summary: '만기 30일 전 고지·자동이체 변경 방법을 한 장에 정리했습니다.',
    heroImageUrl: hero(103),
    publishedAt: '2025-03-22T16:15:00+09:00',
    status: 'PUBLISHED',
    hasImages: true,
    hasPdf: false,
    hasTextBody: true,
    bodyText: '만기 알림과 납입 방식 변경은 앱 또는 콜센터를 통해 가능합니다. 자세한 절차는 이미지를 참고해 주세요.',
    attachments: [
      {
        id: 'att-yj-4',
        kind: 'image',
        url: hero(103, 720, 1280),
        fileName: 'auto-renewal.jpg',
        sortOrder: 0,
      },
    ],
  },
  {
    id: 'nl-yj-hd-001',
    gaCode: 'YJASSET',
    insurerCode: 'HD',
    insurerName: '현대해상',
    insurerSlug: 'hyundai',
    title: '업무용 자동차 할인 특약 안내',
    summary: '사업자등록 대상 차량 할인 요건 및 증빙 서류 목록입니다.',
    heroImageUrl: hero(201),
    publishedAt: '2025-03-25T14:00:00+09:00',
    status: 'PUBLISHED',
    hasImages: true,
    hasPdf: true,
    hasTextBody: true,
    bodyText: '할인 특약은 갱신 시점에 서류 심사가 필요합니다. 누락 시 할인이 복원되지 않을 수 있습니다.',
    attachments: [
      {
        id: 'att-yj-hd-1',
        kind: 'image',
        url: hero(201, 800, 1600),
        fileName: 'biz-auto-discount.png',
        sortOrder: 0,
      },
      {
        id: 'att-yj-hd-2',
        kind: 'pdf',
        url: '#',
        fileName: 'biz-discount-checklist.pdf',
        sortOrder: 1,
      },
    ],
  },
  {
    id: 'nl-yj-hd-002',
    gaCode: 'YJASSET',
    insurerCode: 'HD',
    insurerName: '현대해상',
    insurerSlug: 'hyundai',
    title: '단기 운행 차량 임시 보험 안내',
    summary: '1~30일 단기 가입 가능 상품 및 청약 채널 요약.',
    heroImageUrl: null,
    publishedAt: '2025-03-10T10:00:00+09:00',
    status: 'PUBLISHED',
    hasImages: false,
    hasPdf: false,
    hasTextBody: true,
    bodyText: '단기 보험은 온라인 전용 채널에서만 가입 가능합니다. 번호판 등록 전 차량은 별도 절차가 필요합니다.',
    attachments: [],
  },
  {
    id: 'nl-other-db-001',
    gaCode: 'OTHER01',
    insurerCode: 'DB',
    insurerName: 'DB손해보험',
    insurerSlug: 'db',
    title: '[타 GA] DB손해 전용 공지',
    summary: '이 데이터는 YJASSET과 완전히 별개입니다. OTHER01 전용입니다.',
    heroImageUrl: hero(501),
    publishedAt: '2025-03-20T11:00:00+09:00',
    status: 'PUBLISHED',
    hasImages: true,
    hasPdf: false,
    hasTextBody: true,
    bodyText: 'GA 테넌트 분리 검증용 mock 콘텐츠입니다.',
    attachments: [
      {
        id: 'att-o-1',
        kind: 'image',
        url: hero(501),
        fileName: 'other-ga-notice.webp',
        sortOrder: 0,
      },
    ],
  },
]

export function toNewsletterItem(d: NewsletterDetail): NewsletterItem {
  const { bodyText: _b, attachments: _a, ...rest } = d
  return rest
}

function cloneNewsletter(row: NewsletterDetail): NewsletterDetail {
  return {
    ...row,
    attachments: row.attachments.map((a) => ({ ...a })),
  }
}

/** 런타임 mock 스토어 — 관리자 등록/수정과 사용자 목록이 동일 소스를 본다. */
let newsletterStore: NewsletterDetail[] = MOCK_NEWSLETTERS.map(cloneNewsletter)

export function mockNewslettersPublishedForGa(gaCode: string): NewsletterDetail[] {
  const c = gaCode.trim().toUpperCase()
  return newsletterStore.filter((n) => n.gaCode === c && n.status === 'PUBLISHED')
}

export function mockNewslettersAllForAdmin(gaCode: string, insurerCode: string): NewsletterDetail[] {
  const c = gaCode.trim().toUpperCase()
  const ic = insurerCode.trim()
  return newsletterStore.filter((n) => n.gaCode === c && n.insurerCode === ic)
}

export function upsertNewsletterInStore(row: NewsletterDetail): void {
  const i = newsletterStore.findIndex((x) => x.id === row.id)
  const copy = cloneNewsletter(row)
  if (i === -1) {
    newsletterStore = [copy, ...newsletterStore]
  } else {
    newsletterStore = [...newsletterStore.slice(0, i), copy, ...newsletterStore.slice(i + 1)]
  }
}

export function deleteNewsletterFromStore(id: string): void {
  newsletterStore = newsletterStore.filter((x) => x.id !== id)
}
