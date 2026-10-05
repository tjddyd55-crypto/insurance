import { buildCustomerDetailUiAction, sanitizeUiActions } from './navigationActions.js'

/**
 * Grounded assistant payloads from tool results only (no GPT fill-in).
 * @param {object} toolResult
 * @param {{ toolKey: string, navigate?: boolean }} meta
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
    return {
      text: [
        `${c.name} 고객 정보입니다.`,
        c.phone ? `연락처: ${c.phone}` : null,
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

  if (toolKey === 'task.list') {
    const todos = toolResult.todos ?? []
    const dueLabel =
      toolResult.due === 'tomorrow' ? '내일' : toolResult.due === 'week' ? '이번 주' : '오늘'
    if (todos.length === 0) {
      return {
        text: `${dueLabel} 할 일이 없습니다.`,
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const body = todos.map((t, i) => `${i + 1}. ${t.title}${t.dueDate ? ` (${t.dueDate})` : ''}`).join('\n')
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
      return {
        text: `${dayLabel} 일정이 없습니다.`,
        kind: 'text',
        resolvedCustomer: null,
        uiActions: [],
      }
    }
    const body = events
      .map((ev, i) => {
        const title = ev.title || '일정'
        const who = ev.customerName ? ` · ${ev.customerName}` : ''
        return `${i + 1}. ${title}${who}`
      })
      .join('\n')
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
    const body = claims
      .map((c, i) => {
        const date = c.submittedAt ? String(c.submittedAt).slice(0, 10) : '—'
        return `${i + 1}. ${c.customerName} · ${c.title} (${c.status}) · ${date}`
      })
      .join('\n')
    return {
      text: `청구 ${claims.length}건입니다.\n${body}`,
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
