import { createHash } from 'node:crypto'

/**
 * 보장 시뮬레이터 공유 스냅샷 지문의 단일 원천.
 * develop·이 저장소의 네이티브 트리에는 별도의 지문 구현이 없다.
 * 서버 저장 계층만 이 함수를 쓰고, 클라이언트는 같은 해시를 다시 만들지 않는다.
 */

function stableString(value) {
  if (value == null) return ''
  return String(value).trim()
}

function stableAmount(value) {
  if (value == null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function canonicalItem(item, index) {
  if (item?.type === 'time-marker') {
    return {
      type: 'time-marker',
      id: stableString(item.id),
      label: stableString(item.label),
      order: index,
    }
  }
  return {
    type: 'coverage',
    id: stableString(item?.id),
    category: stableString(item?.category),
    label: stableString(item?.label),
    currentAmount: stableAmount(item?.currentAmount),
    proposedAmount: stableAmount(item?.proposedAmount),
    memo: stableString(item?.memo) || null,
    favorite: Boolean(item?.favorite),
    order: index,
  }
}

/**
 * 저장 시각(createdAt/updatedAt)은 내용이 아니다.
 * 항목 순서는 order 다음 원래 배열 순으로 고정한다.
 * @param {object | null | undefined} scenario
 */
export function canonicalCoverageShareSnapshot(scenario) {
  const sourceItems = Array.isArray(scenario?.items) ? scenario.items : []
  const items = sourceItems
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = Number(left.item?.order)
      const rightOrder = Number(right.item?.order)
      const safeLeft = Number.isFinite(leftOrder) ? leftOrder : left.index
      const safeRight = Number.isFinite(rightOrder) ? rightOrder : right.index
      if (safeLeft !== safeRight) return safeLeft - safeRight
      return left.index - right.index
    })
    .map((entry, index) => canonicalItem(entry.item, index))

  const customerName = stableString(scenario?.customerNameSnapshot ?? scenario?.customerName)

  return {
    id: stableString(scenario?.id),
    title: stableString(scenario?.title),
    diseaseType: stableString(scenario?.diseaseType),
    description: stableString(scenario?.description),
    customerId: scenario?.customerId == null ? null : stableString(scenario.customerId) || null,
    customerName: customerName || null,
    consultationDate: stableString(scenario?.consultationDate),
    kind: stableString(scenario?.kind) || null,
    templateId: stableString(scenario?.templateId) || null,
    templateNameSnapshot: stableString(scenario?.templateNameSnapshot) || null,
    items,
  }
}

/** @param {object | null | undefined} scenario */
export function coverageShareSnapshotFingerprint(scenario) {
  const canonical = JSON.stringify(canonicalCoverageShareSnapshot(scenario))
  return createHash('sha256').update(canonical).digest('hex')
}
