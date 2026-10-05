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
      const uiActions = meta.navigate
        ? [{ type: 'navigate.customer.detail', customerId: c.customerId }]
        : []
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
    const uiActions = meta.navigate
      ? [{ type: 'navigate.customer.detail', customerId: c.customerId }]
      : []
    return {
      text: [
        `${c.name} 고객 정보입니다.`,
        c.phone ? `연락처: ${c.phone}` : null,
        c.address ? `주소: ${c.address}` : null,
        c.job ? `직업: ${c.job}` : null,
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

  return {
    text: '조회 결과를 표시하지 못했습니다.',
    kind: 'text',
    resolvedCustomer: null,
    uiActions: [],
  }
}
