import {
  contactRoleKey,
  isHistoryContactFieldChanged,
  isHistoryPhoneChanged,
  isHistoryTextChanged,
  pairHistoryContacts,
  pickLatestHistoryEntry,
} from '../../../../server/lib/companyHistoryDiff.js'
import type { CompanyUpdateHistoryItem } from '../domain/types'

/** 담당자 1명의 필드별 변경 여부(직책/이름/전화). */
export type CompanyContactFieldChange = {
  positionChanged: boolean
  nameChanged: boolean
  phoneChanged: boolean
}

/**
 * 원수사 1곳의 "마지막 저장" 기준 변경 요약.
 * 업데이트현황 화면의 diff 계산(server/lib/companyHistoryDiff)을 그대로 재사용해,
 * 연락처 카드에서 바로 기준일 배지 + 변경 필드 강조에 쓴다.
 */
export type CompanyDirectoryChangeSummary = {
  /** 최근 저장일(YYYY-MM-DD, KST). 배지 표시에 사용. */
  updatedAt: string
  customerCenterChanged: boolean
  systemChanged: boolean
  incallChanged: boolean
  visitInfoChanged: boolean
  /** 정규화된 직책(role) → 담당자 변경 요약. */
  contactChangesByRole: Map<string, CompanyContactFieldChange>
}

function buildContactChanges(
  latest: CompanyUpdateHistoryItem,
): Map<string, CompanyContactFieldChange> {
  const changes = new Map<string, CompanyContactFieldChange>()
  const pairs = pairHistoryContacts(latest.before.contacts ?? [], latest.after.contacts ?? [])
  for (const pair of pairs) {
    const role = contactRoleKey(pair.after.position || pair.before.position)
    if (!role) {
      continue
    }
    changes.set(role, {
      positionChanged: isHistoryContactFieldChanged('position', pair.before, pair.after, { isNew: pair.isNew }),
      nameChanged: isHistoryContactFieldChanged('name', pair.before, pair.after, { isNew: pair.isNew }),
      phoneChanged: isHistoryContactFieldChanged('phone', pair.before, pair.after, { isNew: pair.isNew }),
    })
  }
  return changes
}

/**
 * 최근 업데이트 로그(회사별 여러 건)를 회사 id 기준으로 접어, 각 회사의
 * "마지막 저장" 1건만 남긴 변경 요약 맵을 만든다.
 * key 는 directory 의 company id 를 문자열로 맞춘 값(String(entry.id)).
 */
export function buildCompanyChangeSummaries(
  history: CompanyUpdateHistoryItem[],
): Map<string, CompanyDirectoryChangeSummary> {
  const grouped = new Map<string, CompanyUpdateHistoryItem[]>()
  for (const item of history) {
    const companyId = String(item.companyId ?? '').trim()
    if (!companyId) {
      continue
    }
    const bucket = grouped.get(companyId)
    if (bucket) {
      bucket.push(item)
    } else {
      grouped.set(companyId, [item])
    }
  }

  const summaries = new Map<string, CompanyDirectoryChangeSummary>()
  for (const [companyId, items] of grouped) {
    const latest = pickLatestHistoryEntry(items) as CompanyUpdateHistoryItem | null
    if (!latest) {
      continue
    }
    const { before, after } = latest
    summaries.set(companyId, {
      updatedAt: latest.updatedAt,
      customerCenterChanged: isHistoryPhoneChanged(before.customerCenter, after.customerCenter),
      systemChanged: isHistoryPhoneChanged(before.system, after.system),
      incallChanged: isHistoryPhoneChanged(before.incall, after.incall),
      visitInfoChanged: isHistoryTextChanged(before.visitInfo, after.visitInfo),
      contactChangesByRole: buildContactChanges(latest),
    })
  }
  return summaries
}

/** "YYYY-MM-DD" → "YYYY.MM.DD". 유효하지 않으면 빈 문자열(배지 숨김). */
export function formatCompanyUpdatedBadgeDate(updatedAt: string | undefined | null): string {
  const raw = String(updatedAt ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return ''
  }
  return raw.replace(/-/g, '.')
}
