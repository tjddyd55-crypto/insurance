import { buildCustomerDetailUiAction, sanitizeUiActions } from './navigationActions.js'
import {
  formatClaimStatusLabel,
  formatScheduleEventLine,
  formatTodoDueSuffix,
} from './readFormatUtils.js'

function formatGenderLabel(gender) {
  if (gender === 'male') return '남성'
  if (gender === 'female') return '여성'
  return null
}

function formatProjectionValue(item) {
  const value = item?.value
  if (Array.isArray(value)) {
    const values = value.filter((v) => v != null && String(v).trim() !== '')
    return values.length > 0 ? values.map((v) => String(v)).join(', ') : '등록된 정보 없음'
  }
  if (value == null || String(value).trim() === '') return '등록된 정보 없음'
  if (item?.semanticKey === 'customer.gender') {
    return formatGenderLabel(String(value).trim().toLowerCase()) ?? String(value)
  }
  if (item?.valueType === 'boolean') return value === true ? '예' : '아니오'
  if (item?.valueType === 'date' || item?.valueType === 'datetime') {
    return String(value).slice(0, 10)
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function formatProjectionLines(projection) {
  return (projection ?? []).map((item) => `${item.label}: ${formatProjectionValue(item)}`)
}

/**
 * Grounded assistant payloads from tool results only (no GPT fill-in).
 * @param {object} toolResult
 * @param {{ toolKey: string, navigate?: boolean, includeDate?: boolean }} meta
 */
export function formatReadToolResponse(toolResult, meta = {}) {
  const toolKey = toolResult.toolKey ?? meta.toolKey

  if (toolResult.notWired) {
    const label =
      toolKey === 'task.list'
        ? '할일 목록'
        : toolKey === 'schedule.list'
          ? '일정 목록'
          : toolKey === 'claim.list'
            ? '청구 목록'
            : '조회'
    return {
      text: `「${label}」 조회는 아직 AI 비서에 연결 중입니다. 잠시 후 다시 시도해 주세요.`,
      kind: 'text',
      resolvedCustomer: null,
      uiActions: [],
    }
  }

  if (toolKey === 'customer.search') {
    const customers = toolResult.customers ?? []
    if (customers.length === 0) {
      const q = meta.query ?? ''
      return {
        text: q ? `「${q}」(으)로 고객을 찾지 못했습니다.` : '고객을 찾지 못했습니다.',
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    if (customers.length === 1) {
      const c = customers[0]
      const uiActions = meta.navigate ? buildCustomerDetailUiAction(c.customerId) : []
      return {
        text: [
          `${c.name} 고객을 찾았습니다.`,
          c.phone ? `연락처: ${c.phone}` : null,
          formatGenderLabel(c.gender) ? `성별: ${formatGenderLabel(c.gender)}` : null,
          c.address ? `주소: ${c.address}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        kind: 'customer_summary_card',
        customer: c,
        resolvedCustomer: { customerId: c.customerId, name: c.name, phoneTail: c.phoneTail },
        uiActions,
      }
    }
    const lines = customers.map((c, i) => `${i + 1}. ${c.name} (휴대폰 끝 ${c.phoneTail})`)
    return {
      text: `같은 이름·조건의 고객이 ${customers.length}명 있습니다. 번호를 말씀해 주세요.\n${lines.join('\n')}`,
      kind: 'customer_disambiguation',
      options: customers.map((c) => ({
        customerId: c.customerId,
        label: `${c.name} · 끝 ${c.phoneTail}`,
      })),
      resolvedCustomer: null,
      uiActions: [],
    }
  }

  if (toolKey === 'customer.get') {
    const c = toolResult.customer
    if (!c) {
      return {
        text: '고객을 찾을 수 없습니다.',
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const uiActions = meta.navigate ? buildCustomerDetailUiAction(c.customerId) : []
    const biz = c.businessInfo
    const projectedLines = formatProjectionLines(c.projection)
    return {
      text: projectedLines.length > 0
        ? projectedLines.join('\n')
        : [
        `${c.name} 고객 정보입니다.`,
        c.phone ? `연락처: ${c.phone}` : null,
        formatGenderLabel(c.gender) ? `성별: ${formatGenderLabel(c.gender)}` : null,
        c.address ? `주소: ${c.address}` : null,
        c.job ? `직업: ${c.job}` : null,
        c.companyName ? `회사: ${c.companyName}` : null,
        c.primaryInsurer ? `주력보험사: ${c.primaryInsurer}` : null,
        c.carNumber ? `차량번호: ${c.carNumber}` : null,
        biz?.businessNumber ? `사업자번호: ${biz.businessNumber}` : null,
        biz?.businessAddress ? `사업장 주소: ${biz.businessAddress}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      kind: 'customer_summary_card',
      customer: c,
      resolvedCustomer: { customerId: c.customerId, name: c.name, phoneTail: c.phoneTail },
      uiActions,
    }
  }

  if (toolKey === 'consultation.recent') {
    if (!toolResult.customer) {
      return {
        text: '먼저 조회할 고객을 지정해 주세요. (예: 홍길동 찾아줘)',
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const list = toolResult.consultations ?? []
    if (list.length === 0) {
      return {
        text: `${toolResult.customer.name} 고객의 최근 상담 기록이 없습니다.`,
        kind: 'text',
        resolvedCustomer: {
          customerId: toolResult.customer.customerId,
          name: toolResult.customer.name,
          phoneTail: toolResult.customer.phoneTail,
        },
        uiActions: [],
      }
    }
    const body = list
      .map((row, i) => {
        const date = row.consultationDate ? String(row.consultationDate).slice(0, 10) : '날짜 없음'
        return `${i + 1}. (${date}) ${row.bodyPreview}`
      })
      .join('\n')
    return {
      text: `${toolResult.customer.name} 고객 최근 상담 ${list.length}건입니다.\n${body}`,
      kind: 'consultation_list_card',
      consultations: list,
      resolvedCustomer: {
        customerId: toolResult.customer.customerId,
        name: toolResult.customer.name,
        phoneTail: toolResult.customer.phoneTail,
      },
      uiActions: [],
    }
  }

  if (toolKey === 'customer.files.list') {
    if (!toolResult.customer) {
      return {
        text: '먼저 조회할 고객을 지정해 주세요.',
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const files = toolResult.files ?? []
    if (files.length === 0) {
      return {
        text: `${toolResult.customer.name} 고객에게 등록된 파일이 없습니다.`,
        kind: 'text',
        resolvedCustomer: {
          customerId: toolResult.customer.customerId,
          name: toolResult.customer.name,
          phoneTail: toolResult.customer.phoneTail,
        },
        uiActions: [],
      }
    }
    const body = files
      .map((f, i) => {
        const date = f.createdAt ? String(f.createdAt).slice(0, 10) : '—'
        const type = f.type ? ` (${f.type})` : ''
        return `${i + 1}. ${f.name}${type} · ${date}`
      })
      .join('\n')
    return {
      text: `${toolResult.customer.name} 고객 파일 ${files.length}건입니다.\n${body}`,
      kind: 'customer_files_card',
      files,
      customer: toolResult.customer,
      resolvedCustomer: {
        customerId: toolResult.customer.customerId,
        name: toolResult.customer.name,
        phoneTail: toolResult.customer.phoneTail,
      },
      uiActions: sanitizeUiActions([]),
    }
  }

  if (toolKey === 'customer.list') {
    const total = Number(toolResult.total ?? 0)
    if (toolResult.countOnly) {
      return {
        text: `현재 조회 가능한 고객은 ${total}명입니다.`,
        kind: 'customer_list_card',
        total,
        customers: [],
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const customers = toolResult.customers ?? []
    if (total === 0) {
      return {
        text: Number(toolResult.filterCount ?? 0) > 0
          ? '조건에 맞는 고객이 없습니다.'
          : '조회 가능한 고객이 없습니다.',
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const shown = customers.slice(0, 20)
    const hasProjection = shown.some((c) => Array.isArray(c.projection) && c.projection.length > 0)
    const lines = shown.map((c, i) => {
      if (hasProjection) {
        const projected = formatProjectionLines(c.projection)
        return `${i + 1}. ${c.name}${projected.length ? ` — ${projected.join(' · ')}` : ''}`
      }
      const genderLabel = formatGenderLabel(c.gender)
      return `${i + 1}. ${c.name}${genderLabel ? ` (${genderLabel})` : ''} — 휴대폰 끝 ${c.phoneTail}`
    })
    const more =
      total > shown.length ? `\n… 외 ${total - shown.length}명 (목록은 최대 ${toolResult.limit ?? 20}명까지 표시)` : ''
    return {
      text: `현재 조회 가능한 고객은 ${total}명입니다.\n${lines.join('\n')}${more}`,
      kind: 'customer_list_card',
      total,
      customers: shown,
      resolvedCustomer: null,
      uiActions: [],
    }
  }

  if (toolKey === 'task.list') {
    const todos = (toolResult.todos ?? []).filter((t) => String(t.title ?? '').trim())
    const dueScope =
      toolResult.due === 'tomorrow'
        ? 'tomorrow'
        : toolResult.due === 'week'
          ? 'week'
          : toolResult.due === 'all'
            ? 'all'
            : 'today'
    const dueLabel =
      dueScope === 'tomorrow'
        ? '내일'
        : dueScope === 'week'
          ? '이번 주'
          : dueScope === 'all'
            ? '미완료'
            : '오늘'
    if (todos.length === 0) {
      const emptyText =
        dueScope === 'today'
          ? '오늘 등록된 할 일이 없습니다.'
          : `${dueLabel} 할 일이 없습니다.`
      return {
        text: emptyText,
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const body = todos
      .map((t, i) => {
        const title = String(t.title ?? '').trim() || '제목 없음'
        const suffix = formatTodoDueSuffix(t.dueDate, dueScope, {
          force: meta.includeDate === true || dueScope === 'all',
        })
        return `${i + 1}. ${title}${suffix}`
      })
      .join('\n')
    return {
      text: `${dueLabel} 할 일 ${todos.length}건입니다.\n${body}`,
      kind: 'task_list_card',
      todos,
      resolvedCustomer: null,
      uiActions: [],
    }
  }

  if (toolKey === 'schedule.list') {
    const events = toolResult.events ?? []
    const dayLabel = toolResult.day === 'tomorrow' ? '내일' : '오늘'
    if (events.length === 0) {
      const emptyText =
        toolResult.day === 'today' || toolResult.day == null
          ? '오늘 등록된 일정이 없습니다.'
          : `${dayLabel} 일정이 없습니다.`
      return {
        text: emptyText,
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const body = events.map((ev, i) => `${i + 1}. ${formatScheduleEventLine(ev)}`).join('\n')
    return {
      text: `${dayLabel} 일정 ${events.length}건입니다.\n${body}`,
      kind: 'schedule_list_card',
      events,
      resolvedCustomer: null,
      uiActions: [],
    }
  }

  if (toolKey === 'claim.list') {
    const claims = toolResult.claims ?? []
    if (claims.length === 0) {
      return {
        text: toolResult.pending ? '미처리 청구가 없습니다.' : '청구 내역이 없습니다.',
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const pending = Boolean(toolResult.pending)
    const body = claims
      .map((c, i) => {
        const statusLabel = formatClaimStatusLabel(c.status)
        const title = String(c.title ?? '').trim() || '청구'
        const who = String(c.customerName ?? '').trim() || '고객'
        return `${i + 1}. ${who} — ${title} — ${statusLabel}`
      })
      .join('\n')
    const header = pending ? `미처리 청구 ${claims.length}건입니다.` : `청구 ${claims.length}건입니다.`
    return {
      text: `${header}\n${body}`,
      kind: 'claim_list_card',
      claims,
      resolvedCustomer: null,
      uiActions: [],
    }
  }

  return {
    text: '조회 결과를 표시하지 못했습니다.',
    kind: 'text',
    resolvedCustomer: null,
    uiActions: [],
  }
}
