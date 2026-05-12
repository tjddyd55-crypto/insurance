import {
  CRM_TEMPLATE_CORE_STORAGE_KEYS,
  CRM_TEMPLATE_FIELD_KEY_REGEX,
  CRM_TEMPLATE_LIFECYCLE_STATUSES,
  CRM_TEMPLATE_TAB_ID_REGEX,
} from './crmTemplateBuilder.constants'
import type { CrmTemplateDraft, CrmTemplateLifecycleStatus, CrmTemplateValidationIssue } from './crmTemplateBuilder.types'

const CORE_SET = new Set<string>(CRM_TEMPLATE_CORE_STORAGE_KEYS)

export function validateCrmTemplateDraft(params: {
  name: string
  industryCode: string
  status: CrmTemplateLifecycleStatus
  draft: CrmTemplateDraft
}): CrmTemplateValidationIssue[] {
  const issues: CrmTemplateValidationIssue[] = []
  const name = params.name.trim()
  const industryCode = params.industryCode.trim().toLowerCase()

  if (!(CRM_TEMPLATE_LIFECYCLE_STATUSES as readonly string[]).includes(params.status)) {
    issues.push({ tab: 'basic', message: '상태는 draft·active·archived 중 하나여야 합니다.' })
  }

  if (!name) {
    issues.push({ tab: 'basic', message: '템플릿명을 입력해 주세요.' })
  }
  if (!industryCode) {
    issues.push({ tab: 'basic', message: 'Industry를 선택해 주세요.' })
  }
  if (industryCode === 'insurance') {
    issues.push({
      tab: 'basic',
      message: '보험(insurance) 업종은 동적 고객 템플릿을 만들 수 없습니다.',
    })
  }

  const { draft } = params
  if (draft.formFields.length === 0) {
    issues.push({
      tab: 'form',
      message: '등록 폼 필드를 최소 1개 추가해 주세요.',
    })
  }

  const keySet = new Set<string>()
  for (const f of draft.formFields) {
    if (f.storage === 'extension') {
      const fk = f.fieldKey.trim()
      if (!fk) {
        issues.push({
          tab: 'form',
          localId: f.localId,
          message: '확장 필드의 필드 키(canonical)를 입력해 주세요.',
        })
      } else if (!CRM_TEMPLATE_FIELD_KEY_REGEX.test(fk)) {
        issues.push({
          tab: 'form',
          localId: f.localId,
          message: `필드 키 형식이 올바르지 않습니다: "${fk}" (영문으로 시작, 영숫자·_. 만 허용)`,
        })
      }
    } else {
      const fk = f.fieldKey.trim()
      if (!fk || !CORE_SET.has(fk)) {
        issues.push({
          tab: 'form',
          localId: f.localId,
          message: '코어 필드는 허용된 키 목록에서 선택해 주세요.',
        })
      }
    }

    const fkDup = (f.storage === 'core' || f.storage === 'extension') && f.fieldKey.trim()
    if (fkDup && keySet.has(fkDup)) {
      issues.push({
        tab: 'form',
        localId: f.localId,
        message: `필드 키가 중복됩니다: "${fkDup}"`,
      })
    }
    if (fkDup) keySet.add(fkDup)

    if (!f.label.trim()) {
      issues.push({
        tab: 'form',
        localId: f.localId,
        message: '필드 라벨을 입력해 주세요.',
      })
    }

    const needOpt =
      f.fieldType === 'select' || f.fieldType === 'radio' || f.fieldType === 'checkbox'
    if (needOpt) {
      const nonEmptyOpts = f.options.filter((o) => String(o.value ?? '').trim().length > 0)
      if (nonEmptyOpts.length === 0) {
        issues.push({
          tab: 'form',
          localId: f.localId,
          message: '선택형 필드에는 value가 채워진 옵션이 최소 1개 필요합니다.',
        })
      } else {
        const seen = new Set<string>()
        for (const o of nonEmptyOpts) {
          const v = String(o.value ?? '').trim()
          if (seen.has(v)) {
            issues.push({
              tab: 'form',
              localId: f.localId,
              message: `옵션 value가 중복됩니다: "${v}"`,
            })
            break
          }
          seen.add(v)
        }
      }
    }
  }

  for (const c of draft.listColumns) {
    if (!c.label.trim()) {
      issues.push({ tab: 'list', localId: c.localId, message: '컬럼 라벨을 입력해 주세요.' })
    }
    if (!CRM_TEMPLATE_FIELD_KEY_REGEX.test(String(c.columnKey ?? '').trim())) {
      issues.push({
        tab: 'list',
        localId: c.localId,
        message: '컬럼 키는 영문으로 시작해야 하며 영숫자·_. 만 사용할 수 있습니다.',
      })
    }
    const src = c.sourceFieldKey.trim()
    if (!src || !CRM_TEMPLATE_FIELD_KEY_REGEX.test(src)) {
      issues.push({
        tab: 'list',
        localId: c.localId,
        message: '목록 원본 필드를 등록 폼 필드 목록에서 선택해 주세요.',
      })
    } else if (!keySet.has(src)) {
      issues.push({
        tab: 'list',
        localId: c.localId,
        message: `목록 원본 필드 "${src}" 가 등록 폼에 존재하지 않습니다.`,
      })
    }
  }

  const tabIds = new Set<string>()
  for (const t of draft.detailTabs) {
    const tid = t.tabId.trim()
    if (!tid || !CRM_TEMPLATE_TAB_ID_REGEX.test(tid)) {
      issues.push({
        tab: 'detail',
        localId: t.localId,
        message:
          '탭 ID는 영문으로 시작해야 하며 영숫자·하이픈·밑줄만 허용됩니다.',
      })
    } else if (tabIds.has(tid)) {
      issues.push({
        tab: 'detail',
        localId: t.localId,
        message: `탭 ID가 중복됩니다: "${tid}"`,
      })
    }
    if (tid) tabIds.add(tid)

    if (!t.label.trim()) {
      issues.push({ tab: 'detail', localId: t.localId, message: '탭 이름을 입력해 주세요.' })
    }

    for (const fk of t.fieldKeys) {
      const k = String(fk).trim()
      if (!keySet.has(k)) {
        issues.push({
          tab: 'detail',
          localId: t.localId,
          message: `탭 "${t.label || tid}"에 없는 필드 키가 포함되어 있습니다: "${k}"`,
        })
      }
    }
  }

  return issues
}
